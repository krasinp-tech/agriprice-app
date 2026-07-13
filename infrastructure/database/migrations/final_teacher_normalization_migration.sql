-- ============================================================
-- AgriPrice - final teacher normalization migration
-- Run this in Supabase SQL Editor.
--
-- Main changes:
-- 1) offer_slots.booked_count is removed and derived from bookings.
-- 2) buy_offers.product_id is renamed to offer_id because it is an offer id.
-- 3) offer_slots and offer_impressions reference offer_id.
-- 4) bookings no longer stores farmer_id/product_id/offer_id because those
--    are derived through slot_id -> offer_slots.offer_id -> buy_offers.user_id.
-- 5) vehicle plates, profile links, and profile services are normalized.
-- 6) products and varieties keep product/variety names only once.
-- ============================================================

BEGIN;

-- Helper for safe text/jsonb migrations. Dropped at the end.
CREATE OR REPLACE FUNCTION public._agriprice_try_jsonb(p_value text)
RETURNS jsonb AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;

  RETURN p_value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 1) OFFER_SLOTS: booked_count is a derived value.
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.offer_slots
  DROP COLUMN IF EXISTS booked_count;

CREATE OR REPLACE FUNCTION public.increment_booked_count(p_slot_id bigint)
RETURNS void AS $$
BEGIN
  -- No-op. booked_count is derived from public.bookings.
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_booked_count(p_slot_id bigint)
RETURNS void AS $$
BEGIN
  -- No-op. booked_count is derived from public.bookings.
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_booked_count_safe(p_slot_id bigint, p_date date)
RETURNS TABLE (success boolean, message text) AS $$
DECLARE
  v_capacity integer;
  v_booked integer;
