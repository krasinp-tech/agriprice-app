-- ============================================================
-- AgriPrice final submission constraint verification
-- Safe to run repeatedly in Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.varieties') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.varieties'::regclass
         AND conname = 'varieties_product_id_variety_name_key'
     ) THEN
    ALTER TABLE public.varieties
      ADD CONSTRAINT varieties_product_id_variety_name_key UNIQUE (product_id, variety_name);
  END IF;

  IF to_regclass('public.offer_grades') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.offer_grades'::regclass
         AND conname = 'offer_grades_offer_id_grade_name_key'
     ) THEN
    ALTER TABLE public.offer_grades
      ADD CONSTRAINT offer_grades_offer_id_grade_name_key UNIQUE (offer_id, grade_name);
  END IF;

  IF to_regclass('public.booking_vehicles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.booking_vehicles'::regclass
         AND conname = 'booking_vehicles_booking_id_plate_no_key'
     ) THEN
    ALTER TABLE public.booking_vehicles
      ADD CONSTRAINT booking_vehicles_booking_id_plate_no_key UNIQUE (booking_id, plate_no);
  END IF;

  IF to_regclass('public.profile_links') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.profile_links'::regclass
         AND conname = 'profile_links_profile_id_link_type_url_key'
     ) THEN
    ALTER TABLE public.profile_links
      ADD CONSTRAINT profile_links_profile_id_link_type_url_key UNIQUE (profile_id, link_type, url);
  END IF;

  IF to_regclass('public.profile_services') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.profile_services'::regclass
         AND conname = 'profile_services_profile_id_service_name_key'
     ) THEN
    ALTER TABLE public.profile_services
      ADD CONSTRAINT profile_services_profile_id_service_name_key UNIQUE (profile_id, service_name);
  END IF;

  IF to_regclass('public.reviews') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.reviews'::regclass
         AND conname = 'reviews_user_id_reviewer_id_key'
     ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_user_id_reviewer_id_key UNIQUE (user_id, reviewer_id);
  END IF;

  IF to_regclass('public.chat_rooms') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.chat_rooms'::regclass
         AND conname = 'chat_rooms_user1_id_user2_id_key'
     ) THEN
    ALTER TABLE public.chat_rooms
      ADD CONSTRAINT chat_rooms_user1_id_user2_id_key UNIQUE (user1_id, user2_id);
  END IF;

  IF to_regclass('public.device_sessions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.device_sessions'::regclass
         AND conname = 'unique_user_push_token'
     ) THEN
    ALTER TABLE public.device_sessions
      ADD CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token);
  END IF;
END $$;

WITH expected(table_name, constraint_name) AS (
  VALUES
    ('booking_queue_sequences', 'booking_queue_sequences_pkey'),
    ('varieties', 'varieties_product_id_variety_name_key'),
    ('offer_grades', 'offer_grades_offer_id_grade_name_key'),
    ('booking_vehicles', 'booking_vehicles_booking_id_plate_no_key'),
    ('profile_links', 'profile_links_profile_id_link_type_url_key'),
    ('profile_services', 'profile_services_profile_id_service_name_key'),
    ('reviews', 'reviews_user_id_reviewer_id_key'),
    ('chat_rooms', 'chat_rooms_user1_id_user2_id_key'),
    ('device_sessions', 'unique_user_push_token'),
    ('follows', 'follows_not_self')
)
SELECT
  e.table_name,
  e.constraint_name,
  CASE WHEN c.oid IS NULL THEN 'missing' ELSE 'ok' END AS status,
  pg_get_constraintdef(c.oid) AS definition
FROM expected e
LEFT JOIN pg_class r
  ON r.relname = e.table_name
 AND r.relnamespace = 'public'::regnamespace
LEFT JOIN pg_constraint c
  ON c.conrelid = r.oid
 AND c.conname = e.constraint_name
ORDER BY e.table_name, e.constraint_name;

WITH expected_functions(function_name, identity_arguments) AS (
  VALUES
    ('next_queue_sequence', 'p_slot_id bigint, p_date date'),
    ('increment_follower_count', 'target_id uuid'),
    ('increment_following_count', 'target_id uuid'),
    ('decrement_follower_count', 'target_id uuid'),
    ('decrement_following_count', 'target_id uuid')
)
SELECT
  e.function_name,
  e.identity_arguments,
  CASE WHEN p.oid IS NULL THEN 'missing' ELSE 'ok' END AS status
FROM expected_functions e
LEFT JOIN pg_proc p
  ON p.pronamespace = 'public'::regnamespace
 AND p.proname = e.function_name
 AND pg_get_function_identity_arguments(p.oid) = e.identity_arguments
ORDER BY e.function_name;

WITH expected_indexes(table_name, index_name) AS (
  VALUES
    ('chat_rooms', 'chat_rooms_unordered_user_pair_idx'),
    ('profiles', 'profiles_pro_expires_idx'),
    ('follows', 'idx_follows_following_id'),
    ('profile_favorites', 'idx_profile_favorites_target'),
    ('payment_submissions', 'payment_submissions_trans_ref_unique'),
    ('payment_submissions', 'payment_submissions_user_created_idx'),
    ('offer_impressions', 'idx_offer_impressions_viewer_created')
)
SELECT
  e.table_name,
  e.index_name,
  CASE WHEN i.indexname IS NULL THEN 'missing' ELSE 'ok' END AS status,
  i.indexdef AS definition
FROM expected_indexes e
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.tablename = e.table_name
 AND i.indexname = e.index_name
ORDER BY e.table_name, e.index_name;

WITH expected_columns(table_name, column_name) AS (
  VALUES
    ('profiles', 'pro_started_at'),
    ('profiles', 'pro_expires_at'),
    ('notifications', 'link'),
    ('bookings', 'cancel_by'),
    ('bookings', 'cancel_reason')
)
SELECT
  e.table_name,
  e.column_name,
  CASE WHEN c.column_name IS NULL THEN 'missing' ELSE 'ok' END AS status,
  c.data_type
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;

WITH expected_triggers(table_name, trigger_name) AS (
  VALUES
    ('offer_impressions', 'prevent_own_offer_impression'),
    ('profiles', 'tr_profiles_updated_at'),
    ('buy_offers', 'tr_buy_offers_updated_at')
)
SELECT
  e.table_name,
  e.trigger_name,
  CASE WHEN t.trigger_name IS NULL THEN 'missing' ELSE 'ok' END AS status
FROM expected_triggers e
LEFT JOIN information_schema.triggers t
  ON t.event_object_schema = 'public'
 AND t.event_object_table = e.table_name
 AND t.trigger_name = e.trigger_name
ORDER BY e.table_name, e.trigger_name;
