# Privacy and Data Disclosure Map

This file helps complete App Store Connect App Privacy and Google Play Data Safety forms.

## Data categories used by Dinner Bell

| Data type | Where used | Why collected | Likely disclosure bucket |
|---|---|---|---|
| Account identifiers (user id, auth identity) | Supabase auth/profile flows | Sign-in, account ownership, app functionality | Identifiers / Account data |
| Contact data (phone/email for guests) | Invite + RSVP flows | Invite guests and track RSVP participation | Contact info |
| Contacts permission data | Device contacts picker | Let host invite from address book | Contacts |
| Calendar permission data | Calendar integration | Add dinner events to device calendar | Calendar |
| User content (event title/menu/notes/RSVP) | Event creation and event detail | Core app experience | User content |
| Push token | Notification registration | Bell/reminder notifications | Device/app identifiers |
| Optional analytics events | `lib/analytics.ts` endpoint-based logging | Product analytics and reliability | Analytics |

## Code references

- Permissions and usage strings: `app.json`
- Contacts and calendar capability usage: app flows + Expo modules
- Push token + notification handling: `lib/notifications.ts`
- Analytics dispatch point: `lib/analytics.ts`
- Legal page copy baseline: `app/privacy.tsx`

## Submission guidance

- Only disclose data categories actually collected in production builds.
- If `EXPO_PUBLIC_ANALYTICS_ENDPOINT` is unset in production, do not claim third-party analytics collection.
- Keep this map aligned with privacy policy copy and actual runtime behavior.
