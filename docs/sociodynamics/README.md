# Landfalls — deploy copy

This is the static, public-deploy copy of the *Landfalls / Migration to
Aotearoa* scrolly. It is intended to be served over HTTPS from a static
host (GitHub Pages or equivalent).

## How to deploy

Drop the **contents** of this folder at the path your host serves from
(e.g. repo root, or `/docs` if GitHub Pages is configured to serve from
`/docs`). The `.nojekyll` marker skips Jekyll processing on GitHub Pages.

No build step. The site loads ES modules and `fetch()`es local data over
HTTP — both work natively on any static HTTPS host.

## What this folder is

Everything here is required at runtime:

```
.
├── .nojekyll          # Skips Jekyll processing on GitHub Pages
├── index.html         # Page content + structure
├── favicon.svg
├── styles/
│   └── frontiers.css
├── scripts/
│   ├── main.js
│   ├── core/          # Cross-cutting infrastructure (scroll, palette, mapbox, projection, svg)
│   └── chapters/      # Per-chapter render/init/actions modules
└── data/              # Eight runtime data files (geojson + csv + json)
```

## Mapbox token

The token in `scripts/core/mapbox-style.js` is URL-restricted to
`asrenninger.github.io` in the Mapbox dashboard. It will return 401s
from any other origin (including `localhost`); this is the URL
restriction working as intended.

## Where the source lives

This is a stripped, token-swapped copy. The development source — with
the unrestricted localhost token, the file:// portable-build script,
the dev sandbox pages, and the data-pipeline scripts — lives in the
sibling folder, e.g. `context/migration/` in the source repo.
