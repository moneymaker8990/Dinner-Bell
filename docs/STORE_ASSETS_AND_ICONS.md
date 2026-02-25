# Store Assets and Icons

One reference for every icon and graphic you need to submit Dinner Bell to the App Store and Google Play.

---

## 1. In-repo assets (app and EAS build)

These live in `assets/images/` and are referenced in [app.json](c:\Users\caleb\OneDrive\Desktop\Dinner Bell\app.json). They must exist before `eas build`.

| Asset | Purpose | Recommended size |
|-------|---------|------------------|
| **icon.png** | App icon (iOS and Android; Expo generates all store sizes from this) | 1024 x 1024 px |
| **splash-icon.png** | Splash screen image (centered; can have transparency) | e.g. 1284 x 2778 or similar |
| **adaptive-icon.png** | Android adaptive icon foreground layer (safe zone ~66% center) | 1024 x 1024 px |
| **favicon.png** | Web favicon | 48 x 48 or 192 x 192 px |

**Check:** Run `npx expo-doctor` before building; fix any "cannot access file" errors.

---

## 2. App Store Connect (iOS)

- **App icon**  
  Taken from your build (Expo generates it from `icon.png`). No separate upload in App Store Connect.

- **Screenshots (required)**  
  Generate for at least one device size; add more for better store presence.
  - **iPhone 6.7"** — **1290 x 2796** px portrait — **6** screenshots
  - **iPhone 6.5"** — **1242 x 2688** px portrait — **6** screenshots
  - **iPad Pro** (optional but recommended) — use App Store Connect specs for iPad
  - PNG or JPEG. Suggested set: onboarding, home, create flow, invite, event detail, bell, profile. Capture from simulator or device.

- **App Preview video**  
  Optional; see [Apple’s specs](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/) if you add one.

---

## 3. Google Play Console (Android)

- **App icon (store listing)**  
  - **512 x 512** px, 32-bit PNG.  
  - Export from your main app icon (e.g. scale `assets/images/icon.png` to 512 x 512) and upload in Play Console under Store listing.

- **Feature graphic**  
  - **1024 x 500** px PNG (or JPEG), no transparency.  
  - Store listing banner; create and upload in Play Console (not in repo).

- **Screenshots**  
  - **Phone:** minimum **6** screenshots at **1080 x 1920** px or larger (Play Console shows exact dimensions per device).  
  - Optional: 7" and 10" tablet.

---

## 4. Pre-submit checklist (icons and graphics)

**Repo (before build)**  
- [ ] `assets/images/icon.png` (ideally 1024 x 1024)  
- [ ] `assets/images/splash-icon.png`  
- [ ] `assets/images/adaptive-icon.png`  
- [ ] `assets/images/favicon.png`  
- [ ] `npx expo-doctor` passes  

**App Store Connect**  
- [ ] iPhone 6.7" screenshots (1290 x 2796) — 6 images  
- [ ] iPhone 6.5" screenshots (1242 x 2688) — 6 images  
- [ ] iPad Pro screenshots (optional)  

**Google Play Console**  
- [ ] 512 x 512 app icon (PNG) uploaded  
- [ ] 1024 x 500 feature graphic (PNG) uploaded  
- [ ] At least 6 phone screenshots (1080 x 1920+)  
