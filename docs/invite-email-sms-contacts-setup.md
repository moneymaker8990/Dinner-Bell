# Real Invite Email, SMS, and Phone Contacts Setup

Use this checklist to make invite delivery work like Partiful:
- real email delivery
- real SMS delivery
- native contact picker for fast friend selection

This project already includes:
- `supabase/functions/send-invite-email`
- `supabase/functions/send-invite-sms`
- app calls to those functions after adding guests
- contact picker via `expo-contacts` on iOS/Android

## 1) Enable real invite email (Resend)

1. Create a Resend account at `https://resend.com`.
2. In Resend, verify a sending domain (recommended for production).
   - For testing only, you can use Resend's test sender.
3. Create an API key in Resend (`API Keys`).
4. Set Supabase secrets:
   - `RESEND_API_KEY`
   - `INVITE_FROM_EMAIL` (example: `Dinner Bell <invites@yourdomain.com>`)

PowerShell (manual):

```powershell
npx supabase secrets set RESEND_API_KEY="YOUR_RESEND_API_KEY" --project-ref YOUR_PROJECT_REF
npx supabase secrets set INVITE_FROM_EMAIL="Dinner Bell <invites@yourdomain.com>" --project-ref YOUR_PROJECT_REF
```

## 2) Enable real invite SMS (Twilio)

1. Create a Twilio account at `https://twilio.com`.
2. Buy or assign an SMS-capable phone number in E.164 format (example: `+15551234567`).
3. Copy your Twilio credentials:
   - Account SID
   - Auth Token
4. Set Supabase secrets:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

PowerShell (manual):

```powershell
npx supabase secrets set TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID" --project-ref YOUR_PROJECT_REF
npx supabase secrets set TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN" --project-ref YOUR_PROJECT_REF
npx supabase secrets set TWILIO_PHONE_NUMBER="+15551234567" --project-ref YOUR_PROJECT_REF
```

## 3) Set invite link base URL

Set the URL used in invite links sent by email/SMS:

- `INVITE_BASE_URL` (example: `https://dinner-bell-app.vercel.app`)

```powershell
npx supabase secrets set INVITE_BASE_URL="https://dinner-bell-app.vercel.app" --project-ref YOUR_PROJECT_REF
```

## 4) Deploy invite functions

Deploy both functions to the same Supabase project your app uses:

```powershell
npx supabase functions deploy send-invite-email --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-invite-sms --project-ref YOUR_PROJECT_REF
```

Optional status check:

```powershell
npx supabase functions list --project-ref YOUR_PROJECT_REF
```

## 5) Faster setup with existing script

This repo includes:
- `scripts/set-invite-secrets.ps1`

Steps:
1. Open `scripts/set-invite-secrets.ps1`.
2. Fill in your real Resend/Twilio values.
3. Set `SUPABASE_ACCESS_TOKEN` (or run `npx supabase login`).
4. Run:

```powershell
.\scripts\set-invite-secrets.ps1
```

## 6) Phone contacts UX (iOS/Android)

No additional backend setup is needed for contacts picker.

Where users access it:
- Event detail -> Invite more -> Add from contacts
- Create flow -> Invite step -> Add from contacts

How it works:
- App requests contacts permission (`expo-contacts`) on first use.
- It reads contacts with phone and/or email.
- Selected contacts are added as guests.
- Phone targets trigger SMS invite send.
- Email targets trigger email invite send.

Notes:
- Contacts picker is native-only (iOS/Android).
- Web does not expose this same native contact picker flow.

## 7) Verify end-to-end

Run a real smoke test:
1. Create an event as host.
2. Add one guest by email -> confirm email received.
3. Add one guest by phone -> confirm SMS received.
4. Add from contacts on phone -> confirm guest added and message delivered.

If guest is added but message not received:
- check function logs in Supabase Dashboard
- confirm secrets are set in the same project
- confirm `INVITE_FROM_EMAIL` is allowed by your email provider setup
- confirm Twilio number can send to the destination (trial accounts can restrict this)

## 8) Security cleanup

If you shared a Supabase access token in chat, rotate it:
- Supabase Dashboard -> Account -> Access Tokens
- Create a new token and revoke the old one.