BEGIN
  SELECT capacity
    INTO v_capacity
  FROM public.offer_slots
  WHERE slot_id = p_slot_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN QUERY SELECT false, 'Slot not found'::text;
    RETURN;
  END IF;

  SELECT COUNT(*)::integer
    INTO v_booked
  FROM public.bookings
  WHERE slot_id = p_slot_id
    AND COALESCE(status, '') <> 'cancel'
    AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::date = p_date;

  IF v_booked >= v_capacity THEN
    RETURN QUERY SELECT false, 'Slot is full'::text;
  ELSE
    RETURN QUERY SELECT true, 'OK'::text;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 2) Booking vehicles: one vehicle plate per row.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_vehicles (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
  plate_no TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'vehicle_plates'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.booking_vehicles (booking_id, plate_no)
      SELECT DISTINCT b.booking_id, btrim(v.plate_no)
      FROM public.bookings b
      CROSS JOIN LATERAL regexp_split_to_table(COALESCE(b.vehicle_plates::text, ''), '\s*[,;\n]\s*') AS v(plate_no)
      WHERE btrim(v.plate_no) <> ''
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;
END $$;

DELETE FROM public.booking_vehicles a
USING public.booking_vehicles b
WHERE a.booking_id = b.booking_id
  AND btrim(a.plate_no) = btrim(b.plate_no)
  AND a.id > b.id;

UPDATE public.booking_vehicles
SET plate_no = btrim(plate_no)
WHERE plate_no IS DISTINCT FROM btrim(plate_no);

DELETE FROM public.booking_vehicles
WHERE plate_no IS NULL OR btrim(plate_no) = '';

DELETE FROM public.booking_vehicles a
USING public.booking_vehicles b
WHERE a.booking_id = b.booking_id
  AND a.plate_no = b.plate_no
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.booking_vehicles'::regclass
      AND conname = 'booking_vehicles_booking_id_plate_no_key'
  ) THEN
    ALTER TABLE public.booking_vehicles
      ADD CONSTRAINT booking_vehicles_booking_id_plate_no_key UNIQUE (booking_id, plate_no);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) Profile links and services: atomic values instead of text blobs.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_links (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profile_services (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'links'
  ) THEN
    EXECUTE $sql$
      WITH src AS (
        SELECT
          profile_id,
          NULLIF(btrim(links::text), '') AS raw_links,
          public._agriprice_try_jsonb(links::text) AS links_json
        FROM public.profiles
        WHERE links IS NOT NULL
          AND NULLIF(btrim(links::text), '') IS NOT NULL
          AND btrim(links::text) <> '[]'
      ),
      json_items AS (
        SELECT s.profile_id, item
        FROM src s
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.links_json) = 'array' THEN s.links_json
            WHEN jsonb_typeof(s.links_json) = 'object' THEN jsonb_build_array(s.links_json)
            ELSE '[]'::jsonb
          END
        ) AS item
        WHERE s.links_json IS NOT NULL
      ),
      normalized AS (
        SELECT
          profile_id,
          COALESCE(item->>'type', item->>'link_type', 'website') AS link_type,
          COALESCE(
            item->>'url',
            item->>'href',
            CASE WHEN jsonb_typeof(item) = 'string' THEN trim(both '"' from item::text) END
          ) AS url
        FROM json_items
        UNION ALL
        SELECT
          profile_id,
          'website' AS link_type,
          trim(both '"' from links_json::text) AS url
        FROM src
        WHERE jsonb_typeof(links_json) = 'string'
        UNION ALL
        SELECT
          s.profile_id,
          'website' AS link_type,
          btrim(x.url_part) AS url
        FROM src s
        CROSS JOIN LATERAL regexp_split_to_table(s.raw_links, '\s*[,;\n]\s*') AS x(url_part)
        WHERE s.links_json IS NULL
      )
      INSERT INTO public.profile_links (profile_id, link_type, url)
      SELECT DISTINCT
        profile_id,
        COALESCE(NULLIF(btrim(link_type), ''), 'website'),
        btrim(url)
      FROM normalized
      WHERE url IS NOT NULL
        AND btrim(url) <> ''
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'services'
  ) THEN
    EXECUTE $sql$
      WITH src AS (
        SELECT
          profile_id,
          NULLIF(btrim(services::text), '') AS raw_services,
          public._agriprice_try_jsonb(services::text) AS services_json
        FROM public.profiles
        WHERE services IS NOT NULL
          AND NULLIF(btrim(services::text), '') IS NOT NULL
          AND btrim(services::text) <> '[]'
      ),
      json_items AS (
        SELECT s.profile_id, item
        FROM src s
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s.services_json) = 'array' THEN s.services_json
            WHEN jsonb_typeof(s.services_json) = 'object' THEN jsonb_build_array(s.services_json)
            ELSE '[]'::jsonb
          END
        ) AS item
        WHERE s.services_json IS NOT NULL
      ),
      normalized AS (
        SELECT
          profile_id,
          COALESCE(
            item->>'service_name',
            item->>'name',
            item->>'service',
            CASE WHEN jsonb_typeof(item) = 'string' THEN trim(both '"' from item::text) END
          ) AS service_name
        FROM json_items
        UNION ALL
        SELECT
          profile_id,
          trim(both '"' from services_json::text) AS service_name
        FROM src
        WHERE jsonb_typeof(services_json) = 'string'
        UNION ALL
        SELECT
          s.profile_id,
          btrim(x.service_part) AS service_name
        FROM src s
        CROSS JOIN LATERAL regexp_split_to_table(s.raw_services, '\s*[,;\n]\s*') AS x(service_part)
        WHERE s.services_json IS NULL
      )
      INSERT INTO public.profile_services (profile_id, service_name)
      SELECT DISTINCT profile_id, btrim(service_name)
      FROM normalized
      WHERE service_name IS NOT NULL
        AND btrim(service_name) <> ''
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;
END $$;

DELETE FROM public.profile_links a
USING public.profile_links b
WHERE a.profile_id = b.profile_id
  AND COALESCE(NULLIF(btrim(a.link_type), ''), 'website') = COALESCE(NULLIF(btrim(b.link_type), ''), 'website')
  AND btrim(a.url) = btrim(b.url)
  AND a.id > b.id;

UPDATE public.profile_links
SET link_type = COALESCE(NULLIF(btrim(link_type), ''), 'website'),
    url = btrim(url)
WHERE link_type IS DISTINCT FROM COALESCE(NULLIF(btrim(link_type), ''), 'website')
   OR url IS DISTINCT FROM btrim(url);

DELETE FROM public.profile_links
WHERE url IS NULL OR btrim(url) = '';

DELETE FROM public.profile_links a
USING public.profile_links b
WHERE a.profile_id = b.profile_id
  AND a.link_type = b.link_type
  AND a.url = b.url
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profile_links'::regclass
      AND conname = 'profile_links_profile_id_link_type_url_key'
  ) THEN
    ALTER TABLE public.profile_links
      ADD CONSTRAINT profile_links_profile_id_link_type_url_key UNIQUE (profile_id, link_type, url);
  END IF;
END $$;

DELETE FROM public.profile_services a
USING public.profile_services b
WHERE a.profile_id = b.profile_id
  AND btrim(a.service_name) = btrim(b.service_name)
  AND a.id > b.id;

