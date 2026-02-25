# Submission Prerequisites

Before you can submit Dinner Bell to the App Store and Google Play, you need accounts, credentials, and a few one-time setup steps. This doc covers all of it.

---

## 1. Developer accounts

- **Apple Developer Program** — [developer.apple.com](https://developer.apple.com)  
  - **$99/year**  
  - Required for App Store Connect, TestFlight, and distribution.  
  - Enroll and wait for approval before creating your app in App Store Connect.

- **Google Play Console** — [play.google.com/console](https://play.google.com/console)  
  - **$25 one-time**  
  - Required to publish on Google Play.  
  - Create the app with package `com.dinnerbell.app` and complete the account setup.

---

## 2. Host legal pages (Privacy and Terms)

Privacy and Terms are implemented in the app as [app/privacy.tsx](app/privacy.tsx) and [app/terms.tsx](app/terms.tsx). They are served at `/privacy` and `/terms` when you run the **web** build.

- **Before submission:** Deploy the web app (e.g. Vercel) so that your **chosen domain** serves these routes.  
- Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL` to those live URLs (e.g. `https://yourdomain.com/privacy`, `https://yourdomain.com/terms`).  
- Both stores require a **working** Privacy Policy URL at submission time.

---

## 3. Code signing (EAS Build)

Dinner Bell uses **Expo EAS Build**. You do **not** configure Xcode certificates or Android keystores manually on your machine.

- **iOS**  
  - EAS creates and manages Apple Developer certificates and provisioning profiles when you run `eas build --platform ios`.  
  - Ensure your Apple Developer account is in good standing and your Apple Team ID and App ID are set in [eas.json](eas.json) (and in EAS project settings if you use them).

- **Android**  
  - EAS can **generate and store** a release keystore for you (recommended), or you can upload your own.  
  - **Never** commit a keystore or `google-services.json` with secrets to git. Use EAS Secrets or secure storage for any keys you manage yourself.

---

## 4. Push notification credentials

Dinner Bell uses **Expo Push** ([expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)) and sends notifications via `https://exp.host/--/api/v2/push/send` from your Supabase functions.

- **iOS (APNs)**  
  - For production push on real devices, EAS needs an **APNs key** (or certificate).  
  - In [Expo dashboard](https://expo.dev) → your project → Credentials → iOS, add an APNs Authentication Key (recommended) or upload an APNs certificate.  
  - EAS Build will use it when building the app.

- **Android (FCM)**  
  - Expo uses FCM under the hood for Android push.  
  - When you build with EAS, follow [Expo’s FCM setup](https://docs.expo.dev/push-notifications/push-notifications-setup/#android) if you need a custom Firebase project; otherwise EAS can use the default Expo FCM project for development. For production, configure FCM and add `google-services.json` to your EAS project if required by your setup.

---

## 5. Real device testing

Do **not** rely only on simulators/emulators. Before submission:

- **Build** with `eas build --platform ios --profile production` and `eas build --platform android --profile production` (or use a preview/development profile for internal testing).  
- **Install** the built app on **physical** iPhone and Android devices (e.g. via EAS internal distribution or TestFlight / Play internal testing).  
- **Test** core flows: sign-in, create event, invite, RSVP, bell, push notifications, deep links, and Profile → Privacy/Terms/Support links.

*(Note: This project is Expo/React Native. There is no `npx cap sync` — that is for Capacitor. Use EAS Build and install the resulting IPA/APK or AAB on device.)*

---

## 6. Quick checklist

- [ ] Apple Developer Program enrolled ($99/yr)
- [ ] Google Play Console account and one-time fee paid ($25)
- [ ] Privacy and Terms deployed and live at the URLs used in the app
- [ ] EAS project linked; `eas.json` submit section filled (Apple ID, ASC App ID, Team ID, Google service account path)
- [ ] iOS: APNs key (or cert) added in EAS for production push
- [ ] Android: FCM/Expo push configured as needed for production
- [ ] App tested on real iOS and Android devices before submit

For store assets (screenshots, feature graphic, icons), see [docs/STORE_ASSETS_AND_ICONS.md](STORE_ASSETS_AND_ICONS.md). For the full ordered checklist, see [docs/PRE_SUBMIT_CHECKLIST.md](PRE_SUBMIT_CHECKLIST.md).
