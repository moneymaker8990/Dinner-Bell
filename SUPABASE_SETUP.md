# Dinner Bell — Step-by-Step Supabase Integration

Follow these steps to connect the Dinner Bell app to your own Supabase project. The app expects a Postgres schema (tables, RLS, RPCs) that matches the migrations in `supabase/migrations/`.

---

## Step 1: Create a Supabase project (if you don’t have one)

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organization (or create one).
4. Set:
   - **Name:** e.g. `dinner-bell`
   - **Database password:** choose a strong password and **save it** (you need it for DB access).
   - **Region:** pick one close to you.
5. Click **Create new project** and wait until the project is ready.

---

## Step 2: Get your project URL and anon key

1. In the Supabase dashboard, open your project.
2. Go to **Project Settings** (gear icon in the left sidebar).
3. Open **API**.
4. Copy:
   - **Project URL** (e.g. `https://xxxxxxxx.supabase.co`)
   - **anon public** key (under "Project API keys").

You’ll use these in the app in Step 5.

---

## Step 3: Apply the database schema (migrations)

You can do this in one of two ways: **Dashboard (SQL Editor)** or **Supabase CLI**.

### Option A: Using the Supabase Dashboard (no CLI)

1. In the dashboard, go to **SQL Editor**.
2. Run each migration file **in order**, one at a time. Copy the full contents of each file, paste into a new query, and click **Run**.

   Run in this order:

   | Order | File |
   |-------|------|
   | 1 | `supabase/migrations/001_initial.sql` |
   | 2 | `supabase/migrations/002_get_event_by_guest.sql` |
   | 3 | `supabase/migrations/003_invite_note.sql` |
   | 4 | `supabase/migrations/004_invite_preview.sql` |
   | 5 | `supabase/migrations/005_claim_message.sql` |
   | 6 | `supabase/migrations/006_add_guest_by_host.sql` |
   | 7 | `supabase/migrations/007_fix_rls_recursion.sql` |
   | 8 | `supabase/migrations/008_add_guest_by_phone.sql` |
   | 9 | `supabase/migrations/009_premium_foundation.sql` |
   | 10 | `supabase/migrations/010_phase1_invite_presence.sql` |
   | 11 | `supabase/migrations/011_in_event_mode.sql` |
   | 12 | `supabase/migrations/012_event_templates_seed.sql` |
   | 13 | `supabase/migrations/013_host_power_tools.sql` |
   | 14 | `supabase/migrations/014_invite_preview_guest_count.sql` |
   | 15 | `supabase/migrations/015_discovery_public_toggle.sql` |
   | 16 | `supabase/migrations/016_fix_events_insert_policy.sql` |
   | 17 | `supabase/migrations/017_events_insert_only_policy.sql` |
   | 18 | `supabase/migrations/018_create_event_rpc.sql` |
   | 19 | `supabase/migrations/019_fix_create_event_token_fallback.sql` |

   **Alternative:** For a fresh project you can run the entire `supabase/run-all-migrations.sql` file once in the SQL Editor (it includes all of the above).

3. After each run, check for errors. If you see "relation already exists" or similar, that migration was already applied; you can skip it or run only the new parts.
4. In **Table Editor**, confirm that tables exist: `events`, `event_guests`, `bring_items`, `menu_sections`, `menu_items`, `schedule_blocks`, `profiles`, `notification_schedules`. After premium migrations you’ll also see `guest_groups`, `guest_group_members`, `event_templates`, `event_co_hosts`, `event_photos`, `event_photo_reactions`, `event_messages`, `event_polls`, `event_poll_votes`, `event_waitlist`, `event_prep_tasks`.

### Option B: Using the Supabase CLI

1. **Install the CLI** (if needed):
   ```bash
   npm install -g supabase
   ```
   Or with Scoop (Windows): `scoop install supabase`

2. **Log in and link the project:**
   ```bash
   cd "C:\Users\caleb\OneDrive\Desktop\Dinner Bell"
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   Replace `YOUR_PROJECT_REF` with the ref from the dashboard (e.g. **Project Settings → General → Reference ID** — the part before `.supabase.co`).

3. **Push migrations:**
   ```bash
   supabase db push
   ```
   This runs all migrations in `supabase/migrations/` in order.

4. If you get errors, fix them (e.g. wrong Postgres version or conflicting objects) and run `supabase db push` again.

---

## Step 4: Configure Authentication (optional but recommended)

1. In the dashboard, go to **Authentication → Providers**.
2. Enable **Email** (and optionally **Phone** or others).
3. Under **Authentication → URL Configuration**, set:
   - **Site URL:** your app URL (e.g. `https://your-app.com` or for local dev `exp://...`).
   - **Redirect URLs:** add any URLs where users are sent after sign-in (e.g. your Expo / web URL).

