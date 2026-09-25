# NaiClassicGames

An isolated pixel-art launcher for Pac-Wa, Naitris, NaiSnake, and Naippy Wa.

**Play online:** https://uikasama.github.io/NaiClassicGames/

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
