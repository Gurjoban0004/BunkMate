# Main capsule tab bar

Presence adapts the supplied capsule to its existing theme and navigation.
`src/theme/theme.js` supplies colors and serif typography. Selected destinations
use `inputBackground` and primary ink; other labels use secondary ink. Dimensions
below are Presence integration choices, not Apple specifications.

## Layout and behavior

- Web uses the controlled vendored `IOS26TabBar`, Presence icons and host
  overrides in `PresenceTabBar.web.js` and `presence-tabbar.css`: 64px height,
  20px horizontal insets, 6px bottom inset and 420px maximum width. The host
  layer is absolute in the same containing block as the page.
- `webShellStyles.js` gives `html`/`body` 100dvh height with a 100% fallback.
  `#root` uses `position: absolute; inset: 0; height: 100%`, avoiding separate
  fixed coordinate systems. App.js updates document background and theme-color
  to the current theme. Existing viewport-fit=cover and default status-bar
  metadata remain in place.
- Native iOS uses `PresenceTabBar.ios.js`, React Navigation events and Expo
  `BlurView`. Bottom padding is `Math.max(6, insets.bottom)`, preserving the
  home-indicator inset. The navigator receives the real inset; only screen
  children receive bottom zero so the capsule owns clearance once. Android
  retains its existing bar.
- Today, Subjects and Insights are the main destinations. Admin stays web-only
  and gated by the existing authenticated capability. The capsule overlays
  content without a full-width backing strip.
- `TabScrollView` reserves scrolling clearance using `--ios-tabbar-reserved`
  on web and measured bar height on iOS; the skip calendar supplies its own
  clearance. Headers use actual top/side insets.
- Navigation hides when the software keyboard opens. The existing web
  visual-viewport root override remains active for that state. Native reduced
  motion disables sliding and reduced transparency uses an opaque theme surface.
  Web retains CSS preferences and the blur fallback.

## Evidence and unresolved device check

Current `.impeccable/review/compact-calendar/` browser evidence covers 390×844
with injected 47px top/0px bottom insets, 320×667 and 1024×768. At 390×844 the
root is 844px tall and the 64px capsule occupies y=774–838, leaving 6px below.
Actual screens/shell use temporary adapters and two real subjects from a
sanitized historical July register, with no app records or storage writes.
Injected insets do not reproduce installed Safari behavior.

Final **SHIP** covers closure of three specific review findings, including the
native inset correction in source. It is not a second full-surface clearance or
device verdict. Earlier placement verdicts cannot validate the user-rejected
installed layout. Test/export results are in
[combined-skip-plan.md](combined-skip-plan.md).

The iPhone 13 Home Screen white gap and requested lower placement are **not
verified on device**; no physical device or simulator capture was available.
After updating, inspect the existing Home Screen installation and obtain a
fresh screenshot before claiming the gap or placement is fixed. There is no
evidence that this layout requires deleting and re-adding the icon.

`?debug=viewport` (or `&debug=viewport`) shows display mode, viewport/root sizes,
safe areas, capsule position, keyboard state and Presence cache names. Keyboard,
font scaling, VoiceOver and TalkBack need device checks. Dark browser captures
do not establish native dark behavior.

## Incumbent context

This integration was compared with the theme, navigation, PRODUCT.md,
`docs/design_system.md` and current captures. The design document names Plus
Jakarta Sans and JetBrains Mono; implementation uses Times on iOS/web and
platform serif on Android. Generic `GLASS` definitions retain older palette
values, while this capsule receives the active theme. Those pre-existing
differences remain without changing product guidance, tokens, global design
documentation or a sidecar.