UPDATE public.profile_services
SET service_name = btrim(service_name)
WHERE service_name IS DISTINCT FROM btrim(service_name);

DELETE FROM public.profile_services
WHERE service_name IS NULL OR btrim(service_name) = '';

DELETE FROM public.profile_services a
USING public.profile_services b
WHERE a.profile_id = b.profile_id
  AND a.service_name = b.service_name
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profile_services'::regclass
      AND conname = 'profile_services_profile_id_service_name_key'
  ) THEN
    ALTER TABLE public.profile_services
      ADD CONSTRAINT profile_services_profile_id_service_name_key UNIQUE (profile_id, service_name);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) Products and varieties: product/category/variety names live once.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  product_id BIGSERIAL PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.varieties (
  variety_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
  variety_name TEXT NOT NULL
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'category'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.products (product_name, category)
      SELECT DISTINCT btrim(name), COALESCE(NULLIF(btrim(category), ''), btrim(name))
      FROM public.buy_offers
      WHERE name IS NOT NULL
        AND btrim(name) <> ''
      ON CONFLICT (product_name) DO UPDATE
        SET category = EXCLUDED.category
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'variety_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'variety'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.varieties (product_id, variety_name)
      SELECT DISTINCT p.product_id, COALESCE(NULLIF(btrim(b.variety), ''), btrim(b.name))
      FROM public.buy_offers b
      JOIN public.products p ON p.product_name = btrim(b.name)
      WHERE b.name IS NOT NULL
        AND btrim(b.name) <> ''
      ON CONFLICT DO NOTHING;

      UPDATE public.buy_offers b
      SET variety_id = v.variety_id
      FROM public.products p
      JOIN public.varieties v ON v.product_id = p.product_id
      WHERE p.product_name = btrim(b.name)
        AND v.variety_name = COALESCE(NULLIF(btrim(b.variety), ''), btrim(b.name))
        AND b.variety_id IS NULL
    $sql$;
  END IF;
END $$;

DELETE FROM public.products a
USING public.products b
WHERE btrim(a.product_name) = btrim(b.product_name)
  AND a.product_id > b.product_id;

UPDATE public.products
SET product_name = btrim(product_name),
    category = btrim(category)
WHERE product_name IS DISTINCT FROM btrim(product_name)
   OR category IS DISTINCT FROM btrim(category);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_product_name_key'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_name_key UNIQUE (product_name);
  END IF;
END $$;

DELETE FROM public.varieties
WHERE variety_name IS NULL OR btrim(variety_name) = '';

DELETE FROM public.varieties a
USING public.varieties b
WHERE a.product_id = b.product_id
  AND btrim(a.variety_name) = btrim(b.variety_name)
  AND a.variety_id > b.variety_id;

UPDATE public.varieties
SET variety_name = btrim(variety_name)
WHERE variety_name IS DISTINCT FROM btrim(variety_name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.varieties'::regclass
      AND conname = 'varieties_product_id_variety_name_key'
  ) THEN
    ALTER TABLE public.varieties
      ADD CONSTRAINT varieties_product_id_variety_name_key UNIQUE (product_id, variety_name);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5) Rename offer identifiers so product_id means catalog product only.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'product_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'offer_id'
  ) THEN
    ALTER TABLE public.buy_offers RENAME COLUMN product_id TO offer_id;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.products_id_seq') IS NOT NULL
     AND to_regclass('public.buy_offers_offer_id_seq') IS NULL THEN
    ALTER SEQUENCE public.products_id_seq RENAME TO buy_offers_offer_id_seq;
  END IF;

  IF to_regclass('public.buy_offers_offer_id_seq') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'offer_id'
     ) THEN
    ALTER SEQUENCE public.buy_offers_offer_id_seq OWNED BY public.buy_offers.offer_id;
    ALTER TABLE public.buy_offers
      ALTER COLUMN offer_id SET DEFAULT nextval('public.buy_offers_offer_id_seq'::regclass);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_slots' AND column_name = 'product_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_slots' AND column_name = 'offer_id'
  ) THEN
    ALTER TABLE public.offer_slots RENAME COLUMN product_id TO offer_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_impressions' AND column_name = 'product_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_impressions' AND column_name = 'offer_id'
  ) THEN
    ALTER TABLE public.offer_impressions RENAME COLUMN product_id TO offer_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.buy_offers'::regclass
      AND conname = 'products_user_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.buy_offers'::regclass
      AND conname = 'buy_offers_user_id_fkey'
  ) THEN
    ALTER TABLE public.buy_offers
      RENAME CONSTRAINT products_user_id_fkey TO buy_offers_user_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.offer_slots'::regclass
      AND conname = 'product_slots_product_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.offer_slots'::regclass
      AND conname = 'offer_slots_offer_id_fkey'
  ) THEN
    ALTER TABLE public.offer_slots
      RENAME CONSTRAINT product_slots_product_id_fkey TO offer_slots_offer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.offer_impressions'::regclass
      AND conname = 'product_impressions_product_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.offer_impressions'::regclass
      AND conname = 'offer_impressions_offer_id_fkey'
  ) THEN
    ALTER TABLE public.offer_impressions
      RENAME CONSTRAINT product_impressions_product_id_fkey TO offer_impressions_offer_id_fkey;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) Offer grades belong to an offer, not a catalog product.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_grades (
  id BIGSERIAL PRIMARY KEY,
  offer_id BIGINT NOT NULL REFERENCES public.buy_offers(offer_id) ON DELETE CASCADE,
  grade_name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'grades'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.offer_grades (offer_id, grade_name, price)
      SELECT DISTINCT
        b.offer_id,
        COALESCE(NULLIF(btrim(x.grade_name), ''), NULLIF(btrim(x.grade), ''), 'mixed') AS grade_name,
        COALESCE(x.price, 0) AS price
      FROM public.buy_offers b
      CROSS JOIN LATERAL jsonb_to_recordset(
        CASE
          WHEN jsonb_typeof(public._agriprice_try_jsonb(b.grades::text)) = 'array'
            THEN public._agriprice_try_jsonb(b.grades::text)
          ELSE '[]'::jsonb
        END
      ) AS x(grade text, grade_name text, price numeric)
      WHERE COALESCE(NULLIF(btrim(x.grade_name), ''), NULLIF(btrim(x.grade), '')) IS NOT NULL
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'grade'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buy_offers' AND column_name = 'price'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.offer_grades (offer_id, grade_name, price)
      SELECT DISTINCT
        offer_id,
        COALESCE(NULLIF(btrim(grade), ''), 'mixed') AS grade_name,
        COALESCE(price, 0) AS price
      FROM public.buy_offers
      WHERE grade IS NOT NULL OR price IS NOT NULL
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;
END $$;

DELETE FROM public.offer_grades a
USING public.offer_grades b
WHERE a.offer_id = b.offer_id
  AND btrim(a.grade_name) = btrim(b.grade_name)
  AND a.id > b.id;

UPDATE public.offer_grades
SET grade_name = btrim(grade_name)
WHERE grade_name IS DISTINCT FROM btrim(grade_name);

DELETE FROM public.offer_grades
WHERE grade_name IS NULL OR btrim(grade_name) = '';

DELETE FROM public.offer_grades a
USING public.offer_grades b
WHERE a.offer_id = b.offer_id
  AND a.grade_name = b.grade_name
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.offer_grades'::regclass
      AND conname = 'offer_grades_offer_id_grade_name_key'
  ) THEN
    ALTER TABLE public.offer_grades
      ADD CONSTRAINT offer_grades_offer_id_grade_name_key UNIQUE (offer_id, grade_name);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7) Remove duplicate/transitive columns after backfill.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_rows_without_slot integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'product_id'
  ) THEN
    EXECUTE $sql$
      SELECT COUNT(*)::integer
      FROM public.bookings
      WHERE slot_id IS NULL
        AND product_id IS NOT NULL
    $sql$ INTO v_rows_without_slot;

    IF v_rows_without_slot > 0 THEN
      RAISE NOTICE '% bookings have product_id but no slot_id. product_id will be removed for strict normalization.', v_rows_without_slot;
    END IF;
  END IF;
