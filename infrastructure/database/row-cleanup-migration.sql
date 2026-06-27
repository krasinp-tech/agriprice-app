-- Delete bookings that have orphaned foreign keys (NULL values due to cascade deletions of profiles or offers)
DELETE FROM public.bookings
WHERE farmer_id IS NULL 
   OR buyer_id IS NULL 
   OR product_id IS NULL;
