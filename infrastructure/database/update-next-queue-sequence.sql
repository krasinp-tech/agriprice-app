-- Redefine next_queue_sequence to accept p_date and reset daily
CREATE OR REPLACE FUNCTION public.next_queue_sequence(p_slot_id bigint, p_date date)
RETURNS integer AS $$
DECLARE
  v_max_seq INTEGER;
BEGIN
  -- Lock the slot row to prevent race conditions during concurrent bookings
  PERFORM 1
  FROM public.offer_slots
  WHERE slot_id = p_slot_id
  FOR UPDATE;

  -- Find the max sequence number for bookings on the specified date
  SELECT COALESCE(
    MAX(
      CASE
        WHEN queue_no ~ '-([0-9]+)$'
        THEN CAST(SUBSTRING(queue_no FROM '-([0-9]+)$') AS INTEGER)
        ELSE 0
      END
    ), 0
  ) + 1
  INTO v_max_seq
  FROM public.bookings
  WHERE slot_id = p_slot_id
    AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::DATE = p_date;

  RETURN v_max_seq;
END;
$$ LANGUAGE plpgsql;

-- Also support text version if called with slot_id as text
CREATE OR REPLACE FUNCTION public.next_queue_sequence(p_slot_id text, p_date date)
RETURNS integer AS $$
DECLARE
  v_max_seq INTEGER;
BEGIN
  PERFORM 1
  FROM public.offer_slots
  WHERE slot_id = p_slot_id::bigint
  FOR UPDATE;

  SELECT COALESCE(
    MAX(
      CASE
        WHEN queue_no ~ '-([0-9]+)$'
        THEN CAST(SUBSTRING(queue_no FROM '-([0-9]+)$') AS INTEGER)
        ELSE 0
      END
    ), 0
  ) + 1
  INTO v_max_seq
  FROM public.bookings
  WHERE slot_id = p_slot_id::bigint
    AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::DATE = p_date;

  RETURN v_max_seq;
END;
$$ LANGUAGE plpgsql;
