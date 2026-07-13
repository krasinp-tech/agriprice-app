# AgriPrice

AgriPrice is an agricultural buy-offer and queue-booking platform. It connects farmers with buying centers, supports offer discovery, booking slots, queue tracking, chat, notifications, government price lookup, favorites, and app reviews.

## Project Structure

- `frontend/` - HTML, CSS, and vanilla JavaScript client used by Capacitor.
- `server/` - Node.js and Express API server.
- `infrastructure/database/` - Supabase schema references, migrations, and maintenance SQL.

## Backend

```bash
cd server
npm install
npm run dev
```

Required environment values are configured in `server/.env`.

Common values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- Optional Firebase values for push notifications.

## Frontend

The mobile app uses Capacitor. The generated web bundle lives in `frontend/www`.

```bash
cd frontend
npm install
npm run cap:sync
```

The frontend source is written with vanilla JavaScript and reusable components. The shared API client is in `frontend/js/api-client.js`.

## Database Setup

For an existing Supabase project, run these files in Supabase SQL Editor:

1. `infrastructure/database/migrations/final_teacher_normalization_migration.sql`
2. `infrastructure/database/migrations/create-reviews-and-notification-link.sql`
3. `infrastructure/database/migrations/zz-fix-chat-device-unique-constraints.sql`
4. `infrastructure/database/maintenance/SUPABASE_OPTIMIZE.sql`
5. `infrastructure/database/maintenance/verify_submission_constraints.sql`

Reference documentation:

- `infrastructure/database/schemas/schema_v3.sql`

## Final Normalization Notes

- `offer_slots.booked_count` is derived from `bookings`; it is not stored.
- `bookings` stores `slot_id`; offer and product details are derived through `offer_slots.offer_id`.
- Vehicle plates are stored in `booking_vehicles`.
- Profile links and services are stored in `profile_links` and `profile_services`.
- Product catalog data is stored in `products` and `varieties`; `buy_offers` references `variety_id`.
- Offer grade prices are stored in `offer_grades`.

## Verification

```bash
cd server
npm run lint
```

Expected output:

```text
Syntax check passed (43 files).
```
