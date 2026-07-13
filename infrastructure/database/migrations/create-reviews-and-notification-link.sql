-- Add app review support and notification deep links.
-- Safe to run repeatedly in Supabase SQL Editor.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link TEXT;

CREATE TABLE IF NOT EXISTS public.reviews (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  reviewer_id UUID        NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);
