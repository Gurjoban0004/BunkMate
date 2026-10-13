# Android updates

The current APK bundles the app screens. Deploying the web app or pushing Git
does not replace that bundle in installed APKs. Server data can update separately.

As inspected on October 9, 2026:

- AndroidManifest.xml explicitly sets `expo.modules.updates.ENABLED=false`.
- `expo-updates` is absent from package.json.
- app.json already has an EAS project ID, but no update URL or runtime version.
- eas.json has preview/production build environments but no update channels.

## Enable OTA in a future release

Use the existing Expo project and Android signing identity. Install the compatible
`expo-updates` package with `npx expo install expo-updates`, then configure EAS
Update with `npx eas-cli@latest update:configure`. Verify generated app config and
the committed native Android project: enabled updates, update URL, runtime version
and the intended channel must reach the native release, not only app.json.

Set separate preview/production channels on their build profiles. Build and test
a signed preview APK before the production APK. Users must install this new APK
once; their existing update-disabled APK cannot bootstrap itself using OTA.
Preserve package ID and signing key so users can update in place without uninstalling.

After compatible builds are distributed, a production JavaScript/assets update
can be published using:

```sh
npx eas-cli@latest update --channel production --environment production --message "Describe the tested change"
```

This command is for after configuration and device testing, not the current
unconfigured build. Native libraries, permissions and native configuration need
a new APK with a compatible new runtime. Keep runtime versions aligned with
native compatibility. Verify the backend URL and public environment in each
update, and test download/relaunch behavior on an installed release build.

No OTA configuration, APK build or update publication was performed in this change.

Official references: [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/),
[update compatibility](https://docs.expo.dev/eas-update/how-it-works/), and
[deployment workflow](https://docs.expo.dev/eas-update/deployment/).
