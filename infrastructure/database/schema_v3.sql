-- ============================================================
-- AgriPrice v3 — schema_v3.sql
-- Normalized and Refactored Schema
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  profile_id      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           TEXT          NOT NULL,
  first_name      TEXT          NOT NULL,
  last_name       TEXT          NOT NULL,
  role            TEXT          NOT NULL CHECK (role IN ('buyer', 'farmer')),
  password_hash   TEXT,
  avatar          TEXT,
  tagline         TEXT,
  about           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  map_link        TEXT,
  links           JSONB         DEFAULT '[]',
  hero_image      TEXT,
  followers_count INTEGER       DEFAULT 0,
  tier            TEXT          DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Buy Offers (Formerly Products) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.buy_offers (
  id          BIGSERIAL     PRIMARY KEY,
  buyer_id    UUID          NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  title       TEXT          NOT NULL, -- Formerly 'name'
  description TEXT,
  base_price  NUMERIC(12,2) NOT NULL DEFAULT 0, -- Formerly 'price'
  unit        TEXT          NOT NULL DEFAULT 'กก.',
  category    TEXT          NOT NULL,
  variety     TEXT,
  image_url   TEXT,         -- Formerly 'image'
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Offer Grades (Formerly Product Grades) ───────────────────
CREATE TABLE IF NOT EXISTS public.offer_grades (
  id          BIGSERIAL     PRIMARY KEY,
  offer_id    BIGINT        NOT NULL REFERENCES public.buy_offers(id) ON DELETE CASCADE,
  grade_name  TEXT          NOT NULL, -- e.g., 'Grade A'
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Offer Slots (Formerly Product Slots) ─────────────────────
CREATE TABLE IF NOT EXISTS public.offer_slots (
  id           BIGSERIAL   PRIMARY KEY,
  offer_id     BIGINT      NOT NULL REFERENCES public.buy_offers(id) ON DELETE CASCADE,
  slot_name    TEXT        NOT NULL,
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  time_start   TIME        NOT NULL,
  time_end     TIME        NOT NULL,
  capacity     INTEGER     NOT NULL DEFAULT 1,
  booked_count INTEGER     NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bookings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id              BIGSERIAL   PRIMARY KEY,
  booking_no      TEXT        NOT NULL UNIQUE,
  buyer_id        UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  farmer_id       UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  offer_id        BIGINT      REFERENCES public.buy_offers(id) ON DELETE SET NULL,
  slot_id         BIGINT      REFERENCES public.offer_slots(id) ON DELETE SET NULL,
  queue_no        TEXT,
  scheduled_time  TIMESTAMPTZ NOT NULL,
  vehicle_info    TEXT,       -- Formerly vehicle_count, now more descriptive
  expected_qty    NUMERIC(12,2),
  note            TEXT,
  status          TEXT        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','confirmed','success','cancel')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chat & Social (Mostly same structure, updated for consistency) ──
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id         BIGSERIAL   PRIMARY KEY,
  user1_id   UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  user2_id   UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         BIGSERIAL   PRIMARY KEY,
  room_id    BIGINT      NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  message    TEXT,
  image_url  TEXT,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'general',
  title       TEXT        NOT NULL,
  description TEXT,
  link        TEXT,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.follows (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id  UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
    following_id UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- ── Varieties (Seed data) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.varieties (
  id           BIGSERIAL  PRIMARY KEY,
  product_name TEXT       NOT NULL,
  variety      TEXT       NOT NULL,
  UNIQUE (product_name, variety)
);

INSERT INTO public.varieties (product_name, variety) VALUES
  ('ทุเรียน',  'หมอนทอง'), ('ทุเรียน',  'ชะนี'), ('ทุเรียน',  'กระดุม'),
  ('มังคุด',   'มังคุดพื้นเมือง'), ('ลำไย',     'อีดอ'), ('ลำไย',     'สีชมพู'),
  ('ยางพารา',  'RRIM600'), ('ยางพารา',  'PB235'), ('ปาล์ม',    'เทเนอร่า'),
  ('ผักสด',    'ผักกาดขาว'), ('ผักสด',    'คะน้า')
ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_buy_offers_buyer_id  ON public.buy_offers(buyer_id);
CREATE INDEX idx_buy_offers_category  ON public.buy_offers(category);
CREATE INDEX idx_bookings_buyer_id    ON public.bookings(buyer_id);
CREATE INDEX idx_bookings_farmer_id   ON public.bookings(farmer_id);
CREATE INDEX idx_bookings_status      ON public.bookings(status);
CREATE INDEX idx_notifications_user   ON public.notifications(user_id, is_read);

-- ── Triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at   BEFORE UPDATE ON public.profiles   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_buy_offers_updated_at BEFORE UPDATE ON public.buy_offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated_at   BEFORE UPDATE ON public.bookings   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
