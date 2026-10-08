# Main capsule tab bar

The main navigation adapts the supplied `ios components` capsule to Presence's
existing visual system. It extends the current interface; it does not establish
a new design system. `src/theme/theme.js` remains the source for colors and Times
typography. The selected destination uses `inputBackground` with primary ink,
while other destinations use secondary ink. Capsule dimensions are integration
choices, not official Apple measurements.

## Integration

- Web uses the controlled vendored `IOS26TabBar`, existing Presence icons, and
  host theme overrides in `PresenceTabBar.web.js` and `presence-tabbar.css`.
  The vendor README records source and local keyboard changes.
- iOS uses `PresenceTabBar.ios.js`, React Navigation tab events, safe-area
  insets, and Expo `BlurView` (`expo-blur`). Native blur needs this dependency
  in the built app. Reduced transparency uses an opaque theme surface, and
  reduced motion disables capsule sliding. Android retains its existing bar.
- Today, Subjects, and Insights remain the main destinations. Admin is a
  web-only destination gated by the existing authenticated admin capability.
- Web reserves the capsule's footprint through `--ios-tabbar-reserved` and
  hides navigation while the software keyboard is open. Native height is
  reported to React Navigation for screen content layout.

## Evidence and remaining checks

The integration run reports 340 passing tests across 46 suites, a successful web
build, and successful native bundle exports. These checks establish code and
bundle viability; they do not establish native rendering or installed iPhone
Home Screen behavior.

Browser captures at `/private/tmp/presence-tabbar-review/` cover light mobile,
dark mobile with Admin, small dark mobile with Admin, and dark desktop with
Admin. They show navigation-only previews using the actual web component and
theme; no attendance data is loaded. The capsule keeps the incumbent warm
background/ink relationship, Times labels, restrained boundary, and theme-aware
selection surface. This evidence does not cover authenticated attendance
screens or physical device safe areas.

Physical iPhone/Home Screen and native iOS verification remain pending; an iOS
simulator was unavailable during this run. Check portrait and landscape safe
areas, keyboard opening/closing, screen scrolling above navigation, tab changes,
reduced motion/transparency, and each supported appearance. The supplied
project's `ios-pwa-engineering-standard-v2.md` describes its device procedure.

The web shell now sets Apple status-bar metadata to `default` instead of
`black-translucent`. Reinstall the Home Screen app after deploying this metadata
change before comparing device behavior. For an opt-in device readout, open the
app with `?debug=viewport` (or append `&debug=viewport` to an existing query).
The readout shows display mode, viewport sizes, safe-area values, keyboard state,
and Presence cache names to help identify viewport or stale-install differences.

## Existing documentation drift

`docs/design_system.md` still describes Plus Jakarta Sans and JetBrains Mono,
whereas the current theme explicitly uses Times New Roman on iOS/web and the
platform serif on Android. Some generic `GLASS` definitions also retain older
blue palette values; this capsule receives the active theme directly. Those
pre-existing differences are recorded here without repairing or replacing
incumbent documentation or tokens. `PRODUCT.md` and the existing design document
remain unchanged; this ordinary navigation extension creates no root
`DESIGN.md` or global design sidecar.
