# Shipping Death Row Derby on itch.io and Steam

## The builds

| Build | Command | Output | For |
| --- | --- | --- | --- |
| Web | `sh tools/release.sh` | `dist/death-row-derby-<date>-<sha>.zip` | itch.io, played in the browser |
| Desktop | `sh tools/desktop.sh` | `dist/desktop/Death Row Derby-{win32,linux,darwin}-x64.zip` | Steam, and itch.io downloads |

The desktop build is the web build wrapped in Electron (`desktop/main.js`). It starts fullscreen; F11 or Alt+Enter toggles fullscreen, and the game's Exit quits. Saves live in the app's own data folder.

The Windows and macOS builds are unsigned:
- **Windows:** the first launch shows a SmartScreen warning ("More info", then "Run anyway"). A code-signing certificate removes it.
- **macOS:** Gatekeeper blocks unsigned apps unless the player right-clicks and chooses Open. Signing and notarising need an Apple Developer account ($99/year) and a Mac to build on.

On Steam, I'd ship **Windows and Linux** first. Steam Deck runs the Windows build through Proton and the Linux build natively.

## Before either store

- [ ] **Credits.** These are in-game (title screen, then Credits) and in `CREDITS.txt` in every build. The voices are CC BY 4.0 and need that credit wherever the game ships, so keep it.
- [ ] **Licences.** `licenses/` in every build holds the fonts' OFL texts and three.js's MIT licence.
- [ ] **A version number.** `desktop/package.json` holds it (0.9.0 now).
- [ ] **Screenshots and a trailer** (1920×1080), captured from the desktop build.

## itch.io (free, live the same day)

1. Create a project. Kind of project: **HTML**.
2. Upload the web zip and tick **"This file will be played in the browser"**. Set the viewport to 1280×720, tick **Fullscreen button**, and leave "Mobile friendly" off (it's mouse-aimed).
3. Upload the desktop zips too, tagged Windows, Linux and macOS, for people who want to download it.
4. Set the price: free, pay-what-you-want, or a minimum.
5. Optional: use itch's command-line uploader, **butler** (`butler push`), to send updates without re-uploading everything.

## Steam

1. Join **Steamworks** (partner.steamgames.com). You'll need identity, tax and bank details, and the **$100 Steam Direct fee** per game (paid back to you after $1,000 in sales).
2. Make the **store page**:
   - Description, at least 5 screenshots, a trailer, and tags.
   - The mature content survey (it's a violent game, so answer it honestly).
   - Capsule images: header 920×430, small 462×174, main 1232×706, vertical 748×896, page background 1438×810, library 600×900, library hero 3840×1240, library logo 1280×720.
3. Publish it as **Coming Soon**. Steam requires at least two weeks of that before launch, and wishlists build up meanwhile.
4. **Upload the builds** with SteamPipe (steamcmd and the ContentBuilder scripts), one depot each for Windows and Linux. Launch options:
   - Windows: `Death Row Derby.exe`
   - Linux: `Death Row Derby`
5. Submit the store page and the build for **review** (a few business days each), then release.

Optional later: Steam achievements and cloud saves, through `steamworks.js` in the Electron app.
