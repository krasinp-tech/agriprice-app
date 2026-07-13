-- ============================================================
-- AgriPrice - audit unused tables / candidate unused rows
-- Run in Supabase SQL Editor.
-- This script is read-only. It does not delete or update data.
-- ============================================================

-- 1) Row count by table.
SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM public.profiles
UNION ALL SELECT 'buy_offers', COUNT(*) FROM public.buy_offers
UNION ALL SELECT 'offer_slots', COUNT(*) FROM public.offer_slots
UNION ALL SELECT 'bookings', COUNT(*) FROM public.bookings
UNION ALL SELECT 'booking_vehicles', COUNT(*) FROM public.booking_vehicles
UNION ALL SELECT 'chat_rooms', COUNT(*) FROM public.chat_rooms
UNION ALL SELECT 'chat_messages', COUNT(*) FROM public.chat_messages
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL SELECT 'gov_prices', COUNT(*) FROM public.gov_prices
UNION ALL SELECT 'notification_settings', COUNT(*) FROM public.notification_settings
UNION ALL SELECT 'device_sessions', COUNT(*) FROM public.device_sessions
UNION ALL SELECT 'follows', COUNT(*) FROM public.follows
UNION ALL SELECT 'offer_impressions', COUNT(*) FROM public.offer_impressions
UNION ALL SELECT 'offer_grades', COUNT(*) FROM public.offer_grades
UNION ALL SELECT 'profile_links', COUNT(*) FROM public.profile_links
UNION ALL SELECT 'profile_services', COUNT(*) FROM public.profile_services
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'varieties', COUNT(*) FROM public.varieties
ORDER BY table_name;

-- 2) Candidate unused rows.
-- Review manually before deleting anything.
WITH candidates AS (
  SELECT
    'products'::text AS table_name,
    p.product_id::text AS row_id,
    'catalog product has no varieties'::text AS reason
  FROM public.products p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.varieties v WHERE v.product_id = p.product_id
  )

  UNION ALL

  SELECT
    'varieties',
    v.variety_id::text,
    'variety is not referenced by any buy_offer'
  FROM public.varieties v
  WHERE NOT EXISTS (
    SELECT 1 FROM public.buy_offers bo WHERE bo.variety_id = v.variety_id
  )

  UNION ALL

  SELECT
    'buy_offers',
    bo.offer_id::text,
    'offer has no slots, grades, bookings, or impressions'
  FROM public.buy_offers bo
  WHERE NOT EXISTS (
    SELECT 1 FROM public.offer_slots os WHERE os.offer_id = bo.offer_id
  )
    AND NOT EXISTS (
      SELECT 1 FROM public.offer_grades og WHERE og.offer_id = bo.offer_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.offer_slots os ON os.slot_id = b.slot_id
      WHERE os.offer_id = bo.offer_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.offer_impressions oi WHERE oi.offer_id = bo.offer_id
    )

  UNION ALL

  SELECT
    'offer_slots',
    os.slot_id::text,
    'inactive slot has no bookings'
  FROM public.offer_slots os
  WHERE COALESCE(os.is_active, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.slot_id = os.slot_id
    )

  UNION ALL

  SELECT
    'chat_rooms',
    cr.room_id::text,
    'chat room has no messages'
  FROM public.chat_rooms cr
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chat_messages cm WHERE cm.room_id = cr.room_id
  )

  UNION ALL

  SELECT
    'notifications',
    n.notification_id::text,
    'read notification older than 90 days'
  FROM public.notifications n
  WHERE n.is_read = true
    AND n.created_at < NOW() - INTERVAL '90 days'

  UNION ALL

  SELECT
    'device_sessions',
    ds.session_id::text,
    'device session not seen for more than 180 days'
  FROM public.device_sessions ds
  WHERE COALESCE(ds.last_seen, ds.last_active, ds.created_at) < NOW() - INTERVAL '180 days'

  UNION ALL

  SELECT
    'offer_impressions',
    oi.id::text,
    'impression older than 180 days'
  FROM public.offer_impressions oi
  WHERE oi.created_at < NOW() - INTERVAL '180 days'
)
SELECT *
FROM candidates
ORDER BY table_name, row_id;

-- 3) Summary of candidate rows by table.
WITH candidates AS (
  SELECT 'products'::text AS table_name
  FROM public.products p
  WHERE NOT EXISTS (SELECT 1 FROM public.varieties v WHERE v.product_id = p.product_id)

  UNION ALL
  SELECT 'varieties'
  FROM public.varieties v
  WHERE NOT EXISTS (SELECT 1 FROM public.buy_offers bo WHERE bo.variety_id = v.variety_id)

  UNION ALL
  SELECT 'buy_offers'
  FROM public.buy_offers bo
  WHERE NOT EXISTS (SELECT 1 FROM public.offer_slots os WHERE os.offer_id = bo.offer_id)
    AND NOT EXISTS (SELECT 1 FROM public.offer_grades og WHERE og.offer_id = bo.offer_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.offer_slots os ON os.slot_id = b.slot_id
      WHERE os.offer_id = bo.offer_id
    )
    AND NOT EXISTS (SELECT 1 FROM public.offer_impressions oi WHERE oi.offer_id = bo.offer_id)

  UNION ALL
  SELECT 'offer_slots'
  FROM public.offer_slots os
  WHERE COALESCE(os.is_active, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.slot_id = os.slot_id)

  UNION ALL
  SELECT 'chat_rooms'
  FROM public.chat_rooms cr
  WHERE NOT EXISTS (SELECT 1 FROM public.chat_messages cm WHERE cm.room_id = cr.room_id)

  UNION ALL
  SELECT 'notifications'
  FROM public.notifications n
  WHERE n.is_read = true
    AND n.created_at < NOW() - INTERVAL '90 days'

  UNION ALL
  SELECT 'device_sessions'
  FROM public.device_sessions ds
  WHERE COALESCE(ds.last_seen, ds.last_active, ds.created_at) < NOW() - INTERVAL '180 days'

  UNION ALL
  SELECT 'offer_impressions'
  FROM public.offer_impressions oi
  WHERE oi.created_at < NOW() - INTERVAL '180 days'
)
SELECT table_name, COUNT(*) AS candidate_count
FROM candidates
GROUP BY table_name
ORDER BY table_name;
