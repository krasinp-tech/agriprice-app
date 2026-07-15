-- Expand phase: add correctly named columns while the old backend is live.
BEGIN;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS farmer_id uuid;
UPDATE public.bookings SET farmer_id = buyer_id WHERE farmer_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.bookings'::regclass AND conname='bookings_farmer_id_fkey') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_farmer_id_fkey
      FOREIGN KEY (farmer_id) REFERENCES public.profiles(profile_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_farmer_id ON public.bookings(farmer_id);

ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS device_icon text;
UPDATE public.device_sessions SET device_icon = device_type WHERE device_icon IS NULL;

CREATE OR REPLACE FUNCTION public.sync_renamed_columns_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    NEW.farmer_id := COALESCE(NEW.farmer_id, NEW.buyer_id);
    NEW.buyer_id := COALESCE(NEW.buyer_id, NEW.farmer_id);
  ELSIF TG_TABLE_NAME = 'device_sessions' THEN
    NEW.device_icon := COALESCE(NEW.device_icon, NEW.device_type);
    NEW.device_type := COALESCE(NEW.device_type, NEW.device_icon);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_booking_renamed_columns ON public.bookings;
CREATE TRIGGER tr_sync_booking_renamed_columns BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_renamed_columns_transition();

DROP TRIGGER IF EXISTS tr_sync_device_renamed_columns ON public.device_sessions;
CREATE TRIGGER tr_sync_device_renamed_columns BEFORE INSERT OR UPDATE ON public.device_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_renamed_columns_transition();

COMMIT;
