-- ============================================================
-- AgriPrice bug-freeze booking queue sequence support
-- Safe to run repeatedly in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.booking_queue_sequences (
  slot_id bigint NOT NULL REFERENCES public.offer_slots(slot_id) ON DELETE CASCADE,
  queue_date date NOT NULL,
  next_sequence integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT booking_queue_sequences_pkey PRIMARY KEY (slot_id, queue_date)
);

CREATE OR REPLACE FUNCTION public.next_queue_sequence(p_slot_id bigint, p_date date)
RETURNS integer AS $$
DECLARE
  v_existing_max integer := 0;
  v_sequence integer;
BEGIN
  IF p_slot_id IS NULL THEN
    RAISE EXCEPTION 'p_slot_id is required';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'p_date is required';
  END IF;

  SELECT COALESCE(MAX((substring(queue_no FROM '([0-9]+)$'))::integer), 0)
    INTO v_existing_max
  FROM public.bookings
  WHERE slot_id = p_slot_id
    AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::date = p_date;

  INSERT INTO public.booking_queue_sequences (slot_id, queue_date, next_sequence, updated_at)
  VALUES (p_slot_id, p_date, v_existing_max + 2, now())
  ON CONFLICT (slot_id, queue_date)
  DO UPDATE SET
    next_sequence = GREATEST(public.booking_queue_sequences.next_sequence + 1, EXCLUDED.next_sequence),
    updated_at = now()
  RETURNING next_sequence - 1 INTO v_sequence;

  RETURN v_sequence;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.booking_queue_sequences IS
  'Atomic per-slot per-day booking queue sequence state.';

COMMENT ON FUNCTION public.next_queue_sequence(bigint, date) IS
  'Returns the next queue sequence for one offer slot on one Bangkok date.';
