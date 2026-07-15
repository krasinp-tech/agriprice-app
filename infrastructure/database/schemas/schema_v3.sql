-- ============================================================
-- AgriPrice current normalized schema reference
-- For documentation/submission. For an existing Supabase project,
-- run migrations/final_teacher_normalization_migration.sql instead.
-- ============================================================

CREATE TABLE public.profiles (
  profile_id uuid NOT NULL,
  phone text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'buyer')),
  password_hash text,
  avatar text,
  tagline text,
  about text,
  address_line1 text,
  address_line2 text,
  map_link text,
  hero_image text,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  last_seen timestamptz DEFAULT now(),
  email text,
  birth_date date,
  account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'disabled')),
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  pro_started_at timestamptz,
  pro_expires_at timestamptz,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id)
);

CREATE TABLE public.products (
  product_id bigserial NOT NULL,
  product_name text NOT NULL UNIQUE,
  category text NOT NULL,
  CONSTRAINT products_pkey PRIMARY KEY (product_id)
);

CREATE TABLE public.varieties (
  variety_id bigserial NOT NULL,
  product_id bigint NOT NULL,
  variety_name text NOT NULL,
  CONSTRAINT varieties_pkey PRIMARY KEY (variety_id),
  CONSTRAINT varieties_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id),
  CONSTRAINT varieties_product_id_variety_name_key UNIQUE (product_id, variety_name)
);

CREATE TABLE public.buy_offers (
  offer_id bigserial NOT NULL,
  user_id uuid,
  variety_id bigint,
  description text,
  unit text DEFAULT 'กก.',
  image text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT buy_offers_pkey PRIMARY KEY (offer_id),
  CONSTRAINT buy_offers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT buy_offers_variety_id_fkey FOREIGN KEY (variety_id) REFERENCES public.varieties(variety_id)
);

CREATE TABLE public.offer_grades (
  id bigserial NOT NULL,
  offer_id bigint NOT NULL,
  grade_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT offer_grades_pkey PRIMARY KEY (id),
  CONSTRAINT offer_grades_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.buy_offers(offer_id),
  CONSTRAINT offer_grades_offer_id_grade_name_key UNIQUE (offer_id, grade_name)
);

CREATE TABLE public.offer_slots (
  slot_id bigserial NOT NULL,
  offer_id bigint,
  slot_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  time_start time NOT NULL,
  time_end time NOT NULL,
  capacity integer NOT NULL DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT offer_slots_pkey PRIMARY KEY (slot_id),
  CONSTRAINT offer_slots_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.buy_offers(offer_id)
);

CREATE TABLE public.bookings (
  booking_id bigserial NOT NULL,
  booking_no text NOT NULL UNIQUE,
  farmer_id uuid,
  slot_id bigint,
  queue_no text,
  scheduled_time timestamptz NOT NULL,
  note text,
  address text,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'success', 'cancel')),
  cancel_by text CHECK (cancel_by IS NULL OR cancel_by IN ('farmer', 'buyer')),
  cancel_reason text,
  quantity numeric,
  contact_name text,
  contact_phone text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bookings_pkey PRIMARY KEY (booking_id),
  CONSTRAINT bookings_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.offer_slots(slot_id)
);

CREATE TABLE public.booking_vehicles (
  id bigserial NOT NULL,
  booking_id bigint NOT NULL,
  plate_no text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT booking_vehicles_pkey PRIMARY KEY (id),
  CONSTRAINT booking_vehicles_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id),
  CONSTRAINT booking_vehicles_booking_id_plate_no_key UNIQUE (booking_id, plate_no)
);

CREATE TABLE public.booking_queue_sequences (
  slot_id bigint NOT NULL,
  queue_date date NOT NULL,
  next_sequence integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT booking_queue_sequences_pkey PRIMARY KEY (slot_id, queue_date),
  CONSTRAINT booking_queue_sequences_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.offer_slots(slot_id) ON DELETE CASCADE
);

CREATE TABLE public.profile_links (
  id bigserial NOT NULL,
  profile_id uuid NOT NULL,
  link_type text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT profile_links_pkey PRIMARY KEY (id),
  CONSTRAINT profile_links_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT profile_links_profile_id_link_type_url_key UNIQUE (profile_id, link_type, url)
);

CREATE TABLE public.profile_services (
  id bigserial NOT NULL,
  profile_id uuid NOT NULL,
  service_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT profile_services_pkey PRIMARY KEY (id),
  CONSTRAINT profile_services_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT profile_services_profile_id_service_name_key UNIQUE (profile_id, service_name)
);

CREATE TABLE public.chat_rooms (
  room_id bigserial NOT NULL,
  user1_id uuid,
  user2_id uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chat_rooms_pkey PRIMARY KEY (room_id),
  CONSTRAINT chat_rooms_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT chat_rooms_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT chat_rooms_user1_id_user2_id_key UNIQUE (user1_id, user2_id)
);

CREATE TABLE public.chat_messages (
  message_id bigserial NOT NULL,
  room_id bigint,
  sender_id uuid,
  message text,
  image_url text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id),
  CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(profile_id)
);

CREATE TABLE public.chat_room_deletions (
  room_id bigint NOT NULL,
  user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_room_deletions_pkey PRIMARY KEY (room_id, user_id),
  CONSTRAINT chat_room_deletions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE,
  CONSTRAINT chat_room_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id) ON DELETE CASCADE
);

CREATE TABLE public.notifications (
  notification_id bigserial NOT NULL,
  user_id uuid,
  type text,
  title text,
  description text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id)
);

CREATE TABLE public.notification_settings (
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'guest',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id)
);

