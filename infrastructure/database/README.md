# Infrastructure & Database Setup

This directory contains SQL scripts for setting up and optimizing the Supabase database for the AgriPrice project.

## Files
- `SUPABASE_OPTIMIZE.sql`: Run this script in the Supabase SQL Editor to add performance indexes and automatic `updated_at` triggers.
- `DATABASE_NORMALIZATION.sql`: Run this script to clean up redundant tables and unify the user model.
- `schema.sql`: The base database schema for reference (Legacy).

## How to use
1. Go to your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor**.
3. Copy the content of the desired script and click **Run**.