END $$;

-- Existing RLS policies can depend on duplicate/transitive columns such as
-- farmer_id/product_id. Drop only the affected booking policies before
-- removing those columns, then recreate normalized policies below.
DROP POLICY IF EXISTS bookings_r ON public.bookings;
DROP POLICY IF EXISTS bookings_i ON public.bookings;
DROP POLICY IF EXISTS bookings_u ON public.bookings;

DO $$
DECLARE
  v_policy_name text;
BEGIN
  FOR v_policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND (
        COALESCE(qual, '') ILIKE '%farmer_id%'
        OR COALESCE(with_check, '') ILIKE '%farmer_id%'
        OR COALESCE(qual, '') ILIKE '%product_id%'
        OR COALESCE(with_check, '') ILIKE '%product_id%'
        OR COALESCE(qual, '') ILIKE '%offer_id%'
        OR COALESCE(with_check, '') ILIKE '%offer_id%'
        OR COALESCE(qual, '') ILIKE '%vehicle_plates%'
        OR COALESCE(with_check, '') ILIKE '%vehicle_plates%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', v_policy_name);
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public.bookings
  DROP COLUMN IF EXISTS vehicle_plates,
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS offer_id,
  DROP COLUMN IF EXISTS farmer_id;

DROP POLICY IF EXISTS bookings_r ON public.bookings;
CREATE POLICY bookings_r ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.offer_slots os
      JOIN public.buy_offers bo ON bo.offer_id = os.offer_id
      WHERE os.slot_id = bookings.slot_id
        AND bo.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS bookings_i ON public.bookings;
