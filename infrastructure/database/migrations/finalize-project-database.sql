-- ============================================================
-- AgriPrice final database compatibility migration
-- Safe to run repeatedly after all feature migrations.
-- ============================================================

BEGIN;

-- PRO subscription fields used by dashboard.js, payments.js and profile.js.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pro_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_pro_expires_idx
  ON public.profiles(pro_expires_at)
  WHERE tier = 'pro';

-- Remove impossible legacy rows before enforcing the database rule.
DELETE FROM public.follows
WHERE follower_id = following_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.follows'::regclass
      AND conname = 'follows_not_self'
  ) THEN
    ALTER TABLE public.follows
      ADD CONSTRAINT follows_not_self CHECK (follower_id <> following_id);
  END IF;
END $$;

-- The API calls these RPCs after inserting/deleting a follow. Keep each
-- update atomic so concurrent requests cannot overwrite one another.
CREATE OR REPLACE FUNCTION public.increment_follower_count(target_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.profiles
  SET followers_count = COALESCE(followers_count, 0) + 1
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_following_count(target_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.profiles
  SET following_count = COALESCE(following_count, 0) + 1
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_follower_count(target_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.profiles
  SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
  WHERE profile_id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_following_count(target_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.profiles
  SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
  WHERE profile_id = target_id;
$$;

REVOKE ALL ON FUNCTION public.increment_follower_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_following_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_follower_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_following_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_follower_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_following_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_follower_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_following_count(uuid) TO service_role;

-- Repair counters once in case follows existed before the RPCs were added.
UPDATE public.profiles AS profile
SET followers_count = (
      SELECT COUNT(*)::integer
      FROM public.follows
      WHERE following_id = profile.profile_id
    ),
    following_count = (
      SELECT COUNT(*)::integer
      FROM public.follows
      WHERE follower_id = profile.profile_id
    );

-- Indexes for reverse-follow lookups and current feature tables.
CREATE INDEX IF NOT EXISTS idx_follows_following_id
  ON public.follows(following_id);

CREATE INDEX IF NOT EXISTS idx_profile_favorites_target
  ON public.profile_favorites(target_profile_id);

CREATE INDEX IF NOT EXISTS payment_submissions_user_created_idx
  ON public.payment_submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_impressions_viewer_created
  ON public.offer_impressions(viewer_id, created_at DESC)
  WHERE viewer_id IS NOT NULL;

COMMIT;
