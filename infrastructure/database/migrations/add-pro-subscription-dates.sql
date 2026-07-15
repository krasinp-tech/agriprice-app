ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pro_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_pro_expires_idx
  ON public.profiles(pro_expires_at) WHERE tier = 'pro';
