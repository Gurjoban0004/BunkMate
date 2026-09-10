#!/bin/bash
# Verifies the APK download path end to end: the site redirects off Vercel, and
# the release asset is reachable, complete, and resumable. Run after any deploy
# that touches the redirect in vercel.json.
#
# Usage: bash scripts/check-apk-download.sh [site-url]
set -u
SITE="${1:-https://presence.runs-on.dev}"
URL="$SITE/releases/presence-latest.apk"
fail=0

loc=$(curl -sI "$URL" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
case "$loc" in
  https://github.com/*/releases/download/*) echo "ok   redirect -> $loc" ;;
  "") echo "FAIL no redirect — Vercel is still serving the 61 MB file itself"; fail=1 ;;
  *)  echo "FAIL unexpected redirect target: $loc"; fail=1 ;;
esac

read -r code len < <(curl -sIL "$URL" | tr -d '\r' | awk '
  tolower($1)=="content-length:"{len=$2} /^HTTP/{code=$2} END{print code, len+0}')
[ "$code" = "200" ] && [ "$len" -gt 40000000 ] \
  && echo "ok   asset reachable: $code, $len bytes" \
  || { echo "FAIL asset not reachable: code=$code len=$len (is the release uploaded?)"; fail=1; }

rcode=$(curl -sL -o /dev/null -r 0-1023 -w '%{http_code}' "$URL")
[ "$rcode" = "206" ] && echo "ok   range requests supported (downloads can resume)" \
  || { echo "FAIL no range support: $rcode"; fail=1; }

[ "$fail" = 0 ] && echo "PASS" || echo "FAILED"
exit $fail
