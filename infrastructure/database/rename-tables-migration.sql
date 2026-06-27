-- 1. Rename tables
ALTER TABLE public.products RENAME TO buy_offers;
ALTER TABLE public.product_slots RENAME TO offer_slots;
ALTER TABLE public.product_impressions RENAME TO offer_impressions;

-- 2. Drop triggers on old tables
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.buy_offers;
DROP TRIGGER IF EXISTS tr_products_updated_at ON public.buy_offers;

-- 3. Create triggers on renamed tables
CREATE TRIGGER trg_buy_offers_updated_at
  BEFORE UPDATE ON public.buy_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Drop old functions
DROP FUNCTION IF EXISTS public.next_queue_sequence(bigint);
DROP FUNCTION IF EXISTS public.next_queue_sequence(text);
DROP FUNCTION IF EXISTS public.increment_booked_count(bigint);
DROP FUNCTION IF EXISTS public.decrement_booked_count(bigint);

-- 5. Recreate functions targeting new table names
CREATE OR REPLACE FUNCTION public.next_queue_sequence(p_slot_id bigint)
RETURNS integer AS $$
DECLARE
  v_max_seq INTEGER;
BEGIN
  PERFORM 1
  FROM public.offer_slots
  WHERE slot_id = p_slot_id
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
  WHERE slot_id = p_slot_id;

  RETURN v_max_seq;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.next_queue_sequence(p_slot_id text)
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
  WHERE slot_id = p_slot_id::bigint;

  RETURN v_max_seq;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_booked_count(p_slot_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.offer_slots
  SET booked_count = booked_count + 1
  WHERE slot_id = p_slot_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_booked_count(p_slot_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE public.offer_slots
  SET booked_count = greatest(booked_count - 1, 0)
  WHERE slot_id = p_slot_id;
END;
$$ LANGUAGE plpgsql;
