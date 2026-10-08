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
- Screen headers receive the actual top inset, then add a 20px content gap
  (12px for compact detail headers). Paper screens explicitly set their outer
  SafeAreaView top and bottom edges to `off`: the installed web version of the
  safe-area library applies omitted array edges additively, so an array alone
  does not reliably exclude top padding. Left/right insets still protect
  landscape content.
- The capsule bottom inset is `max(8px, safe-area-bottom)` on web/iOS, with no
  subtraction. The capsule owns the bottom safe area once. Its 68px height and
  20px side margins are Presence integration choices, not Apple specifications.
- The web root fills the viewport with `position: fixed; inset: 0`. The document
  background follows the active theme. Keyboard handling uses the existing
  visual-viewport hook and hides navigation while the keyboard is open.

## Evidence and remaining checks

The October 8 correction supersedes the earlier component-only preview verdict:
user screenshots showed status-bar overlap and a bottom strip in the installed
Home Screen app. The user confirmed the original icon had never been replaced
since status-bar metadata changed from `black-translucent` to `default`.

Browser review now uses the actual Today, Subjects, and Insights components with
an isolated read-only conversion of the existing `research/erp-capture-10.json`.
This is captured college attendance, not generated records; the application
state and database are untouched. The capture covers two subjects and the
historical June/July register, not the user's current October attendance.
Safe-area inputs are injected for browser measurement; they do not simulate
Safari's installation metadata or prove physical-device rendering.

Captures under `.impeccable/review/` include a 393×852 portrait viewport with
47px top/34px bottom insets, a 430×932 viewport with 59px top/34px bottom insets,
a 375×667 viewport with zero insets, 844×390 landscape with 44px side/21px bottom
insets, and 1024×768 desktop. At 393×852, the root is 852px tall, Subjects starts
at y=67, and the capsule occupies y=750–818. The last Insights text scrolls above
the capsule. These checks establish browser geometry only. A fresh finish review returned
**ship**, explicitly scoped to these browser surfaces and the dense admin viewer.

The integration tests report 353 passes and one skipped test across 51 suites.
Production web and iOS bundle exports are checked separately from device
rendering. Physical iPhone/Home Screen and native iOS verification remain
pending; no device or simulator capture is available.

After deploying, open the existing installation and use Settings → Download
attendance backup before replacing its Home Screen icon. The download contains
existing attendance and settings, excludes credentials, and does not modify
records. Keep the file: this export does not provide an automatic restore flow.
An older installation may retain its prior status-bar/display metadata, so
remove and re-add the icon through Safari after saving the backup. Request a
new screenshot from that installed Home Screen app; this remains **not verified
on device**.

For an opt-in readout, open `?debug=viewport` (or append `&debug=viewport` to an
existing query). It shows display mode, viewport and root sizes, safe-area
values, capsule position, keyboard state, and Presence cache names. Guidance:
[WebKit's viewport-fit and safe-area explanation](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
and [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout).

## Existing documentation drift

`docs/design_system.md` still describes Plus Jakarta Sans and JetBrains Mono,
whereas the current theme explicitly uses Times New Roman on iOS/web and the
platform serif on Android. Some generic `GLASS` definitions also retain older
blue palette values; this capsule receives the active theme directly. Those
pre-existing differences are recorded here without repairing or replacing
incumbent documentation or tokens. `PRODUCT.md` and the existing design document
remain unchanged; this ordinary navigation extension creates no root
`DESIGN.md` or global design sidecar.
