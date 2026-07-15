# AgriPrice

AgriPrice is a mobile marketplace for farmers and agricultural buyers. It supports nearby offer discovery, booking and queue tracking, chat, notifications, favorites, payments, reviews, and government price data.

## Project structure

- `frontend/` — vanilla HTML, CSS, and JavaScript app packaged with Capacitor.
- `server/` — Node.js and Express API.
- `infrastructure/database/` — Supabase schema reference, migrations, maintenance, and verification SQL.
- `docs/FINAL_CHECKLIST.md` — final deployment and handoff checklist.

Generated folders such as `node_modules`, `frontend/www`, Android build output, APK files, logs, and local secrets are intentionally excluded from Git.

## Requirements

- Node.js 18 or newer
- npm
- Android Studio and a compatible JDK for Android builds
- A Supabase project
- A Firebase project when using authentication and push notifications

## Local setup

Create the backend environment file from the tracked template:

```powershell
Copy-Item server/.env.example server/.env
```

Fill in the real values in `server/.env`, then install dependencies:

```powershell
cd server
npm install
npm run dev
```

In another terminal, prepare the mobile frontend:

```powershell
cd frontend
npm install
npm run cap:sync
```

The generated web bundle is written to `frontend/www`. To open the native project, run `npm run cap:open:android`.

## Android build

After changing frontend source or Capacitor plugins, sync before building:

```powershell
cd frontend
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

The debug APK is generated under `frontend/android/app/build/outputs/apk/debug/`. A production release requires a release signing key and release build configuration.

`google-services.json` must be placed locally where the Android/Firebase setup expects it. It contains project-specific configuration and is not committed.

## Database

For an existing Supabase project, apply migrations rather than recreating the schema. The authoritative migration order is documented in [`infrastructure/database/README.md`](infrastructure/database/README.md).

Before final submission, make sure the queue sequence, own-impression exclusion, final compatibility migration, optimization script, and verification script have been run. Every row returned by `maintenance/verify_submission_constraints.sql` must report `ok`.

`infrastructure/database/schemas/schema_v3.sql` is a reference snapshot; it is not a replacement for applying migrations to an existing database.

## Verification

Check backend JavaScript syntax:

```powershell
cd server
npm run lint
```

Expected result:

```text
Syntax check passed (44 files).
```

Then sync Capacitor and build Android using the commands above. Complete the manual scenarios in [`docs/FINAL_CHECKLIST.md`](docs/FINAL_CHECKLIST.md) before delivery.

## Secrets and deployment

Never commit `server/.env`, Firebase service-account JSON, signing keys, database credentials, or generated APKs. Configure production values in the deployment provider. `render.yaml` declares the required server variables without embedding their values.
