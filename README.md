# Dinner Bell

A cross-platform (iOS, Android, PWA) social hosting app for dinner invites: menu, bell time, bring list with claiming, one-tap navigation, and a satisfying dinner bell sound.

## Stack

- **Frontend:** React Native (Expo) with TypeScript, Expo Router
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Push:** Expo Push Notifications; server-side scheduling via Edge Functions

## Setup

1. **Clone and install**
   ```bash
   cd "Dinner Bell"
   npm install
   ```

2. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - Run migrations: `supabase db push` or run the SQL in `supabase/migrations/` in the SQL editor (001_initial.sql, then 002_get_event_by_guest.sql).
   - In Project Settings > API: copy **Project URL** and **anon public** key.

3. **Environment**
   - Copy `.env.example` to `.env` (or set env in your shell/CI).
   - Set:
     - `EXPO_PUBLIC_SUPABASE_URL` = your Supabase project URL
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your anon key

4. **Run**
   ```bash
   npm run web
   # or
   npm run ios
   npm run android
   ```

## Push notifications (optional)

- Deploy Edge Functions: `supabase functions deploy schedule-notifications`, `supabase functions deploy send-bell`, `supabase functions deploy notify-host`, `supabase functions deploy send-invite-push`.
- Schedule a cron (e.g. every minute) to call `https://<project>.supabase.co/functions/v1/schedule-notifications` with your service role key in `Authorization: Bearer <key>`.
- When creating an event, reminder_2h, reminder_30m, and bell rows are inserted into `notification_schedules`; the cron sends Expo push to guests (Maybe guests only get reminders if `wants_reminders` is true).
- Host is notified when a guest RSVPs or claims a bring item (via `notify-host`). When the host adds a guest by email in "Invite more", that user receives an "You're invited" push if they have the app and a push token (`send-invite-push`).

## Deep links

- `dinnerbell://invite/<eventId>?token=<invite_token>` — open invite (RSVP)
- `dinnerbell://event/<eventId>` — open event detail
- `dinnerbell://event/<eventId>/bell` — open bell experience

## Release docs

- `docs/release-checklist.md` — final QA and release verification.
- `docs/app-store-play-submission.md` — App Store Connect and Play Console submission steps.

## Definition of done

- Host can create event (title, time, bell, location, menu, bring list, schedule blocks) and invite via link.
- Guest can open invite link, RSVP (Going/Maybe/Can't), claim bring item without account.
- Bring list claims sync in realtime; host can mark "provided"; conflicts show "Already claimed".
- One-tap Navigate opens Apple/Google Maps with address and notes.
- Bell: scheduled push at bell time + host manual ring; Bell screen with sound + haptics; deep link from push works.
- No crashes on invalid token, deleted event, or missing guest.
