-- Rename columns whose stored values do not match their old names.
BEGIN;

DROP TRIGGER IF EXISTS tr_sync_booking_renamed_columns ON public.bookings;
DROP TRIGGER IF EXISTS tr_sync_device_renamed_columns ON public.device_sessions;

DROP POLICY IF EXISTS bookings_r ON public.bookings;
DROP POLICY IF EXISTS bookings_i ON public.bookings;
DROP POLICY IF EXISTS bookings_u ON public.bookings;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='buyer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='farmer_id'
  ) THEN
    ALTER TABLE public.bookings RENAME COLUMN buyer_id TO farmer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='buyer_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookings' AND column_name='farmer_id'
  ) THEN
    UPDATE public.bookings SET farmer_id=buyer_id WHERE farmer_id IS NULL;
    ALTER TABLE public.bookings DROP COLUMN buyer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.bookings'::regclass AND conname='bookings_buyer_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      RENAME CONSTRAINT bookings_buyer_id_fkey TO bookings_farmer_id_fkey;
  END IF;

  IF to_regclass('public.idx_bookings_buyer_id') IS NOT NULL
     AND to_regclass('public.idx_bookings_farmer_id') IS NULL THEN
    ALTER INDEX public.idx_bookings_buyer_id RENAME TO idx_bookings_farmer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='device_sessions' AND column_name='device_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='device_sessions' AND column_name='device_icon'
  ) THEN
    ALTER TABLE public.device_sessions RENAME COLUMN device_type TO device_icon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='device_sessions' AND column_name='device_type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='device_sessions' AND column_name='device_icon'
  ) THEN
    UPDATE public.device_sessions SET device_icon=device_type WHERE device_icon IS NULL;
    ALTER TABLE public.device_sessions DROP COLUMN device_type;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.sync_renamed_columns_transition();

CREATE POLICY bookings_r ON public.bookings FOR SELECT TO authenticated USING (
  farmer_id=auth.uid() OR EXISTS (SELECT 1 FROM public.offer_slots os JOIN public.buy_offers bo ON bo.offer_id=os.offer_id WHERE os.slot_id=bookings.slot_id AND bo.user_id=auth.uid())
);
CREATE POLICY bookings_i ON public.bookings FOR INSERT TO authenticated WITH CHECK (
  farmer_id=auth.uid() OR EXISTS (SELECT 1 FROM public.offer_slots os JOIN public.buy_offers bo ON bo.offer_id=os.offer_id WHERE os.slot_id=bookings.slot_id AND bo.user_id=auth.uid())
);
CREATE POLICY bookings_u ON public.bookings FOR UPDATE TO authenticated USING (
  farmer_id=auth.uid() OR EXISTS (SELECT 1 FROM public.offer_slots os JOIN public.buy_offers bo ON bo.offer_id=os.offer_id WHERE os.slot_id=bookings.slot_id AND bo.user_id=auth.uid())
) WITH CHECK (
  farmer_id=auth.uid() OR EXISTS (SELECT 1 FROM public.offer_slots os JOIN public.buy_offers bo ON bo.offer_id=os.offer_id WHERE os.slot_id=bookings.slot_id AND bo.user_id=auth.uid())
);

COMMENT ON COLUMN public.bookings.farmer_id IS
  'The farmer who created the booking; the buyer is derived from slot -> offer owner.';
COMMENT ON COLUMN public.device_sessions.device_icon IS
  'Material icon name used to represent the device in the app.';

COMMIT;
