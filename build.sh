#!/bin/bash
set -e

npx expo export -p web

# Rename app shell
mv dist/index.html dist/app.html

# Inject PWA manifest + iOS meta tags into app shell
sed -i 's|<link rel="icon" href="/favicon.ico" /></head>|<link rel="icon" href="/favicon.ico" /><link rel="manifest" href="/manifest.json" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><meta name="apple-mobile-web-app-title" content="Presence" /></head>|' dist/app.html

# Copy landing page over dist
cp -r web-landing/* dist/

# Copy APK if it exists
mkdir -p dist/releases
cp public/releases/presence-latest.apk dist/releases/presence-latest.apk 2>/dev/null || true
