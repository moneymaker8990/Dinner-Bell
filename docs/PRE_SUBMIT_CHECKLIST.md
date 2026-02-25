# Pre-Submit Checklist (Ordered)

Complete in this exact order before final submission. For accounts, legal hosting, code signing, push, and device testing, see [docs/SUBMISSION_PREREQUISITES.md](SUBMISSION_PREREQUISITES.md).

## 1) Credentials and config

- [ ] `eas.json` placeholders replaced (Apple ID, ASC App ID, Team ID, Google service account key path)
- [ ] `eas login` completed on release machine
- [ ] EAS production env values set (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL`, legal/support URLs)
- [ ] iOS export compliance key present (`ITSAppUsesNonExemptEncryption: false`)

## 2) Backend + legal readiness

- [ ] Production Supabase migrations fully applied
- [ ] `/privacy` and `/terms` deployed and publicly reachable
- [ ] Support channel reachable (`mailto:` inbox or support URL)
- [ ] Reviewer demo account created and documented (`docs/REVIEWER_APP_ACCESS.md`)

## 3) Build + QA

- [ ] `npx expo-doctor` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] Release checklist run (`docs/release-checklist.md`)
- [ ] Rollback plan reviewed (`docs/ROLLBACK_CRITERIA.md`)

## 4) Store portal completion

### App Store Connect
- [ ] Metadata complete (name, subtitle, description, keywords, category)
- [ ] Privacy policy URL set
- [ ] App Privacy questionnaire completed
- [ ] Screenshots uploaded

### Google Play
- [ ] Store listing complete (short/full description, icon, screenshots)
- [ ] Feature graphic uploaded (1024 x 500)
- [ ] Data Safety completed
- [ ] Content Rating completed
- [ ] App access instructions completed

## 5) Build submission

- [ ] `eas build --platform ios --profile production`
- [ ] `eas build --platform android --profile production`
- [ ] `eas submit --platform ios --profile production`
- [ ] `eas submit --platform android --profile production`

## 6) Rollout

- [ ] Internal testing first (TestFlight + Play internal)
- [ ] Staged rollout enabled
- [ ] Health monitoring in first 24h (crash-free, auth success, RSVP success, invite/deeplink success)
