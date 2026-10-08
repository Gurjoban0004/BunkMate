# Vendored iOS tab bar

Copied from the user's `ios components` project on 2026-10-08:
`src/components/TabBar/{IOS26TabBar.tsx,IOS26TabBar.css,types.ts}` and
`src/tokens/ios-tokens.css`. The source package declares MIT licensing.

The original styles and tokens are preserved. Presence overrides host tokens
and supplies its existing icons/routes in `PresenceTabBar.web.js` and
`presence-tabbar.css`. The copied keyboard handler fixes Home/End to select
the first/last enabled destination instead of skipping those destinations.

These dimensions are design choices, not published Apple measurements.
Physical iPhone/Home Screen verification is still required. The source
project's `AGENTS.md` and `ios-pwa-engineering-standard-v2.md` describe that
verification procedure.
