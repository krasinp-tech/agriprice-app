-- 1. Drop old functions
DROP FUNCTION IF EXISTS public.create_booking(bigint, uuid, bigint);
DROP FUNCTION IF EXISTS public.get_next_queue_no(bigint, date);
DROP FUNCTION IF EXISTS public.increment_booked_count_safe(bigint, date);

-- 2. Recreate create_booking pointing to offer_slots
CREATE OR REPLACE FUNCTION public.create_booking(p_slot_id bigint, p_buyer_id uuid, p_product_id bigint)
RETURNS json AS $$
DECLARE
    v_booked integer;
    v_capacity integer;
    v_next_queue integer;
    v_queue_no text;
BEGIN
    -- LOCK SLOT (updated to offer_slots)
    SELECT booked_count, capacity
    INTO v_booked, v_capacity
    FROM public.offer_slots
    WHERE slot_id = p_slot_id
    FOR UPDATE;

    -- CHECK FULL
    IF v_booked >= v_capacity THEN
        RAISE EXCEPTION 'Queue is full';
    END IF;

    -- GENERATE QUEUE
    SELECT COALESCE(MAX(
        CAST(REPLACE(queue_no, 'Q', '') AS INTEGER)
    ), 0) + 1
    INTO v_next_queue
    FROM public.bookings
    WHERE slot_id = p_slot_id;

    v_queue_no := 'Q' || LPAD(v_next_queue::text, 3, '0');

    -- INSERT BOOKING
    INSERT INTO public.bookings (
        booking_no,
        buyer_id,
        product_id,
        slot_id,
        queue_no,
        scheduled_time
    )
    VALUES (
        gen_random_uuid()::text,
        p_buyer_id,
        p_product_id,
        p_slot_id,
        v_queue_no,
        now()
    );

    -- UPDATE COUNT (updated to offer_slots)
    UPDATE public.offer_slots
    SET booked_count = booked_count + 1
    WHERE slot_id = p_slot_id;

    RETURN json_build_object(
        'success', true,
        'queue_no', v_queue_no
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Recreate get_next_queue_no pointing to offer_slots
CREATE OR REPLACE FUNCTION public.get_next_queue_no(p_slot_id bigint, p_date date)
RETURNS text AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    -- LOCK SLOT (updated to offer_slots)
    PERFORM slot_id FROM public.offer_slots WHERE slot_id = p_slot_id FOR UPDATE;
    
    SELECT COALESCE(MAX(SUBSTRING(queue_no FROM 3)::INTEGER), 0) + 1
    INTO next_seq
    FROM public.bookings
    WHERE slot_id = p_slot_id
      AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::DATE = p_date;
    
    RETURN 'Q-' || LPAD(next_seq::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. Recreate increment_booked_count_safe pointing to offer_slots
CREATE OR REPLACE FUNCTION public.increment_booked_count_safe(p_slot_id bigint, p_date date)
RETURNS TABLE (success boolean, message text) AS $$
DECLARE
    v_capacity INTEGER;
    v_booked   INTEGER;
BEGIN
    -- LOCK SLOT (updated to offer_slots)
    SELECT capacity INTO v_capacity
    FROM public.offer_slots
    WHERE slot_id = p_slot_id
    FOR UPDATE;
    
    SELECT COUNT(*)::INTEGER INTO v_booked
    FROM public.bookings
    WHERE slot_id = p_slot_id
      AND status != 'cancel'
      AND (scheduled_time AT TIME ZONE 'Asia/Bangkok')::DATE = p_date;
    
    IF v_booked >= v_capacity THEN
        RETURN QUERY SELECT FALSE, TEXT 'รอบเวลานี้เต็มแล้ว';
    ELSE
        UPDATE public.offer_slots
        SET booked_count = booked_count + 1
        WHERE slot_id = p_slot_id;
        
        RETURN QUERY SELECT TRUE, TEXT 'OK';
    END IF;
END;
$$ LANGUAGE plpgsql;
