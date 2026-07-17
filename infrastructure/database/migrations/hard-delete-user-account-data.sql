-- Permanently remove one account and every relational record tied to it.
-- Auth user deletion is performed by the backend after this transaction
-- succeeds because public.profiles references auth.users.

CREATE OR REPLACE FUNCTION public.delete_user_account_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_deleted integer := 0;
  v_bookings_deleted integer := 0;
  v_reviews_detached integer := 0;
  v_impressions_deleted integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- Delete bookings made by this farmer and bookings against offers owned by
  -- this account. booking_vehicles are removed by ON DELETE CASCADE.
  DELETE FROM public.bookings AS booking
  WHERE booking.farmer_id = p_user_id
     OR booking.slot_id IN (
       SELECT slot.slot_id
       FROM public.offer_slots AS slot
       JOIN public.buy_offers AS offer ON offer.offer_id = slot.offer_id
       WHERE offer.user_id = p_user_id
     );
  GET DIAGNOSTICS v_bookings_deleted = ROW_COUNT;

  -- Remove browsing/impression history created by this account instead of
  -- allowing the viewer reference to be anonymized and retained.
  DELETE FROM public.offer_impressions
  WHERE viewer_id = p_user_id;
  GET DIAGNOSTICS v_impressions_deleted = ROW_COUNT;
  -- Keep other users' submissions, but remove this account as their reviewer.
  UPDATE public.payment_submissions
  SET reviewed_by = NULL
  WHERE reviewed_by = p_user_id;
  GET DIAGNOSTICS v_reviews_detached = ROW_COUNT;

  -- Production foreign keys cascade offers, slots, grades, queues, chats,
  -- notifications, sessions, follows, favorites, payments, impressions,
  -- reviews, links and services.
  DELETE FROM public.profiles
  WHERE profile_id = p_user_id;
  GET DIAGNOSTICS v_profile_deleted = ROW_COUNT;

  IF v_profile_deleted <> 1 THEN
    RAISE EXCEPTION 'profile not found for account deletion';
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'profiles_deleted', v_profile_deleted,
    'bookings_deleted', v_bookings_deleted,
    'offer_impressions_deleted', v_impressions_deleted,
    'payment_reviews_detached', v_reviews_detached
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account_data(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user_account_data(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account_data(uuid) TO service_role;