For **dev sign-in** (optional): create a test user under **Authentication → Users → Add user** and use that email/password in `.env` as `EXPO_PUBLIC_DEV_EMAIL` and `EXPO_PUBLIC_DEV_PASSWORD`.

**If "Create account" returns 422 (Unprocessable Content):**
- The app now shows Supabase’s real error message. Check it for hints (e.g. "invalid format", "confirmation mail").
- Under **Authentication → URL Configuration**, add your web origin to **Redirect URLs** (e.g. `https://your-app.vercel.app` or `http://localhost:8081`).
- If you use **Confirm email**, either configure **SMTP** under **Project Settings → Auth** or temporarily turn off **Confirm email** under **Authentication → Providers → Email** to test sign-up.

**If you see "infinite recursion detected in policy for relation events" or 500 errors on events/event_guests:**
- Run the RLS fix migration: in **SQL Editor**, open `supabase/migrations/007_fix_rls_recursion.sql`, copy its contents, and run it. This replaces the policies that cross-reference `events` and `event_guests` with helpers that avoid recursion.

---

## Step 5: Configure the app with your Supabase credentials

1. In the project root, create a file named `.env` (it’s in `.gitignore`; don’t commit it).
2. Copy from `.env.example` and fill in your values:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-step-2
   ```

   Replace:
   - `YOUR_PROJECT_REF` with your project’s reference ID.
   - `your-anon-key-from-step-2` with the **anon public** key from Step 2.

3. (Optional) For dev-only sign-in:
   ```env
   EXPO_PUBLIC_DEV_EMAIL=dev@test.com
   EXPO_PUBLIC_DEV_PASSWORD=your-secure-password
   ```

4. Restart the Expo dev server so it picks up the new env vars:
   ```bash
   npx expo start
   ```
   If you use a cache, try: `npx expo start -c`

---

## Step 6: Verify the connection

1. Run the app: `npx expo start`, then open in web or a device.
2. Sign in (or use dev sign-in if configured).
3. Create a test dinner event. If it saves and you see it on Home/Events, the app is talking to Supabase and the schema is correct.
4. If you previously saw **404** on `/rest/v1/events` or other tables, those should be **200** once the schema is applied and `.env` points at the same project.

---

## Step 7: Edge Functions (optional — for push notifications and bell)

The app can work without Edge Functions for basic create/RSVP/bring list. For **push notifications** (invites, reminders, bell), you need to deploy and schedule the functions.

1. **Install Supabase CLI** (if you haven’t for Option B above).
2. **Link the project** (same as in Step 3B).
3. **Set secrets** (e.g. for Expo push or FCM):
   ```bash
   supabase secrets set EXPO_ACCESS_TOKEN=your-expo-token
   ```
4. **Deploy functions:**
   ```bash
   supabase functions deploy notify-host
   supabase functions deploy send-bell
   supabase functions deploy send-invite-push
   supabase functions deploy schedule-notifications
   ```
5. **Schedule the cron** for reminders/bell: In Supabase Dashboard → **Database → Extensions** enable `pg_cron` if needed, then add a cron job that calls `schedule-notifications` (or use the Supabase cron docs for your plan).

You can do this after the app is working for create/RSVP/bring list.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **404 on `/rest/v1/events`** | Schema not applied or wrong project. Re-run migrations (Step 3) and confirm `.env` URL/key match that project. |
| **Invalid API key** | Copy the **anon public** key again from Project Settings → API; ensure no extra spaces in `.env`. |
| **RLS policy violation** | User must be signed in for host actions; for invite preview use the RPCs `get_event_by_invite` / `add_guest_by_invite` (they work for anon). |
| **Trigger error `EXECUTE FUNCTION`** | Supabase uses Postgres 15; `EXECUTE FUNCTION` is correct. If you’re on an older Postgres elsewhere, try `EXECUTE PROCEDURE` in the trigger definition. |
| **Env vars not updating** | Restart Expo with cache clear: `npx expo start -c`. |
| **CORS blocked when calling Edge Functions from web** | The functions (send-bell, notify-host, send-invite-push) return CORS headers and handle OPTIONS. If you still see CORS errors, redeploy: `supabase functions deploy send-bell` (and the others). Ensure the functions are deployed to the same project as your app’s Supabase URL. |

---

## Summary checklist

- [ ] Supabase project created
- [ ] Project URL and anon key copied
- [ ] All migrations run through `supabase/migrations/019_fix_create_event_token_fallback.sql` (Dashboard SQL or `supabase db push`)
- [ ] `.env` created with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Expo restarted; app loads and can create an event
- [ ] (Optional) Edge Functions deployed and cron set for notifications

Once these are done, the app is integrated with your Supabase project.
