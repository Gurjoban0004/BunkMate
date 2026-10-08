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
- The capsule overlays the page without a full-width backing strip. Shared
  `TabScrollView` adds clearance to scrolling content on ten main screens:
  `--ios-tabbar-reserved` on web and measured tab-bar height on iOS. The outer
  web screen no longer reserves a blank footer; old fixed footer spacers are
  removed. Navigation hides while the software keyboard is open.
- Web avoids applying safe-area padding twice, and its header omits the native
  14px top floor. The document background follows the active theme. The capsule
  bottom inset is `max(8px, safe-area-bottom - 16px)` on web/iOS; the native
  wrapper is an absolute transparent overlay. Physical-device placement still
  needs verification.

## Evidence and remaining checks

The corrected integration run reports 345 passing tests and one skipped test
across 48 suites, a successful production web build, and successful final native
bundle exports. These checks establish code and bundle viability; they do not
establish native rendering or installed iPhone
Home Screen behavior.

Current browser captures at `/private/tmp/presence-layout-fix-review/` cover
mobile top and end-of-scroll positions, dark mobile, and dark desktop. They
use the actual header, scroll, and navigation components without attendance
data. Content extends behind the capsule and the last item scrolls above it.
The capsule preserves the incumbent warm background/ink relationship, Times
labels, restrained boundary, and theme-aware selection surface. A fresh finish
review returned **ship**, scoped to these web layout previews. Authenticated
Today, physical iPhone safe areas, and native rendering are outside that verdict.

Physical iPhone/Home Screen and native iOS verification remain pending; an iOS
simulator was unavailable during this run. Check portrait and landscape safe
areas, keyboard opening/closing, screen scrolling above navigation, tab changes,
reduced motion/transparency, and each supported appearance. The supplied
project's `ios-pwa-engineering-standard-v2.md` describes its device procedure.

The preceding integration changed Apple status-bar metadata from
`black-translucent` to `default`; this layout correction makes no further metadata
change. Reinstall the Home Screen app before comparing device behavior: an older
installation may retain its prior metadata and a white bottom strip. This has
not been verified on a physical iPhone. For an opt-in device readout, open the
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
