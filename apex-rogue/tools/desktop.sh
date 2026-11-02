#!/bin/sh
# Builds the desktop versions (Windows, macOS, Linux) for Steam and itch.io: the release build (tools/release.sh)
# wrapped in Electron (desktop/main.js). Output: dist/desktop/Death Row Derby-<platform>-x64/ and a zip of each.
# Needs network access the first time (npm and the Electron download). Windows and macOS builds are unsigned.
set -e
cd "$(dirname "$0")/.."
sh tools/release.sh
rm -rf desktop/game && cp -r dist/death-row-derby desktop/game
cd desktop
npm install --no-audit --no-fund --loglevel=error
PLATFORMS=${PLATFORMS:-linux,win32,darwin}
npx electron-packager . "Death Row Derby" --platform="$PLATFORMS" --arch=x64 --out=../dist/desktop --overwrite --asar \
  --app-version="$(node -p "require('./package.json').version")" --ignore='^/\.gitignore$'
cd ../dist/desktop
for d in */; do d=${d%/}; rm -f "$d.zip"; zip -qry "$d.zip" "$d"; echo "$d.zip ($(du -h "$d.zip" | cut -f1))"; done
