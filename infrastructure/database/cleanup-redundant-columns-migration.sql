-- 1. Drop unused quantity column from buy_offers
ALTER TABLE public.buy_offers DROP COLUMN IF EXISTS quantity;

-- 2. Drop duplicate product_amount column from bookings
ALTER TABLE public.bookings DROP COLUMN IF EXISTS product_amount;

-- 3. Simplify follows table primary key
-- Drop existing surrogate ID primary key constraint if it exists
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_pkey;
-- Drop id column
ALTER TABLE public.follows DROP COLUMN IF EXISTS id;
-- Make follower_id and following_id the Composite Primary Key
ALTER TABLE public.follows ADD PRIMARY KEY (follower_id, following_id);
