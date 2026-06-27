-- 1. Create increment/decrement RPC functions for follower and following counts on profiles

CREATE OR REPLACE FUNCTION public.increment_follower_count(target_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET followers_count = COALESCE(followers_count, 0) + 1
  WHERE profile_id = target_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_following_count(target_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET following_count = COALESCE(following_count, 0) + 1
  WHERE profile_id = target_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_follower_count(target_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
  WHERE profile_id = target_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_following_count(target_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
  WHERE profile_id = target_id;
END;
$$ LANGUAGE plpgsql;
