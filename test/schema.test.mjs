import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const dbml = readFileSync(new URL("../schema.dbml", import.meta.url), "utf8");
const mermaid = readFileSync(
  new URL("../schema.mermaid.md", import.meta.url),
  "utf8",
);

function parseDbmlEnums(source) {
  const enums = new Map();
  const enumPattern = /^Enum\s+(\w+)\s*\{([\s\S]*?)^}/gm;

  for (const [, enumName, body] of source.matchAll(enumPattern)) {
    const values = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"))
      .map((line) => line.split(/\s+/)[0]);

    enums.set(enumName, new Set(values));
  }

  return enums;
}

function parseDbmlTables(source) {
  const tables = new Map();
  const tablePattern = /^Table\s+(\w+)\s*\{([\s\S]*?)^}/gm;

  for (const [, tableName, body] of source.matchAll(tablePattern)) {
    const columns = new Map();
    const refs = [];
    const enumColumns = new Map();
    let inIndexes = false;

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();

      if (line === "indexes {") {
        inIndexes = true;
        continue;
      }

      if (inIndexes) {
        continue;
      }

      const field = line.match(/^(\w+)\s+([A-Za-z_][\w]*(?:\([^)]*\))?)/);
      if (!field) {
        continue;
      }

      const [, columnName, rawType] = field;
      const columnType = rawType.replace(/\(.*/, "");
      columns.set(columnName, columnType);

      const ref = line.match(/\[.*?ref:\s*>\s*(\w+)\.(\w+)/);
      if (ref) {
        refs.push({
          columnName,
          targetTable: ref[1],
          targetColumn: ref[2],
        });
      }
    }

    tables.set(tableName, { columns, enumColumns, refs });
  }

  const enums = parseDbmlEnums(source);
  for (const table of tables.values()) {
    for (const [columnName, columnType] of table.columns) {
      if (enums.has(columnType)) {
        table.enumColumns.set(columnName, columnType);
      }
    }
  }

  return tables;
}

function parseMermaidEntities(source) {
  const entities = new Map();
  const mermaidBlock = source.match(/```mermaid\r?\n([\s\S]*?)```/);
  assert.ok(mermaidBlock, "schema.mermaid.md must contain a mermaid block");

  const entityPattern = /^    (\w+)\s+\{([\s\S]*?)^    }/gm;
  for (const [, entityName, body] of mermaidBlock[1].matchAll(entityPattern)) {
    const enumColumns = new Map();

    for (const line of body.split("\n")) {
      const field = line.trim().match(/^enum\s+(\w+)\s+"([^"]+)"/);
      if (!field) {
        continue;
      }

      enumColumns.set(field[1], field[2].split("|"));
    }

    entities.set(entityName, { enumColumns });
  }

  return entities;
}

describe("schema.dbml", () => {
  const tables = parseDbmlTables(dbml);
  const enums = parseDbmlEnums(dbml);

  it("only references tables and columns that exist", () => {
    for (const [tableName, table] of tables) {
      for (const ref of table.refs) {
        assert.ok(
          tables.has(ref.targetTable),
          `${tableName}.${ref.columnName} references missing table ${ref.targetTable}`,
        );

        assert.ok(
          tables.get(ref.targetTable).columns.has(ref.targetColumn),
          `${tableName}.${ref.columnName} references missing column ${ref.targetTable}.${ref.targetColumn}`,
        );
      }
    }
  });

  it("keeps tenant-owned tables scoped by company", () => {
    for (const tableName of ["app_user", "connector", "ad"]) {
      assert.ok(
        tables.get(tableName)?.columns.has("company_id"),
        `${tableName} must include company_id for tenant scoping`,
      );
    }
  });

  it("prevents duplicate connector publication rows for the same ad", () => {
    assert.match(
      dbml,
      /\(ad_id,\s*connector_id\)\s*\[unique\b/,
      "ad_connector_status must keep a unique ad/connector pair",
    );
  });

  it("defines the expected publication status lifecycle", () => {
    assert.deepEqual([...enums.get("connector_status")], [
      "pending",
      "success",
      "fail",
    ]);

    assert.deepEqual([...enums.get("ad_status")], [
      "draft",
      "partially_published",
      "fully_published",
      "failed",
    ]);
  });
});

describe("schema.mermaid.md", () => {
  const tables = parseDbmlTables(dbml);
  const enums = parseDbmlEnums(dbml);
  const entities = parseMermaidEntities(mermaid);

  it("documents every DBML table", () => {
    assert.deepEqual([...entities.keys()].sort(), [...tables.keys()].sort());
  });

  it("keeps documented enum values aligned with DBML", () => {
    for (const [tableName, entity] of entities) {
      const table = tables.get(tableName);

      for (const [columnName, documentedValues] of entity.enumColumns) {
        const enumName = table.enumColumns.get(columnName);
        assert.ok(
          enumName,
          `${tableName}.${columnName} is documented as enum but is not an enum in DBML`,
        );

        const dbmlValues = enums.get(enumName);
        for (const value of documentedValues) {
          assert.ok(
            dbmlValues.has(value),
            `${tableName}.${columnName} documents ${value}, but ${enumName} does not define it`,
          );
        }
      }
    }
  });
});
