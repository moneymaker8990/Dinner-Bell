# App Store Submission – What’s Done and What You Run

This summarizes what’s ready in the repo and the exact steps you need to run locally to build, submit, and release.

## Done in repo

- **Legal pages:** `/privacy` and `/terms` routes added (`app/privacy.tsx`, `app/terms.tsx`). After you deploy the web app to Vercel, `https://dinner-bell-app.vercel.app/privacy` and `.../terms` will work for store policy URLs.
- **Store assets:** `app.json` points to `assets/images/` for icon, splash, adaptive-icon, and favicon. `npx expo-doctor` passes.
- **EAS config:** `eas.json` still has placeholder values (you chose to leave them). Replace before submit: iOS `appleId`, `ascAppId`, `appleTeamId`; Android `serviceAccountKeyPath` and add `keys/google-play-service-account.json` (or your key path).
- **Release checklist:** TypeScript passes, Jest tests pass (31 tests). Design QA: no raw hex in `app/` or `components/`; border radius uses Theme tokens where applicable.

## What you need to run (after `eas login`)

1. **Replace EAS submit values** in `eas.json` with your real Apple and Google credentials.
2. **Build:**
   ```bash
   eas build --platform ios --profile production
   eas build --platform android --profile production
   ```
3. **Submit** (after builds succeed):
   ```bash
   eas submit --platform ios --profile production
   eas submit --platform android --profile production
   ```
   Or use `--auto-submit` on the build commands to submit in one step.
4. **App Store Connect:** Create app `com.dinnerbell.app`, fill metadata, screenshots, Privacy Policy URL, App Privacy questionnaire, then submit the build.
5. **Google Play Console:** Create app `com.dinnerbell.app`, fill store listing, Data safety, Content rating, Privacy Policy URL, enable Play App Signing, then submit the AAB.

Full details: `docs/app-store-play-submission.md` and `docs/release-checklist.md`.
Supporting docs: `docs/PRE_SUBMIT_CHECKLIST.md`, `docs/PRIVACY_DATA_DISCLOSURE_MAP.md`, `docs/REVIEWER_APP_ACCESS.md`, and `docs/ROLLBACK_CRITERIA.md`.

## Recommended flow

1. Deploy web app so `/privacy` and `/terms` are live, then use those URLs in the store listings.
2. Use internal testing first (TestFlight + Play internal).
3. Staged rollout and monitoring.
