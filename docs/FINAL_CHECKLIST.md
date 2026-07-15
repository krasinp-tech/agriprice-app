# AgriPrice final checklist

Use this list before submitting or deploying the project.

## Database

- [ ] Apply all migrations in the order listed in `infrastructure/database/README.md`.
- [ ] Confirm `bug-freeze-booking-queue-sequence.sql` has been applied.
- [ ] Confirm `exclude-own-offer-impressions.sql` has been applied.
- [ ] Confirm `finalize-project-database.sql` has been applied.
- [ ] Run `maintenance/SUPABASE_OPTIMIZE.sql`.
- [ ] Run `maintenance/verify_submission_constraints.sql` and confirm every result is `ok`.
- [ ] Back up the production database before any optional data cleanup.

## Production configuration

- [ ] Configure all required Render environment variables from `server/.env.example`.
- [ ] Use a long, random `JWT_SECRET` and keep the Supabase service-role key server-side only.
- [ ] Set `OTP_MOCK=false` in production.
- [ ] Configure Firebase Admin credentials for push notifications.
- [ ] Put `google-services.json` in the required local Android location; do not commit it.
- [ ] Check the allowed web origins if the production frontend domain changes.

## Automated checks

- [ ] Run `npm install` and `npm run lint` in `server`.
- [ ] Run `npm install` and `npm run cap:sync` in `frontend`.
- [ ] Run `.\gradlew.bat assembleDebug` in `frontend/android`.
- [ ] Confirm there are no unintended files with `git status`.
- [ ] Confirm no `.env`, service-account file, signing key, log, APK, or generated bundle is tracked.

## Manual app checks

- [ ] Register, sign in, sign out, and restore a session after reopening the app.
- [ ] Farmer: allow/deny GPS and verify nearby Home recommendations are ordered correctly.
- [ ] Buyer: set a profile map pin and verify nearby Home recommendations are ordered correctly.
- [ ] Search and filter offers; open offer details.
- [ ] Create a booking and verify queue numbering under simultaneous bookings.
- [ ] Cancel a booking and confirm the cancellation reason/status.
- [ ] Send chat messages, delete a chat for one user, and reopen the conversation.
- [ ] Receive a push notification and open its destination.
- [ ] Follow/unfollow a profile and verify counters do not drift.
- [ ] Add/remove favorites and confirm the same terminology is used throughout the app.
- [ ] Submit payment proof and verify the intended admin/user status flow.
- [ ] Check light/dark mode, keyboard behavior, back button, offline handling, and scrolling on a real Android device.

## Release handoff

- [ ] Replace debug builds with a signed release APK/AAB for real distribution.
- [ ] Store the signing key and passwords outside the repository and back them up securely.
- [ ] Record the deployed API URL, Supabase project, Firebase project, and responsible account owner in private handoff notes.
- [ ] Tag or archive the exact commit used for the submitted build.
