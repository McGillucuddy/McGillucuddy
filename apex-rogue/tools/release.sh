#!/bin/sh
# Builds a playtest release of the game: the first-person game (prototype.html) as index.html, only the files it
# loads, and the build stamped on the title screen. Output: dist/death-row-derby/ and dist/death-row-derby-<build>.zip,
# ready to upload to itch.io (Kind: HTML, "played in the browser") or to drop on Netlify.
set -e
cd "$(dirname "$0")/.."
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
BUILD="playtest $(date +%Y-%m-%d) ${SHA}"
OUT=dist/death-row-derby
rm -rf "$OUT" && mkdir -p "$OUT/js/voices" "$OUT/vendor"
# The page itself: mark it as a release (hides dev-only links) and stamp the build.
sed "s#<script src=\"vendor/three.min.js\"></script>#<script>window.RELEASE = true; window.BUILD = '${BUILD}';</script>\n  <script src=\"vendor/three.min.js\"></script>#" prototype.html > "$OUT/index.html"
grep -q "window.RELEASE" "$OUT/index.html" || { echo "release.sh: couldn't stamp index.html"; exit 1; }
cp style.css fonts.css "$OUT/"
cp vendor/three.min.js vendor/three.LICENSE "$OUT/vendor/"
for f in $(grep -o 'src="js/[^"]*"' prototype.html | sed 's/src="//; s/"$//'); do cp "$f" "$OUT/$f"; done
ZIP="dist/death-row-derby-$(date +%Y%m%d)-${SHA}.zip"
rm -f "$ZIP" && (cd "$OUT" && zip -qr "../$(basename "$ZIP")" .)
echo "$BUILD -> $ZIP ($(du -h "$ZIP" | cut -f1))"
