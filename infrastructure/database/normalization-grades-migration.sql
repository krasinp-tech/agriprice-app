-- 1. Create offer_grades table referencing buy_offers(product_id)
CREATE TABLE IF NOT EXISTS public.offer_grades (
  id          BIGSERIAL     PRIMARY KEY,
  offer_id    BIGINT        NOT NULL REFERENCES public.buy_offers(product_id) ON DELETE CASCADE,
  grade_name  TEXT          NOT NULL,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- 2. Migrate existing JSONB grades into offer_grades
TRUNCATE TABLE public.offer_grades CASCADE;

INSERT INTO public.offer_grades (offer_id, grade_name, price)
SELECT 
  product_id AS offer_id,
  g.grade AS grade_name,
  (g.price)::numeric AS price
FROM public.buy_offers,
LATERAL jsonb_to_recordset(grades) AS g(grade text, price numeric)
WHERE grades IS NOT NULL AND jsonb_array_length(grades) > 0;

-- 3. Define the auto-synchronization trigger function
CREATE OR REPLACE FUNCTION public.sync_offer_grades()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old grades
  DELETE FROM public.offer_grades WHERE offer_id = NEW.product_id;

  -- Insert new grades from the JSONB array
  IF NEW.grades IS NOT NULL AND jsonb_array_length(NEW.grades) > 0 THEN
    INSERT INTO public.offer_grades (offer_id, grade_name, price)
    SELECT 
      NEW.product_id AS offer_id,
      g.grade AS grade_name,
      (g.price)::numeric AS price
    FROM jsonb_to_recordset(NEW.grades) AS g(grade text, price numeric);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to buy_offers table
DROP TRIGGER IF EXISTS trg_sync_offer_grades ON public.buy_offers;
CREATE TRIGGER trg_sync_offer_grades
  AFTER INSERT OR UPDATE OF grades ON public.buy_offers
  FOR EACH ROW EXECUTE FUNCTION public.sync_offer_grades();
