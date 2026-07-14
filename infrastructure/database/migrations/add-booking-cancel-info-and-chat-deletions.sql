-- Store booking cancellation metadata and support per-user chat deletion.

ALTER TABLE IF EXISTS public.bookings
  ADD COLUMN IF NOT EXISTS cancel_by text,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE IF EXISTS public.bookings
  DROP CONSTRAINT IF EXISTS bookings_cancel_by_check;

ALTER TABLE IF EXISTS public.bookings
  ADD CONSTRAINT bookings_cancel_by_check
  CHECK (cancel_by IS NULL OR cancel_by IN ('farmer', 'buyer'));

CREATE TABLE IF NOT EXISTS public.chat_room_deletions (
  room_id bigint NOT NULL REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_room_deletions_pkey PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_room_deletions_user_room
  ON public.chat_room_deletions(user_id, room_id);
