# Infrastructure & Database Setup

This directory contains SQL scripts for setting up and optimizing the Supabase database for the AgriPrice project.

## Directory layout
- `schemas/`: Current schema references.
- `migrations/`: One-off database migrations to run in Supabase SQL Editor.
- `maintenance/`: Optimization and cleanup scripts.

## Important files
- `schemas/schema_v3.sql`: Current normalized schema reference for submission.
- `migrations/final_teacher_normalization_migration.sql`: Main migration that removes duplicated columns and aligns the database with the teacher's feedback.
- `migrations/create-reviews-and-notification-link.sql`: Adds app reviews and notification deep links used by the current API.
- `migrations/zz-fix-chat-device-unique-constraints.sql`: Adds final chat-room and push-token uniqueness fixes used by verification.
- `migrations/bug-freeze-booking-queue-sequence.sql`: Adds atomic queue sequence support for booking slots.
- `migrations/add-booking-cancel-info-and-chat-deletions.sql`: Adds booking cancellation metadata and per-user chat deletion tracking.
- `migrations/seed-thai-fruits-and-varieties.sql`: Seeds the reusable Thai fruit and variety catalog used by the buy-offer dropdown.
- `migrations/normalize-compound-fruit-products.sql`: Separates legacy combined product/variety names without breaking existing offers.
- `migrations/finalize-project-database.sql`: Final compatibility pass for PRO dates, follow counters, constraints, and indexes used by the current API.
- `migrations/hard-delete-user-account-data.sql`: Adds transactional permanent account-data deletion used by the delete-account API.
- `maintenance/SUPABASE_OPTIMIZE.sql`: Safe indexes and update timestamp triggers for the current normalized schema.
- `maintenance/verify_submission_constraints.sql`: Final check for unique constraints required by normalized tables.

## How to use
1. Go to your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor**.
3. Copy the content of the desired script and click **Run**.

## Recommended run order for final submission
1. Run `migrations/final_teacher_normalization_migration.sql`.
2. Run `migrations/create-reviews-and-notification-link.sql`.
3. Run `migrations/zz-fix-chat-device-unique-constraints.sql`.
4. Run `migrations/bug-freeze-booking-queue-sequence.sql`.
5. Run `migrations/add-booking-cancel-info-and-chat-deletions.sql`.
6. Run `migrations/separate-profile-favorites-from-follows.sql`.
7. Run `migrations/seed-thai-fruits-and-varieties.sql`.
8. Run `migrations/normalize-compound-fruit-products.sql`.
9. Run `migrations/create-payment-submissions.sql`.
10. Run `migrations/add-pro-subscription-dates.sql`.
11. Run `migrations/exclude-own-offer-impressions.sql`.
12. Run `migrations/finalize-project-database.sql`.
13. Run `migrations/hard-delete-user-account-data.sql`.
14. Run `maintenance/SUPABASE_OPTIMIZE.sql`.
15. Run `maintenance/verify_submission_constraints.sql` and confirm every returned status is `ok`.
16. Optionally run `maintenance/audit_unused_tables_rows.sql` to inspect unused rows. Do not delete audit candidates unless you intentionally want to clean data.

The files in `schemas/` are references for documentation. For an existing Supabase project, use the migration files above instead of recreating all tables.
