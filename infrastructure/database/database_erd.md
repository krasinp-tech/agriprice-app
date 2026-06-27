# AgriPrice Database - Entity-Relationship Diagram (ERD)

This document contains the Entity-Relationship Diagram (ERD) representing the normalized database structure of the AgriPrice platform in Mermaid syntax.

```mermaid
erDiagram
    PROFILES {
        uuid profile_id PK
        text phone
        text first_name
        text last_name
        text role
        text password_hash
        text avatar
        text tagline
        text about
        text address_line1
        text address_line2
        text map_link
        text links
        text hero_image
        integer followers_count
        integer following_count
        timestamp created_at
        timestamp last_seen
        text email
        date birth_date
        text account_status
        text tier
        float lat
        float lng
        timestamp updated_at
        text services
    }

    BUY_OFFERS {
        bigint product_id PK
        uuid user_id FK
        text name
        text description
        text unit
        text image
        text category
        boolean is_active
        timestamp created_at
        text variety
        text grade
        numeric price
        timestamp updated_at
        jsonb grades
    }

    OFFER_SLOTS {
        bigint slot_id PK
        bigint product_id FK
        text slot_name
        date start_date
        date end_date
        time time_start
        time time_end
        integer capacity
        integer booked_count
        boolean is_active
        timestamp created_at
    }

    BOOKINGS {
        bigint booking_id PK
        text booking_no
        uuid buyer_id FK
        uuid farmer_id FK
        bigint product_id FK
        bigint slot_id FK
        text queue_no
        timestamp scheduled_time
        text note
        text address
        text status
        timestamp created_at
        integer vehicle_count
        numeric quantity
        text vehicle_plates
        text contact_name
        text contact_phone
    }

    OFFER_GRADES {
        bigint id PK
        bigint offer_id FK
        text grade_name
        numeric price
        timestamp created_at
    }

    FOLLOWS {
        uuid follower_id PK,FK
        uuid following_id PK,FK
        timestamp created_at
    }

    CHAT_ROOMS {
        bigint room_id PK
        uuid user1_id FK
        uuid user2_id FK
        timestamp created_at
    }

    CHAT_MESSAGES {
        bigint message_id PK
        bigint room_id FK
        uuid sender_id FK
        text message
        text image_url
        boolean is_read
        timestamp created_at
    }

    NOTIFICATIONS {
        bigint notification_id PK
        uuid user_id FK
        text type
        text title
        text description
        boolean is_read
        timestamp created_at
    }

    NOTIFICATION_SETTINGS {
        uuid user_id PK,FK
        text role
        jsonb settings
        timestamp updated_at
    }

    DEVICE_SESSIONS {
        bigint session_id PK
        uuid user_id FK
        text device_name
        text device_type
        text ip_address
        text user_agent
        timestamp last_active
        timestamp created_at
        text push_token
        text platform
        timestamp last_seen
    }

    OFFER_IMPRESSIONS {
        bigint id PK
        bigint product_id FK
        uuid viewer_id FK
        timestamp created_at
    }

    GOV_PRICES {
        bigint id PK
        text commodity
        text variety
        text unit
        numeric min_price
        numeric max_price
        numeric avg_price
        date price_date
        text source
        timestamp created_at
    }

    VARIETIES {
        bigint id PK
        text product_name
        text variety
        text category
        timestamp created_at
    }

    PROFILES ||--o{ BUY_OFFERS : "manages"
    PROFILES ||--o{ BOOKINGS : "buys/sells"
    PROFILES ||--o{ FOLLOWS : "follows/followed"
    PROFILES ||--o{ CHAT_ROOMS : "initiates"
    PROFILES ||--o{ CHAT_MESSAGES : "sends"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    PROFILES ||--o| NOTIFICATION_SETTINGS : "configures"
    PROFILES ||--o{ DEVICE_SESSIONS : "authenticates"
    PROFILES ||--o{ OFFER_IMPRESSIONS : "views"

    BUY_OFFERS ||--o{ OFFER_SLOTS : "defines"
    BUY_OFFERS ||--o{ BOOKINGS : "is_reserved_for"
    BUY_OFFERS ||--o{ OFFER_GRADES : "specifies"
    BUY_OFFERS ||--o{ OFFER_IMPRESSIONS : "logs"

    OFFER_SLOTS ||--o{ BOOKINGS : "holds"
    CHAT_ROOMS ||--o{ CHAT_MESSAGES : "contains"
```
