# Methodology & sources — The Made Land (draft)

Built on the migration atlas system (see `context/STYLE-WEB.md`). Plain static
HTML/CSS/JS, native ES modules, Mapbox GL the only runtime dependency.

```sh
python3 -m http.server 8788 --bind 127.0.0.1 --directory context/climate
# then open http://localhost:8788
```

## What is fully built vs. placeholder (draft state)

| Chapter | Modality | Status |
|---|---|---|
| 1 Gondwana | **D3 bathymetric map** | real GMRT bathymetry (zealandia-bathy.json) |
| 2 Ring of Fire | static **log-azimuthal KDE** + **Mapbox satellite/3D-terrain scrolly** | KDE from real eruptions; satellite + DEM terrain, pitched for perspective |
| 3 Rangitoto | **bespoke animation** | fully built |
| 4 Fire remembered (TVZ) | **D3 map** | real NI coastline + real volcano coords + fire-route |
| 5 The newcomers | static SVG | indicative forest-cover figure |
| 6 Tarawera | **D3 chart** | real NZ eruptions by VEI (nz-eruptions.json) |
| 7 The land shakes | static SVG (animated reveal) | quake timeline |
| 8 The air changes (CO₂) | **chart-scrolly** | real Keeling Curve |
| 9 The ozone hole | **south-polar log-azimuthal scrolly** | REAL OMI ozone field (soft DU gradient, morphs calm↔deep by year's area); real area record; melanoma chart |
| 10 Still shaking | static SVG | candidate to become a Mapbox scrolly (Christchurch) |
| 11 The heat | static SVG (rendered) | real ERA5 warming stripes + line |
| 12 Futures | static SVG (rendered) | scenario fan, smoothed curves |
| 13 The made land | static | summary grid + coda |

## Real data now wired in (build scripts in `data/build/`)

- **Ring of Fire KDE (ch2 static map)** — `volcano-kde.json`, built by
  `build-volcano-kde.py` from the TidyTuesday / Smithsonian GVP dataset
  (`volcano.csv`, `eruptions.csv`): a density grid over 11,178 recorded eruptions,
  drawn with `d3.contours` on the log-azimuthal projection. Real.
- **CO₂ Keeling Curve (ch8)** — `co2-monthly.json`, built by `build-co2.py` from
  NOAA's Mauna Loa monthly record (`co2_mm_mlo.txt`, through 2026, 431 ppm), spliced
  to Law Dome ice-core anchors before 1958. Real monthly sawtooth.
- **NZ warming (ch11)** — `nz-temp-annual.json`, built by `fetch-nz-temp.py` from
  ERA5 reanalysis (Open-Meteo archive), a five-point national mean (Kaitaia, Auckland,
  Wellington, Christchurch, Dunedin), 1940–2024, anomalies vs the 1991–2020 mean.
  Drives both the warming stripes and the anomaly line; warmest year (2022) marked
  dynamically. Note: ERA5 1940– differs from the NIWA seven-station record (1909–);
  the prose still cites NIWA's +1.1°C-since-1909 figure, the figure shows ERA5.
- **Zealandia bathymetry (ch1)** — `zealandia-bathy.json`, built by `build-bathymetry.py`
  from a GMRT ESRI-ASCII grid (`gmrt.asc`, region lon 122–180°E, lat −56..−21°S so the
  continent's northern arm — New Caledonia, Lord Howe Rise — is included): real depth, drawn
  with d3.contours as translucent blue bands, archipelago in land colour. Full-bleed (100vw),
  cropped to the box corners (straight edges, no geodesic curvature). East edge stops at the
  180° dateline deliberately (crossing it would require stitching two GMRT grabs).
  Inset: `data/plate-boundaries.json` (PB2002 plate boundaries, Bird 2003, via fraxen/
  tectonicplates) — a white wireframe of all Earth's plate boundaries with a red locator box.
- **TVZ map (ch4)** — real Taupō Volcanic Zone volcano coordinates on a North Island
  coastline (world-atlas), with the legend's fire-route threaded through them.
- **NZ eruptions (ch6)** — `nz-eruptions.json`, built from `eruptions.csv` (Smithsonian
  GVP): every eruption since 1000 CE by year and VEI; Tarawera 1886 and Kaharoa ~1314
  (both Okataina VEI 5) highlighted.
- **Ozone field (ch9)** — `ozone-field.json` + `build-ozone.py`: two REAL OMI total-column
  ozone images from NASA GIBS (`OMI_Ozone_TOMS_Total_Column`) inverted to Dobson-Unit grids
  via the GIBS colormap (`cm.xml`) — a record deep-hole spring day (2015-10-04) and a calm
  summer day (2016-01-15). The map morphs between them by each year's measured hole area, so
  the soft, irregular real field grows then heals on scroll; 220 DU contour = the hole edge.
  Honest framing (corrects a common misread): the hole sits over Antarctica and rarely covers
  NZ/AU — they sit just north of its edge, where ozone-poor air spills over the Southern Ocean;
  their high UV is mostly naturally-thin southern ozone + clean air + orbital geometry.
  `scan-ozone-days.py` picked 2015-10-04 as the day whose low-ozone tongue reaches furthest
  toward the Australia/NZ sector. Area record: NASA Ozone Watch annual maxima (hardcoded).
- **Ring of Fire scrolly (ch2)** now uses Mapbox `satellite-streets-v12` + `mapbox-dem`
  3D terrain (exaggeration 1.5) + sky, pitched on the Alpine Fault and TVZ steps. An
  optional GEBCO WMS bathymetry raster is attempted for the trench step (graceful if it
  fails to load).

## d3 polygon-winding gotcha (fixed; watch for it)

`d3.geoPath` / `fitExtent` treat a lon/lat bbox polygon as its *complement* (the whole
world minus the box) if it is wound counter-clockwise — the map then renders the entire
globe. Region-clip bboxes (ch1, ch4) must be wound **clockwise**.

Also: `d3.contours` is not periodic in longitude, so a contour that encircles a pole on a
global −180..180 grid gets closed across the seam, drawing a chord across the map. Filled
bands hide it; a *stroke* on the contour exposes it. The ch9 ozone field therefore fills the
bands (no contour stroke) and uses a deep-violet sphere base so the <130 DU core reads as
"deepest", with no seam line.

## Notes for re-running the build

- `fetch-nz-temp.py` spaces requests and backs off on HTTP 429 (Open-Meteo rate-limits
  rapid multi-point pulls). If it times out, the network is the cause — re-run later.
- `serve.py` (used by the `frontiers-climate` launch config) sends `no-store` so edits
  show on reload. Some embedded browsers still cache ES modules aggressively; bump the
  `?v=` query on a changed module's import to force a fresh fetch (project convention).

## Data caveats still to resolve

- **Mapbox-scrolly volcanoes & fault traces (ch2)** are a curated/hand-simplified set
  for legibility (the static KDE map uses the full real dataset).
- **Forest cover (ch5)**, **futures fan (ch12)** and other illustrative figures use
  rounded/representative values per the published headline figures.

## Contested / nuanced facts (flagged in the prose where load-bearing)

- **Rangitoto age:** radiocarbon ~1400–1450 CE (~550–600 yr); two-phase chronology debated.
  Māori witnessed it (Motutapu footprints); no surviving oral tradition of the eruption.
- **Tarawera 1886 toll:** commonly ~120; estimates 108–153.
- **1931 Napier magnitude:** M_W ~7.4–7.6 vs the popular M_S 7.8; 256 official deaths.
- **NZ melanoma:** among the world's highest, but multi-causal (fair skin, outdoor
  lifestyle, orbital geometry, naturally low SH ozone) — the ozone hole sharpened,
  not solely caused, the risk.

## Key sources

- Geology / tectonics: GNS Science; Te Ara (Encyclopedia of NZ); East Coast LAB (Hikurangi).
- Volcanoes / eruptions: GNS Science; Te Ara; Science Learning Hub; NZHistory (Tarawera).
- Earthquakes: GeoNet; GNS Science; Te Ara; NZHistory.
- Atmosphere: NOAA / Scripps (Keeling Curve); NIWA (Baring Head); Nobel/Molina–Rowland;
  British Antarctic Survey & WMO (ozone hole); UNEP (Montreal Protocol, Kigali Amendment).
- UV / health: NIWA; EHINZ; Cancer Society NZ.
- Warming & projections: NIWA seven-station series; NIWA / Ministry for the Environment
  (CMIP6 projections, 2024); NZ SeaRise (sea-level).
