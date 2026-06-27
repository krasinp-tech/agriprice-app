-- 1. Drop duplicate trigger and function on profiles table
DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- 2. Drop duplicate trigger on bookings table
DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
