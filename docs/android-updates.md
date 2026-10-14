# Android updates and reminders

Software setup completed on October 13, 2026. No APK was built and no update
was published. Deploying the web app or pushing Git alone does not update an
installed APK.

## OTA configuration

The existing EAS project `ee79b872-6146-48c5-961e-806e5e54186a` is reused:

- SDK 54's compatible `expo-updates` package is installed.
- `app.json` enables updates at `https://u.expo.dev/ee79b872-6146-48c5-961e-806e5e54186a`
  with the `fingerprint` runtime policy, startup checking and zero cache wait.
- The committed Android manifest also enables updates, sets the same URL,
  reads `@string/expo_runtime_version` and selects the production channel.
  The `file:fingerprint` resource is the SDK 54 sentinel: the updates Gradle
  plugin creates the fingerprint asset during a future native build.
- EAS build profiles select `development`, `preview` and `production` channels.
  A direct local release uses the committed production header. Change that
  native header before a local preview build; EAS Build uses its profile channel.

Installed APKs with updates disabled must receive one new APK first. Preserve
`com.presence.app` and the existing signing key and increase the Android version
code for that future release. Compatible JavaScript/assets updates download at
startup and activate after download on the next restart. Cached/embedded code
provides offline startup; update recovery protections remain enabled. Native
library, permission or configuration changes require a new compatible APK.
See [Expo's setup guide](https://docs.expo.dev/eas-update/getting-started/) and
[runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/).

## Publishing after the future APK is tested

Confirm access to the existing Expo project and install a signed preview APK on
a real Android device first. Verify its channel and runtime, then publish to
preview and test download/relaunch before production:

```sh
npx eas-cli@latest update --platform android --channel preview --environment preview --message "Describe the tested change"
npx eas-cli@latest update --platform android --channel production --environment production --message "Describe the tested change"
```

These are future publication commands, not commands run in this change. Set
`EXPO_PUBLIC_API_BASE_URL=https://presence.runs-on.dev` in the corresponding EAS
environments before publishing. Values inside `eas.json` build-profile `env`
are not an update environment; remote environment contents have not been
verified here. Check every bundle's public configuration and do not put secrets
in `EXPO_PUBLIC_*`. See [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

The official [Expo UpdatesAPIDemo](https://github.com/expo/UpdatesAPIDemo) was
pulled into a temporary research directory. Its development-only runtime
override example was not copied into Presence.

## Android local notifications

- Create the `daily-plan` channel before requesting Android notification
  permission. Use the channel in both scheduled and immediate triggers.
- Morning reminders schedule the next seven days with classes at the saved
  reminder time (default 07:30). Opening/syncing the app and changes to the plan,
  subjects, records, holidays or timetable refresh them. They do not replenish
  indefinitely while the app is closed.
- Saved-plan messages follow that date's safe Skip/Attend choices and class
  times. Unsafe choices become Attend; paused plans request a sync. Without a
  saved plan, subject budgets use full pairs and debit repeated classes rather
  than spending the same allowance twice. Holidays and cancellations are omitted.
- Goal alerts use each subject's configured minimum. Delivery flags are saved
  only after scheduling succeeds. Existing disabled preferences are preserved;
  denied permission leaves an attempted enable switch off.

Android's battery/alarm policy can delay reminders; exact-alarm permission was
not added. These are local morning/goal notifications. Native remote push/FCM
credentials and registration are not configured by this change. Web/PWA push
keeps its existing separate implementation. The OS permission is still the
student's choice. See [Expo notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

## Verification and remaining device checks

Android manifest/config agreement, Expo autolinking for the updates module and
Gradle plugin, and generated/runtime fingerprint agreement were checked without
a native build. Production JavaScript exports passed. Automated checks cover
permission order, denied permission, saved-plan guidance, unsafe/stale plans,
holidays/cancellations, time fallback and successful-delivery flags.

After the future APK is installed, test a preview update across two cold launches,
offline launch, Android 13+ permission accept/deny, a scheduled reminder and a
goal alert. Verify reminder toggles, saved-plan changes and restart persistence.
Physical delivery, installed OTA loading and native build compatibility remain
unverified; Expo Go and a browser are not evidence for those release behaviors.
