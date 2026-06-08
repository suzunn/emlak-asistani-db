# Emlak Asistanı — DB ER Diyagramı (Mermaid)

WhatsApp'ta direkt görünmez ama **GitHub, Notion, Obsidian, VS Code preview** içinde otomatik render olur. Markdown destekli yere yapıştır.

> Daha şık görsel için: `schema.dbml`'i dbdiagram.io'da aç → PNG export et → o görseli paylaş.

```mermaid
erDiagram
    company ||--o{ app_user : "çalıştırır"
    company ||--o{ connector : "tanımlar"
    company ||--o{ ad : "sahiplenir"
    app_user ||--o{ ad : "oluşturur"
    ad ||--o{ ad_image : "içerir"
    ad ||--o{ ad_video : "içerir"
    ad ||--o{ ad_connector_status : "gönderim kaydı"
    connector ||--o{ ad_connector_status : "hedef"
    ad ||--o{ ai_video_job : "AI video isteği"
    ad_video |o--|| ai_video_job : "üretilen video"

    company {
        bigint id PK
        varchar name
        varchar slug UK
        varchar email
        varchar phone
        varchar logo_url
        timestamp created_at
        timestamp updated_at
    }

    app_user {
        bigint id PK
        bigint company_id FK
        varchar email UK
        varchar password_hash
        varchar name
        enum role "admin|agent|viewer"
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
    }

    connector {
        bigint id PK
        bigint company_id FK
        enum type "wordpress_houzez|sahibinden|hepsiemlak|emlakjet|zingat|custom_api"
        varchar name
        json config "şifrelenmiş URL/key"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    ad {
        bigint id PK
        bigint company_id FK
        bigint created_by_user_id FK
        varchar title
        text description
        bigint price
        varchar currency "TRY|USD|EUR|GBP"
        enum property_type "Apartment|Villa|Land|Commercial|Bungalow|Hotel"
        varchar room_count "3+1"
        int bathroom_count
        int net_m2
        int gross_m2
        int land_m2
        varchar heating_type
        varchar floor
        varchar building_age
        boolean has_elevator
        boolean has_balcony
        boolean furnished
        boolean in_complex
        boolean has_garage
        varchar province "il"
        varchar district "ilçe"
        varchar neighborhood "mahalle"
        decimal latitude
        decimal longitude
        json features
        text transcript
        enum status "draft|partially_published|fully_published|failed"
        timestamp created_at
        timestamp updated_at
    }

    ad_image {
        bigint id PK
        bigint ad_id FK
        varchar url
        varchar original_filename
        varchar mime_type
        int width
        int height
        bigint file_size
        int sort_order
        boolean is_main
        boolean ai_edited
        timestamp created_at
    }

    ad_video {
        bigint id PK
        bigint ad_id FK
        varchar url
        int duration_seconds
        varchar thumbnail_url
        enum source "uploaded|ai_generated"
        timestamp created_at
    }

    ad_connector_status {
        bigint id PK
        bigint ad_id FK
        bigint connector_id FK
        enum status "pending|success|fail"
        varchar external_post_id
        varchar external_url
        text error_message
        timestamp attempted_at
        timestamp completed_at
    }

    ai_video_job {
        bigint id PK
        bigint ad_id FK
        bigint video_id FK "nullable"
        enum status "queued|processing|completed|failed"
        varchar model
        text prompt
        decimal cost_usd
        text error_message
        timestamp created_at
        timestamp completed_at
    }
```

## İlişki Açıklaması

- `company 1—N app_user` : Bir firmada birden çok kullanıcı
- `company 1—N connector` : Her firma kendi yayın hedeflerini tanımlar
- `company 1—N ad` : Firmaya ait ilanlar
- `app_user 1—N ad` : Bir kullanıcı birden çok ilan oluşturur
- `ad 1—N ad_image / ad_video` : İlana bağlı medya
- `ad 1—N ad_connector_status` : Her hedef için ayrı durum satırı
- `connector 1—N ad_connector_status` : Bir connectora birden çok ilan gönderilir
- `ad 1—N ai_video_job` : AI video oluşturma iş kuyruğu
- `ad_video 0/1—1 ai_video_job` : AI-üretilmiş video, kaynak job'a bağlı
