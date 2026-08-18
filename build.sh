#!/bin/bash
set -e

npx expo export -p web

# Rename app shell
mv dist/index.html dist/app.html

# Inject PWA manifest + iOS meta tags into app shell
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' 's|<link rel="icon" href="/favicon.ico" /></head>|<link rel="icon" href="/favicon.ico" /><link rel="manifest" href="/manifest.json" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><meta name="apple-mobile-web-app-title" content="Presence" /></head>|' dist/app.html
else
  sed -i 's|<link rel="icon" href="/favicon.ico" /></head>|<link rel="icon" href="/favicon.ico" /><link rel="manifest" href="/manifest.json" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><meta name="apple-mobile-web-app-title" content="Presence" /></head>|' dist/app.html
fi

# Copy landing page over dist
cp -r web-landing/* dist/

# Vercel Web Analytics — Vercel serves this script itself on deploy, so there is
# no package to install and nothing to configure in code. Injected at build time
# rather than committed into the HTML so local dev does not 404 on it.
# Requires Web Analytics to be enabled for the project in the Vercel dashboard.
node -e "
const fs = require('fs');
const tag = '<script defer src=\"/_vercel/insights/script.js\"></script>';
for (const f of ['dist/app.html', 'dist/index.html']) {
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, 'utf8');
  if (html.includes('/_vercel/insights/script.js')) continue;
  if (!html.includes('</head>')) { console.warn('No </head> in ' + f + ' — analytics not injected'); continue; }
  fs.writeFileSync(f, html.replace('</head>', tag + '</head>'));
  console.log('Vercel Analytics injected into ' + f);
}
"

# Copy APK if it exists
mkdir -p dist/releases
cp public/releases/presence-latest.apk dist/releases/presence-latest.apk 2>/dev/null || true
