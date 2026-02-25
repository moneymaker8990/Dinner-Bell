# App Store & Play Store Submission

This guide covers the final steps to ship Dinner Bell to Apple App Store and Google Play.

## 1) Pre-flight in repo

- **Store assets:** Icons are under `assets/images/` (icon, splash-icon, adaptive-icon, favicon); `app.json` references them. Run `npx expo-doctor` and fix any “cannot access file” errors before building. Full spec (sizes, store-only assets): [docs/STORE_ASSETS_AND_ICONS.md](docs/STORE_ASSETS_AND_ICONS.md).
- **Legal routes:** `app/privacy.tsx` and `app/terms.tsx` serve `/privacy` and `/terms` on web; deploy so your store Privacy/Terms URLs resolve.
- Ensure `eas.json` submit placeholders are replaced with your real account values.
- Ensure `EXPO_PUBLIC_APP_URL` is set to your production web base URL (used for invite/event links).
- Add `ITSAppUsesNonExemptEncryption: false` in iOS `infoPlist` (already configured) to streamline App Store export compliance.
- Confirm legal/support links in Profile open working URLs:
  - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
  - `EXPO_PUBLIC_TERMS_URL`
  - `EXPO_PUBLIC_SUPPORT_URL`
- Confirm avatar storage migration is applied: `supabase/migrations/021_add_avatar_storage_bucket.sql`.
- Review disclosure mapping before filling App Privacy/Data Safety: `docs/PRIVACY_DATA_DISCLOSURE_MAP.md`.
- Prepare reviewer access instructions: `docs/REVIEWER_APP_ACCESS.md`.
- Run the release QA checklist in `docs/release-checklist.md`.

## 2) Build binaries

From the project root:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

If you need auto-submit in one step, use:

```bash
eas build --platform ios --profile production --auto-submit
eas build --platform android --profile production --auto-submit
```

## 3) App Store Connect (iOS)

1. Create app with bundle ID `com.dinnerbell.app`.
2. Complete store metadata:
   - App name, subtitle, description, keywords, categories
   - Screenshots for required iPhone sizes
   - Optional preview video
   - Age rating questionnaire
3. Add required policy metadata:
   - Privacy Policy URL (required)
   - Optional Terms URL / EULA URL
4. Complete App Privacy questionnaire:
   - Account identifiers
   - Contacts access
   - Calendar access
   - Any analytics data you collect
5. Submit build:
   - `eas submit --platform ios --profile production`
   - Or upload IPA manually through Transporter.

## 4) Google Play Console (Android)

1. Create app with package `com.dinnerbell.app`.
2. Complete store listing:
   - Short description and full description
   - App icon, feature graphic, screenshots
3. Fill policy/compliance sections:
   - Privacy Policy URL (required)
   - Data safety form
   - Content rating questionnaire
   - App access (demo account/instructions for reviewer)
4. Configure Play App Signing (recommended).
5. Submit build:
   - `eas submit --platform android --profile production`
   - Or upload AAB manually in Play Console.

## 5) Recommended release flow

1. Ship to internal testing first (TestFlight + Play internal testing).
2. Validate invite links, RSVP, contacts, push, and bell flows in production backend.
3. Roll out gradually (staged release) and monitor crash/error rates.
