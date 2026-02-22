# Set Supabase Edge Function secrets for invite email + SMS.
# 1. Get keys: Resend (resend.com), Twilio (twilio.com).
# 2. Set SUPABASE_ACCESS_TOKEN or run: npx supabase login
# 3. Edit the values below, then run: .\scripts\set-invite-secrets.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "clbwgoxtlxebfsqwqxey"

# --- EDIT THESE (then run the script) ---
$RESEND_API_KEY       = "YOUR_RESEND_API_KEY"
$INVITE_FROM_EMAIL    = "Dinner Bell <invites@yourdomain.com>"   # or use a Resend verified domain
$TWILIO_ACCOUNT_SID   = "YOUR_TWILIO_ACCOUNT_SID"
$TWILIO_AUTH_TOKEN    = "YOUR_TWILIO_AUTH_TOKEN"
$TWILIO_PHONE_NUMBER  = "+15551234567"   # E.164, your Twilio number
# INVITE_BASE_URL is already set to https://dinner-bell-app.vercel.app

if ($RESEND_API_KEY -eq "YOUR_RESEND_API_KEY" -or $TWILIO_ACCOUNT_SID -eq "YOUR_TWILIO_ACCOUNT_SID") {
  Write-Host "Edit this script and set your real Resend and Twilio values first." -ForegroundColor Yellow
  exit 1
}

Write-Host "Setting Supabase secrets for project $ProjectRef ..."
npx supabase secrets set `
  RESEND_API_KEY="$RESEND_API_KEY" `
  INVITE_FROM_EMAIL="$INVITE_FROM_EMAIL" `
  TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" `
  TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" `
  TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER" `
  --project-ref $ProjectRef

Write-Host "Done. Invite email and SMS will work once Resend/Twilio are configured." -ForegroundColor Green
