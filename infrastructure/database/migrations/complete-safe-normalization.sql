-- Safe final normalization pass for the live AgriPrice schema.
-- The destructive legacy-column normalization has already been completed.
-- This pass only adds indexes required by remaining foreign-key joins.

BEGIN;

DELETE FROM public.follows
WHERE follower_id = following_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follows'::regclass
      AND conname = 'follows_not_self'
  ) THEN
    ALTER TABLE public.follows
      ADD CONSTRAINT follows_not_self CHECK (follower_id <> following_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
  ON public.chat_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_reviewed_by
  ON public.payment_submissions(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

COMMENT ON INDEX public.idx_chat_messages_sender_id IS
  'Supports joins and integrity operations for chat_messages.sender_id.';

COMMENT ON INDEX public.idx_payment_submissions_reviewed_by IS
  'Supports reviewer lookups without indexing NULL pending submissions.';

COMMIT;
