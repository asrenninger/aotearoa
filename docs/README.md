# Aotearoa — deploy build

Static GitHub Pages build served at **https://asrenninger.github.io/aotearoa/**.
Configure GitHub Pages to serve from the `main` branch `/docs` folder
(Settings → Pages → Source: Deploy from a branch → `main` / `/docs`).

No build step: the sites load ES modules and `fetch()` local data over HTTP,
which work natively on any static HTTPS host.

## Structure

```
.
├── .nojekyll            # skip Jekyll (don't mangle paths/underscored files)
├── index.html           # landing page — two tiles, live page-peek on hover
├── assets/              # landing tile graphics (extracted log-azimuthal maps)
│   ├── ringfire.svg     #   eruption-density surface, Auckland-centred
│   └── genetics.svg     #   Austronesian/Melanesian/Polynesian ancestry
├── geodynamics/         # "Convulsions" — fire, water, and a changing sky
└── sociodynamics/       # "Landfalls" — the arrivals that made Aotearoa
```

Each atlas is fully self-contained (relative paths only) and runs from its
own subfolder.

## Mapbox token

`scripts/core/mapbox-style.js` in each atlas selects the token by hostname:
the unrestricted dev token on `localhost`/`127.0.0.1`, and the token
URL-restricted to `asrenninger.github.io` on `*.github.io`. Nothing to swap
at deploy time.

## Source

Development source lives in the sibling working repo under `context/`:
`context/climate` → `geodynamics`, `context/migration` → `sociodynamics`,
with the landing page and the tile extractor (`_extract_maps.py`) at the
`context/` root.
