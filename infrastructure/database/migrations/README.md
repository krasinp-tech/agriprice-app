# Database Migrations

For final submission, run these current migrations in Supabase SQL Editor:

1. `final_teacher_normalization_migration.sql`
2. `create-reviews-and-notification-link.sql`
3. `zz-fix-chat-device-unique-constraints.sql`
4. `bug-freeze-booking-queue-sequence.sql`
5. `add-booking-cancel-info-and-chat-deletions.sql`
6. `separate-profile-favorites-from-follows.sql`
7. `seed-thai-fruits-and-varieties.sql`
8. `normalize-compound-fruit-products.sql`
9. `create-payment-submissions.sql`
10. `add-pro-subscription-dates.sql`
11. `exclude-own-offer-impressions.sql`
12. `finalize-project-database.sql`

After these migrations, run `../maintenance/SUPABASE_OPTIMIZE.sql`, then
`../maintenance/verify_submission_constraints.sql`. The project is ready only
when every verification row reports `ok`.
