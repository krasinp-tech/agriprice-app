-- Keep saved profiles independent from social follows.
CREATE TABLE IF NOT EXISTS public.profile_favorites (
  owner_id uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_favorites_pkey PRIMARY KEY (owner_id, target_profile_id),
  CONSTRAINT profile_favorites_not_self CHECK (owner_id <> target_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_favorites_target
  ON public.profile_favorites(target_profile_id);

-- Do not copy follows into favorites. Following and pressing the heart are
-- separate user actions and must never create one another.

-- Remove only legacy rows inserted by the old migration. Matching the exact
-- timestamp avoids deleting a favorite that the user explicitly added later.
DELETE FROM public.profile_favorites favorite
USING public.follows follow
WHERE favorite.owner_id = follow.follower_id
  AND favorite.target_profile_id = follow.following_id
  AND favorite.created_at = follow.created_at;
