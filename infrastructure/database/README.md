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
4. Run `maintenance/SUPABASE_OPTIMIZE.sql`.
5. Run `maintenance/verify_submission_constraints.sql` and confirm the final SELECT returns all expected constraints.
6. Optionally run `maintenance/audit_unused_tables_rows.sql` to inspect unused rows. Do not delete audit candidates unless you intentionally want to clean data.

The files in `schemas/` are references for documentation. For an existing Supabase project, use the migration files above instead of recreating all tables.
