-- Merge legacy product rows that contain a variety in the product name.
-- Existing buy offers are repointed before the duplicate catalog rows are removed.

BEGIN;

CREATE TEMP TABLE compound_fruit_mapping (
  source_product_name text PRIMARY KEY,
  target_product_name text NOT NULL,
  default_variety_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO compound_fruit_mapping VALUES
  ('ทุเรียนหมอนทอง', 'ทุเรียน', 'หมอนทอง');

-- Ensure every target product exists.
INSERT INTO public.products (product_name, category)
SELECT DISTINCT target_product_name, 'ผลไม้'
FROM compound_fruit_mapping
ON CONFLICT (product_name) DO NOTHING;

-- Preserve the source variety name where available; otherwise use the name
-- extracted from the legacy compound product.
INSERT INTO public.varieties (product_id, variety_name)
SELECT DISTINCT
  target_product.product_id,
  COALESCE(NULLIF(btrim(source_variety.variety_name), ''), mapping.default_variety_name)
FROM compound_fruit_mapping mapping
JOIN public.products source_product
  ON source_product.product_name = mapping.source_product_name
JOIN public.products target_product
  ON target_product.product_name = mapping.target_product_name
LEFT JOIN public.varieties source_variety
  ON source_variety.product_id = source_product.product_id
ON CONFLICT (product_id, variety_name) DO NOTHING;

-- Move existing offers to the canonical product/variety pair.
UPDATE public.buy_offers offer
SET variety_id = target_variety.variety_id
FROM compound_fruit_mapping mapping
JOIN public.products source_product
  ON source_product.product_name = mapping.source_product_name
JOIN public.products target_product
  ON target_product.product_name = mapping.target_product_name
JOIN public.varieties source_variety
  ON source_variety.product_id = source_product.product_id
JOIN public.varieties target_variety
  ON target_variety.product_id = target_product.product_id
 AND target_variety.variety_name = COALESCE(
   NULLIF(btrim(source_variety.variety_name), ''),
   mapping.default_variety_name
 )
WHERE offer.variety_id = source_variety.variety_id;

DELETE FROM public.varieties variety
USING public.products product, compound_fruit_mapping mapping
WHERE variety.product_id = product.product_id
  AND product.product_name = mapping.source_product_name;

DELETE FROM public.products product
USING compound_fruit_mapping mapping
WHERE product.product_name = mapping.source_product_name;

COMMIT;
