# NaiClassicGames

An isolated pixel-art launcher for Pac-Wa, Naitris, NaiSnake, and Naippy Wa.

**Play online:** https://uikasama.github.io/NaiClassicGames/

## Offline desktop editions

The desktop edition includes the launcher and all four active game releases. It runs without Node.js or an internet connection on the player's computer.

| System | Download / build output | Open after extracting |
| --- | --- | --- |
| Apple silicon Mac | `out/NaiClassicGames-mac-arm64.zip` | `NaiClassicGames-darwin-arm64/NaiClassicGames.app` |
| Windows 10/11 x64 | `out/NaiClassicGames-win-x64.zip` | `NaiClassicGames-win32-x64/NaiClassicGames.exe` |

Build on the matching system with `npm ci` followed by `npm run desktop:package`. A Mac can also create the Windows ZIP with `npm run desktop:package -- --target=win32`. Run `npm run desktop:smoke` on each target system to check the packaged application offline. The [Build desktop games](.github/workflows/build-desktop.yml) GitHub Actions workflow makes and tests both ZIPs when manually started or when a `desktop-v*` tag is pushed. Its outputs appear as workflow artifacts.

These builds have no Developer ID or Windows publisher signature. macOS Gatekeeper and Windows SmartScreen may require a one-time manual approval for downloads. A download with no warning on the first double-click requires signing, and macOS also requires notarization. The QR code in the launcher points to the online website; playing the bundled games does not use it.

## Run the launcher

To run the launcher locally:

```bash
npm install
npm run dev
```

The launcher build never rebuilds or imports source files from the four games. It serves immutable snapshots from `public/games/<id>/<version>/`.

## Publish one game deliberately

```bash
npm run release:game -- --id pac-wa --version 1.0.1
npm run activate:game -- --id pac-wa --version 1.0.1
```

Releases are immutable. Publishing refuses to overwrite an existing version, and activation refuses versions that have not been published. To roll back, activate an older version.

Valid IDs are `pac-wa`, `naitris`, `naisnake`, and `naippy-wa`.

## Verify

```bash
npm run build
npm run test:e2e
```

## Play online

The public site is deployed from `main` to GitHub Pages by
`.github/workflows/deploy-pages.yml`. The workflow runs `npm ci` and
`npm run build`, then publishes `dist/`. The launcher and each game use
relative asset paths so the site works under a repository URL.
