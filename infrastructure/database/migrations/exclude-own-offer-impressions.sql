-- Remove historical self-impressions so existing dashboard totals are correct.
DELETE FROM public.offer_impressions AS impression
USING public.buy_offers AS offer
WHERE impression.offer_id = offer.offer_id
  AND impression.viewer_id = offer.user_id;

-- Enforce the rule at database level as a final safety net.
CREATE OR REPLACE FUNCTION public.reject_own_offer_impression()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.viewer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.buy_offers
    WHERE offer_id = NEW.offer_id AND user_id = NEW.viewer_id
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_own_offer_impression ON public.offer_impressions;
CREATE TRIGGER prevent_own_offer_impression
BEFORE INSERT ON public.offer_impressions
FOR EACH ROW EXECUTE FUNCTION public.reject_own_offer_impression();
