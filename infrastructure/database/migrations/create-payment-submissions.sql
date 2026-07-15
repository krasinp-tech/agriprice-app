CREATE TABLE IF NOT EXISTS public.payment_submissions (
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

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_trans_ref_unique
  ON public.payment_submissions(trans_ref) WHERE trans_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_submissions_user_created_idx
  ON public.payment_submissions(user_id, created_at DESC);
