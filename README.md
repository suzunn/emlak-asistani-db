# Emlak Asistanı — Veritabanı Tasarımı (v1 Taslak)

Çoklu firma + çoklu yayın hedefi destekli ilan yönetim platformu için DB tasarımı.

---

## 📊 Hızlı Bakış

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Company    │────►│   app_user   │────►│      ad      │
│   (firma)    │     │ (kullanıcı)  │     │   (ilan)     │
└──────┬───────┘     └──────────────┘     └──┬───┬───┬───┘
       │                                      │   │   │
       │                                      ▼   ▼   ▼
       │                              ┌─────────┐ ┌─────────┐
       │                              │ad_image │ │ad_video │
       │                              └─────────┘ └─────────┘
       │                                      │
       ▼                                      ▼
┌──────────────┐                  ┌─────────────────────┐
│  connector   │◄─────────────────│ ad_connector_status │
│ (yayın yeri) │                  │  (pending/success/  │
│ WP, sahibinden│                 │       fail)         │
│ hepsiemlak    │                 └─────────────────────┘
└──────────────┘
```

## 🧩 Mantık

- **Company** = Sistemi kullanan emlak firması (örn: Konsept Homes Fethiye)
- **app_user** = O firmada çalışan kişiler (admin, agent, viewer rolleri)
- **connector** = Bir firmanın bağlı olduğu yayın hedefi (WordPress sitesi, sahibinden hesabı, hepsiemlak hesabı...)
- **ad** = İlan kendisi (mülk detayları)
- **ad_image / ad_video** = İlana bağlı medya
- **ad_connector_status** = "Bu ilanı bu connectora gönderdik mi, sonucu ne?" — her satır bir gönderim denemesi
- **ai_video_job** = Fotodan video üretme iş kuyruğu (LinkedIn'deki feature için)

## 🎯 Senaryo

**Diyelim ki bir emlakçı bir ilanı 3 yere göndermek istiyor:**

1. İlan oluşturulur → `ad` tablosuna 1 satır, status: `draft`
2. Yayınla butonu → `ad_connector_status`'a **3 satır** atılır (3 connector için), hepsi `pending`
3. Backend her connectora sırayla gönderir:
   - WordPress'e gitti → o satır `success`, `external_post_id` dolar
   - Sahibinden'e gitti → o satır `success`
   - Hepsiemlak hata verdi → o satır `fail`, `error_message: "Token expired"`
4. `ad.status` güncellenir: 2 başarı + 1 fail → `partially_published`

İleride "tekrar dene" butonu fail olan satırı `pending`'e çevirir, sistem yeniden dener.

## 📋 Status Akışı

### `ad.status` (ilan genel durumu)
| Durum | Anlam |
|-------|-------|
| `draft` | Hazırlanıyor, henüz yayına gönderilmedi |
| `partially_published` | Bazı yerlere gitti, bazısında hata var |
| `fully_published` | Tüm hedeflerde başarılı |
| `failed` | Hiçbir hedefte başarılı olamadı |

### `ad_connector_status.status` (her gönderim için)
| Durum | Anlam |
|-------|-------|
| `pending` | Sırada, henüz denenmedi |
| `success` | Başarıyla yayınlandı |
| `fail` | Hata aldı, `error_message` + `completed_at` dolar |

## 🔐 Privacy Notu

`ad_image.url` ve `ad_video.url` alanları **external storage** (S3, Cloudflare R2, vs.) URL'i tutar. Dosyalar bizim serverda DEĞİL — dayının "kendi sistemimizde tutmasak" önerisinin teknik karşılığı bu.

Alternatif: Müşterinin kendi storage'ı (BYOS — Bring Your Own Storage) — `company` tablosuna `storage_config json` eklenir.

## 📁 Dosyalar

- **[schema.dbml](schema.dbml)** — dbdiagram.io'da açılır, görsel diyagram üretir
- **[schema.mermaid.md](schema.mermaid.md)** — Mermaid ER diyagramı (GitHub/Notion'da render olur)

## Schema Validation

Run the lightweight schema checks before editing the model:

```bash
npm test
```

The test suite verifies DBML references, tenant-scoped tables, publication status
invariants, and Mermaid enum values against the source DBML schema.

## 🔄 dbdiagram.io'da Nasıl Görselleştirilir?

1. https://dbdiagram.io/d adresine git
2. Sol kutudaki örnek kodu sil
3. `schema.dbml` içeriğini yapıştır
4. Sağda diagram render olur
5. **Export** → PNG / PDF / SQL olarak indirebilirsin
6. Linki paylaşabilirsin (View-only veya editable)

## ❓ Açık Sorular (dayıyla konuşulacak)

- [ ] Şifreleme: `connector.config` nasıl şifrelenecek? (App-level encryption key mi?)
- [ ] Storage: Bizim S3 mi, müşterinin mi (BYOS), yoksa hiç saklamamak mı?
- [ ] AI video: Hangi sağlayıcı? (Runway/Luma/SVD) — maliyet kontrolü?
- [ ] Multi-language: İngilizce ilan desteği gerekecek mi? (translations tablosu eklenir)
- [ ] Billing: Firma başına abonelik tablosu? (`subscription`, `usage_log`)
- [ ] Audit log: Hangi user neyi ne zaman değiştirdi? (`audit_log` tablosu)
- [ ] Soft delete: `deleted_at` ekleyelim mi her tabloya?

## Üretime Geçiş Kontrol Listesi

Bu repo kavramsal veri modelini tanımlar. Migration hazırlarken aşağıdaki kurallar
veritabanı seviyesinde ayrıca uygulanmalıdır:

- [ ] Her sorguda tenant sınırını korumak için `company_id` alanlarına index ekle.
- [ ] `ad.created_by_user_id` kullanıcısının aynı `company_id` değerine sahip
      olduğunu doğrula.
- [ ] `ad_connector_status` kaydındaki ilan ve connector'ın aynı firmaya ait
      olduğunu doğrula.
- [ ] Bir ilanda yalnızca bir görselin `is_main = true` olmasını partial unique
      index ile sınırla.
- [ ] `connector.config` içindeki gizli bilgileri uygulama katmanında şifrele;
      düz metin API anahtarı saklama.
- [ ] Retry sırasında mevcut `ad_connector_status` kaydını güncellemek yerine
      gönderim geçmişini ayrı bir tablo veya audit log ile koru.
