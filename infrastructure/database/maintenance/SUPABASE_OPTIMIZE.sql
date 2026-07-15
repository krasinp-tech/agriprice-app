-- ============================================================
-- AgriPrice final database optimization for normalized schema
-- Safe to run repeatedly in Supabase SQL Editor.
-- ============================================================

-- Product catalog and varieties
CREATE INDEX IF NOT EXISTS idx_products_product_name_category
  ON public.products (product_name, category);

CREATE INDEX IF NOT EXISTS idx_varieties_product_id_name
  ON public.varieties (product_id, variety_name);

-- Offers and offer details
CREATE INDEX IF NOT EXISTS idx_buy_offers_user_active
  ON public.buy_offers (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_buy_offers_variety_id
  ON public.buy_offers (variety_id);

CREATE INDEX IF NOT EXISTS idx_offer_grades_offer_id
  ON public.offer_grades (offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_slots_offer_active_dates
  ON public.offer_slots (offer_id, is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_offer_slots_time
  ON public.offer_slots (time_start, time_end);

CREATE INDEX IF NOT EXISTS idx_offer_impressions_offer_created
  ON public.offer_impressions (offer_id, created_at DESC);

-- Bookings and queue pages
CREATE INDEX IF NOT EXISTS idx_bookings_slot_status_time
  ON public.bookings (slot_id, status, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_bookings_buyer_status_created
  ON public.bookings (farmer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_vehicles_booking_id
  ON public.booking_vehicles (booking_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_phone
  ON public.profiles (phone);

CREATE INDEX IF NOT EXISTS idx_profile_links_profile_id
  ON public.profile_links (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_services_profile_id
  ON public.profile_services (profile_id);

-- Chat and notifications
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time
  ON public.chat_messages (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user_seen
  ON public.device_sessions (user_id, last_seen DESC);

-- Government prices
CREATE INDEX IF NOT EXISTS idx_gov_prices_lookup
  ON public.gov_prices (commodity, variety, price_date DESC);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_user
  ON public.reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer
  ON public.reviews (reviewer_id);

-- Updated-at trigger for tables that have updated_at in the current schema.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tr_buy_offers_updated_at ON public.buy_offers;
CREATE TRIGGER tr_buy_offers_updated_at
  BEFORE UPDATE ON public.buy_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
