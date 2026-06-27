-- 1. Drop duplicate constraints (which will automatically drop their indexes)
ALTER TABLE public.chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_user1_id_user2_id_key;
ALTER TABLE public.gov_prices DROP CONSTRAINT IF EXISTS gov_prices_commodity_variety_date_key;
ALTER TABLE public.gov_prices DROP CONSTRAINT IF EXISTS gov_prices_commodity_variety_price_date_key;

-- 2. Drop duplicate indexes
DROP INDEX IF EXISTS public.idx_notif_user;
DROP INDEX IF EXISTS public.idx_products_user;
DROP INDEX IF EXISTS public.idx_bookings_buyer;
DROP INDEX IF EXISTS public.idx_bookings_farmer;
DROP INDEX IF EXISTS public.idx_slots_product;

-- 3. Drop obsolete tables
DROP TABLE IF EXISTS public.user_relations CASCADE;
DROP TABLE IF EXISTS public.user_addresses CASCADE;