CREATE POLICY bookings_i ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.offer_slots os
      JOIN public.buy_offers bo ON bo.offer_id = os.offer_id
      WHERE os.slot_id = bookings.slot_id
        AND bo.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS bookings_u ON public.bookings;
CREATE POLICY bookings_u ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.offer_slots os
      JOIN public.buy_offers bo ON bo.offer_id = os.offer_id
      WHERE os.slot_id = bookings.slot_id
        AND bo.user_id = auth.uid()
    )
  )
  WITH CHECK (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.offer_slots os
      JOIN public.buy_offers bo ON bo.offer_id = os.offer_id
      WHERE os.slot_id = bookings.slot_id
        AND bo.user_id = auth.uid()
    )
  );

ALTER TABLE IF EXISTS public.profiles
  DROP COLUMN IF EXISTS links,
  DROP COLUMN IF EXISTS services;

ALTER TABLE IF EXISTS public.buy_offers
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS variety,
  DROP COLUMN IF EXISTS grade,
  DROP COLUMN IF EXISTS price,
  DROP COLUMN IF EXISTS grades;

-- ------------------------------------------------------------
-- 8) Indexes and derived booked-count view.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.idx_offer_slots_product_id') IS NOT NULL
     AND to_regclass('public.idx_offer_slots_offer_id') IS NULL THEN
    ALTER INDEX public.idx_offer_slots_product_id RENAME TO idx_offer_slots_offer_id;
  END IF;

  IF to_regclass('public.idx_offer_impressions_product') IS NOT NULL
     AND to_regclass('public.idx_offer_impressions_offer') IS NULL THEN
    ALTER INDEX public.idx_offer_impressions_product RENAME TO idx_offer_impressions_offer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offer_slots_offer_id
  ON public.offer_slots(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_impressions_offer
  ON public.offer_impressions(offer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_slot_id
  ON public.bookings(slot_id);

CREATE INDEX IF NOT EXISTS idx_booking_vehicles_booking_id
  ON public.booking_vehicles(booking_id);

CREATE INDEX IF NOT EXISTS idx_profile_links_profile_id
  ON public.profile_links(profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_services_profile_id
  ON public.profile_services(profile_id);

CREATE INDEX IF NOT EXISTS idx_buy_offers_variety_id
  ON public.buy_offers(variety_id);

DROP VIEW IF EXISTS public.offer_slots_with_booked_count;

CREATE VIEW public.offer_slots_with_booked_count AS
SELECT
  os.slot_id,
  os.offer_id,
  os.slot_name,
  os.start_date,
  os.end_date,
  os.time_start,
  os.time_end,
  os.capacity,
  os.is_active,
  os.created_at,
  COUNT(b.booking_id) FILTER (WHERE COALESCE(b.status, '') <> 'cancel')::integer AS booked_count
FROM public.offer_slots os
LEFT JOIN public.bookings b ON b.slot_id = os.slot_id
GROUP BY
  os.slot_id,
  os.offer_id,
  os.slot_name,
  os.start_date,
  os.end_date,
  os.time_start,
  os.time_end,
  os.capacity,
  os.is_active,
  os.created_at;

COMMENT ON TABLE public.buy_offers IS
  'Buy offer rows. offer_id is the offer identity; product and variety names are stored in products/varieties.';

COMMENT ON COLUMN public.offer_slots.offer_id IS
  'References buy_offers.offer_id. booked_count is derived from bookings.';

COMMENT ON TABLE public.booking_vehicles IS
  'One vehicle plate per booking row.';

COMMENT ON VIEW public.offer_slots_with_booked_count IS
  'Derived booked_count per offer slot from bookings. This avoids storing duplicate counts.';

DROP FUNCTION IF EXISTS public._agriprice_try_jsonb(text);

COMMIT;