CREATE TABLE public.device_sessions (
  session_id bigserial NOT NULL,
  user_id uuid NOT NULL,
  device_name text,
  device_icon text,
  ip_address text,
  user_agent text,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  push_token text,
  platform text,
  last_seen timestamptz,
  CONSTRAINT device_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT device_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token)
);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(profile_id),
  CONSTRAINT follows_not_self CHECK (follower_id <> following_id)
);

CREATE TABLE public.profile_favorites (
  owner_id uuid NOT NULL,
  target_profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_favorites_pkey PRIMARY KEY (owner_id, target_profile_id),
  CONSTRAINT profile_favorites_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  CONSTRAINT profile_favorites_target_profile_id_fkey FOREIGN KEY (target_profile_id) REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  CONSTRAINT profile_favorites_not_self CHECK (owner_id <> target_profile_id)
);

CREATE TABLE public.payment_submissions (
  payment_id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'pro',
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'promptpay',
  slip_url text,
  trans_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verification_data jsonb,
  verification_error text,
  review_note text,
  verified_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(profile_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offer_impressions (
  id bigserial NOT NULL,
  offer_id bigint NOT NULL,
  viewer_id uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT offer_impressions_pkey PRIMARY KEY (id),
  CONSTRAINT offer_impressions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.buy_offers(offer_id),
  CONSTRAINT offer_impressions_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.profiles(profile_id)
);

CREATE TABLE public.gov_prices (
  id bigserial NOT NULL,
  commodity text NOT NULL,
  variety text NOT NULL,
  unit text NOT NULL DEFAULT 'กก.',
  min_price numeric,
  max_price numeric,
  avg_price numeric,
  price_date date NOT NULL,
  source text DEFAULT 'government',
  category text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT gov_prices_pkey PRIMARY KEY (id)
);

CREATE TABLE public.reviews (
  id bigserial NOT NULL,
  user_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  CONSTRAINT reviews_user_id_reviewer_id_key UNIQUE (user_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_buy_offers_user_id ON public.buy_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_buy_offers_variety_id ON public.buy_offers(variety_id);
CREATE INDEX IF NOT EXISTS idx_offer_slots_offer_id ON public.offer_slots(offer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_farmer_id ON public.bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_booking_vehicles_booking_id ON public.booking_vehicles(booking_id);
CREATE INDEX IF NOT EXISTS idx_offer_impressions_offer_id ON public.offer_impressions(offer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS profiles_pro_expires_idx
  ON public.profiles(pro_expires_at) WHERE tier = 'pro';
CREATE INDEX IF NOT EXISTS idx_follows_following_id
  ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_profile_favorites_target
  ON public.profile_favorites(target_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_trans_ref_unique
  ON public.payment_submissions(trans_ref) WHERE trans_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_submissions_user_created_idx
  ON public.payment_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_impressions_viewer_created
  ON public.offer_impressions(viewer_id, created_at DESC)
  WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_unordered_user_pair_idx
  ON public.chat_rooms (
    (CASE WHEN user1_id::text <= user2_id::text THEN user1_id ELSE user2_id END),
    (CASE WHEN user1_id::text <= user2_id::text THEN user2_id ELSE user1_id END)
  )
  WHERE user1_id IS NOT NULL
    AND user2_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_room_deletions_user_room
  ON public.chat_room_deletions(user_id, room_id);

COMMENT ON TABLE public.offer_slots IS
  'Slots for buy offers. booked_count is not stored; it is derived from bookings.';

COMMENT ON TABLE public.bookings IS
  'Bookings reference slot_id only. Offer owner and product data are derived through slot_id -> offer_slots.offer_id -> buy_offers.';

COMMENT ON TABLE public.booking_queue_sequences IS
  'Atomic per-slot per-day booking queue sequence state.';

CREATE OR REPLACE FUNCTION public.next_queue_sequence(p_slot_id bigint, p_date date)
RETURNS integer AS $$
DECLARE
  v_existing_max integer := 0;
  v_sequence integer;
BEGIN
  IF p_slot_id IS NULL THEN
    RAISE EXCEPTION 'p_slot_id is required';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'p_date is required';
  END IF;

  SELECT COALESCE(MAX((substring(queue_no FROM '([0-9]+)$'))::integer), 0)
    INTO v_existing_max
  FROM public.bookings
  WHERE slot_id = p_slot_id
    AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::date = p_date;

  INSERT INTO public.booking_queue_sequences (slot_id, queue_date, next_sequence, updated_at)
  VALUES (p_slot_id, p_date, v_existing_max + 2, now())
  ON CONFLICT (slot_id, queue_date)
  DO UPDATE SET
    next_sequence = GREATEST(public.booking_queue_sequences.next_sequence + 1, EXCLUDED.next_sequence),
    updated_at = now()
  RETURNING next_sequence - 1 INTO v_sequence;

  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.next_queue_sequence(bigint, date) IS
  'Returns the next queue sequence for one offer slot on one Bangkok date.';

CREATE OR REPLACE FUNCTION public.increment_follower_count(target_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.profiles
  SET followers_count = COALESCE(followers_count, 0) + 1
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_following_count(target_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.profiles
  SET following_count = COALESCE(following_count, 0) + 1
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_follower_count(target_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.profiles
  SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_following_count(target_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.profiles
  SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.reject_own_offer_impression()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.viewer_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.buy_offers
    WHERE offer_id = NEW.offer_id
      AND user_id = NEW.viewer_id
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_own_offer_impression
  BEFORE INSERT ON public.offer_impressions
  FOR EACH ROW EXECUTE FUNCTION public.reject_own_offer_impression();
