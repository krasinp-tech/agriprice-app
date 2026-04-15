-- ============================================================
-- AgriPrice — schema.sql
-- รัน script นี้ใน Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Profiles ─────────────────────────────────────────────────
-- ลบ UNIQUE constraint และ index ที่ phone หากมีอยู่เดิม
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_type = 'UNIQUE' AND constraint_name LIKE '%phone%'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'idx_profiles_phone'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS idx_profiles_phone';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           TEXT          NOT NULL,
  first_name      TEXT          NOT NULL,
  last_name        TEXT          NOT NULL,
  role             TEXT          NOT NULL CHECK (role IN ('buyer', 'farmer')),
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
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          BIGSERIAL     PRIMARY KEY,
  user_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  description TEXT,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit        TEXT          NOT NULL DEFAULT 'กก.',
  grade       TEXT,
  quantity    INTEGER       NOT NULL DEFAULT 1,
  image       TEXT,
  category    TEXT          NOT NULL,
  variety     TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Product Grades ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_grades (
  id          BIGSERIAL     PRIMARY KEY,
  product_id  BIGINT        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  grade       TEXT          NOT NULL,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Varieties ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.varieties (
  id           BIGSERIAL  PRIMARY KEY,
  product_name TEXT       NOT NULL,
  variety      TEXT       NOT NULL,
  UNIQUE (product_name, variety)
);

-- seed ตัวอย่างพันธุ์ผลไม้
INSERT INTO public.varieties (product_name, variety) VALUES
  ('ทุเรียน',  'หมอนทอง'),
  ('ทุเรียน',  'ชะนี'),
  ('ทุเรียน',  'กระดุม'),
  ('มังคุด',   'มังคุดพื้นเมือง'),
  ('ลำไย',     'อีดอ'),
  ('ลำไย',     'สีชมพู'),
  ('ยางพารา',  'RRIM600'),
  ('ยางพารา',  'PB235'),
  ('ปาล์ม',    'เทเนอร่า'),
  ('ผักสด',    'ผักกาดขาว'),
  ('ผักสด',    'คะน้า')
ON CONFLICT DO NOTHING;

-- ── Product Slots ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_slots (
  id           BIGSERIAL   PRIMARY KEY,
  product_id   BIGINT      NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
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
  buyer_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  farmer_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id      BIGINT      REFERENCES public.products(id) ON DELETE SET NULL,
  slot_id         BIGINT      REFERENCES public.product_slots(id) ON DELETE SET NULL,
  queue_no        TEXT,
  scheduled_time  TIMESTAMPTZ NOT NULL,
  vehicle_count   INTEGER     NOT NULL DEFAULT 1,
  quantity        NUMERIC(12,2),
  note            TEXT,
  address         TEXT,
  status          TEXT        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','success','cancel')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chat Rooms ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id         BIGSERIAL   PRIMARY KEY,
  user1_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user1_id, user2_id)
);

-- ── Chat Messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         BIGSERIAL   PRIMARY KEY,
  room_id    BIGINT      NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message    TEXT,
  image_url  TEXT,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'general',
  title       TEXT        NOT NULL,
  description TEXT,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notification Settings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id     UUID        PRIMARY KEY,
  role        TEXT        NOT NULL DEFAULT 'guest',
  settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reviews ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, reviewer_id)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_user_id     ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category    ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active   ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id    ON public.bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_farmer_id   ON public.bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status      ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room   ON public.chat_messages(room_id, created_at);
-- ไม่สร้าง index ที่ phone เพื่อให้สมัครซ้ำได้

-- ── Updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
    CREATE TRIGGER trg_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at') THEN
    CREATE TRIGGER trg_products_updated_at
      BEFORE UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_updated_at') THEN
    CREATE TRIGGER trg_bookings_updated_at
      BEFORE UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;