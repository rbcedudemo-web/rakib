# Android app (stage D7)

Expo app that opens the student portal (https://rakib-azure.vercel.app) in a native
shell: same accounts, lessons, exams and results as the website, plus a splash screen,
the Android back button, camera access for answer-sheet photos, an offline screen,
and outside links opened in the phone's browser.

- Site address and first page: `app.json` → `expo.extra.siteUrl`, `expo.extra.startPath`.
- The app is not part of the npm workspaces (React Native needs its own dependency tree):
  `cd apps/mobile && npm ci`.
- Typecheck: `npm run typecheck`.

## APK
GitHub Actions workflow `.github/workflows/android.yml` runs `expo prebuild` and
`./gradlew assembleRelease` on every change to `apps/mobile/` (and on demand) and
uploads `rupshi-android-apk` as a build artifact. The APK is signed with the
standard debug key: fine for installing directly on phones for the demo, not for
the Play Store (that needs a release key later).
