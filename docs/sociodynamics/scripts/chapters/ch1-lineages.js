/**
 * Chapter 1 — "The sea was a road" (layered ancestry figure).
 *
 * Renders the Austronesian / Papuan / Polynesian ancestry surfaces
 * into the SVG slot in index.html. The surfaces are schematic: weights
 * the authors assigned to AADR sample locations, smoothed in the
 * precomputed data/maori-lineage-grids.json. They are not admixture
 * estimates, and the caption in index.html says so. Shares the log-azimuthal projection
 * (Auckland-centred) with ch12's two-tides flow maps; the projection
 * helpers live in core/projection.js.
 *
 * Static figure — fired once at page load. Idempotent: a re-run is
 * harmless since `svg.selectAll("*").remove()` would clear the mount,
 * but the existing one-shot pattern avoids it.
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

import { AKL, logAzimuthalRaw } from '../core/projection.js';

const PARAMS = { S: 1.4, B: 170 };

// Layered ancestry surfaces. Paint order matters: Austronesian (the broad
// root) first, then Melanesian over it, then Polynesian (the Pacific
// sub-branch) on top so its red signal reads on the cream paper.
const PAINT_ORDER = ["austronesian", "melanesian", "polynesian"];
const THRESHOLDS = [0.10, 0.22, 0.36, 0.52, 0.70];
const LAYER_ALPHA = {
  austronesian: { lo: 0.12, hi: 0.62 },
  melanesian:   { lo: 0.14, hi: 0.68 },
  polynesian:   { lo: 0.16, hi: 0.70 },
};

function withAlpha(hex, alpha) {
  const c = d3.color(hex).rgb();
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`;
}

export async function render() {
  const mount = document.getElementById("lineage-fig-map");
  if (!mount) return;  // chapter not present in this build

  let world, data;
  try {
    [world, data] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"),
      d3.json("./data/maori-lineage-grids.json?v=2"),
    ]);
  } catch (err) {
    console.warn("ch1-lineages: failed to load data", err);
    return;
  }
  const land = topojson.feature(world, world.objects.land);

  const meta = data.grid_meta;
  const lonStep = (meta.lon_max - meta.lon_min) / (meta.n_lon - 1);
  const latStep = (meta.lat_max - meta.lat_min) / (meta.n_lat - 1);
  const toLonLat = ([x, y]) => [meta.lon_min + x * lonStep, meta.lat_min + y * latStep];

  // Figure canvas — square disc, dominant centre. Width fills the figure
  // slot; viewBox keeps the proportions stable.
  const W = 820, H = 880;
  const mapTop = 12, mapBot = 740, mapL = 12, mapR = W - 12;

  const svg = d3.select(mount).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("class", "lineage-fig-svg");

  const raw = logAzimuthalRaw(PARAMS.S, PARAMS.B);
  const projection = d3.geoProjection(raw)
    .rotate([-AKL[0], -AKL[1]])
    .clipAngle(PARAMS.B - 0.001);
  const cap = d3.geoCircle().center(AKL).radius(Math.min(PARAMS.B - 0.5, 179.5))();
  projection.fitExtent([[mapL, mapTop], [mapR, mapBot]], cap);
  const path = d3.geoPath(projection);

  svg.append("path").attr("class", "lf-sphere").attr("d", path({ type: "Sphere" }));
  svg.append("path").attr("class", "lf-graticule").attr("d", path(d3.geoGraticule10()));
  svg.append("path").attr("class", "lf-land").attr("d", path(land));

  // Heat layers --------------------------------------------------------------
  const layersById = new Map(data.layers.map(L => [L.id, L]));
  const tRange = THRESHOLDS[THRESHOLDS.length - 1] - THRESHOLDS[0];

  for (const lid of PAINT_ORDER) {
    const L = layersById.get(lid);
    if (!L) continue;
    const aRange = LAYER_ALPHA[lid];
    const rawContours = d3.contours()
      .size([meta.n_lon, meta.n_lat])
      .thresholds(THRESHOLDS)(L.values);
    const projContours = rawContours.map(c => ({
      ...c,
      coordinates: c.coordinates.map(poly =>
        poly.map(ring => ring.map(toLonLat))
      ),
    }));
    const g = svg.append("g").attr("class", `lf-layer lf-${lid}`);
    g.selectAll("path.lf-heat").data(projContours).join("path")
      .attr("class", "lf-heat")
      .attr("d", d => path(d))
      .attr("fill", d => {
        const t = (d.value - THRESHOLDS[0]) / tRange;
        const alpha = aRange.lo + (aRange.hi - aRange.lo) * t;
        return withAlpha(L.color, alpha);
      });
  }

  // Coastline above heat so coasts remain legible through the wash
  svg.append("path").attr("class", "lf-land-over").attr("d", path(land));

  // Place labels for orientation --------------------------------------------
  const PLACES = [
    { lonlat: [121.0, 23.7],   text: "Taiwan",          dx: 14,  dy: 0 },
    { lonlat: [121.0, 17.1],   text: "Luzon",           dx: 14,  dy: 6 },
    { lonlat: [115.0,  0.0],   text: "Borneo",          dx: -8,  dy: 12, ha: "end" },
    { lonlat: [145.0, -5.0],   text: "New Guinea",      dx: 0,   dy: 22 },
    { lonlat: [168.4, -17.8],  text: "Vanuatu",         dx: 12,  dy: 4 },
    { lonlat: [-175.1, -21.2], text: "Tonga",           dx: 12,  dy: 4 },
    { lonlat: [-151.4, -16.8], text: "French Polynesia",dx: 12,  dy: 4 },
    { lonlat: [-157.8,  21.3], text: "Hawaiʻi",         dx: 12,  dy: 4 },
    { lonlat: [145.7,  15.2],  text: "Mariana Islands", dx: 12,  dy: -8 },
    { lonlat: [174.45, -41.3], text: "Aotearoa",        dx: -10, dy: 22, ha: "end" },
  ];
  const gLbl = svg.append("g");
  PLACES.forEach(p => {
    const xy = projection(p.lonlat);
    if (!xy) return;
    gLbl.append("text")
      .attr("class", "lf-place-label")
      .attr("x", xy[0] + p.dx)
      .attr("y", xy[1] + p.dy)
      .attr("text-anchor", p.ha || "start")
      .text(p.text);
  });

  // Auckland marker
  const akl = projection(AKL);
  const gAkl = svg.append("g");
  gAkl.append("circle").attr("class", "lf-akl-dot")
    .attr("cx", akl[0]).attr("cy", akl[1]).attr("r", 3.6);
  gAkl.append("text").attr("class", "lf-akl-label")
    .attr("x", akl[0] + 7).attr("y", akl[1] - 7)
    .text("Auckland");

  // Legend ------------------------------------------------------------------
  const legY = mapBot + 22;
  const legX = mapL + 8;
  const legend = svg.append("g").attr("transform", `translate(${legX}, ${legY})`);
  legend.append("text").attr("class", "lf-legend-heading")
    .attr("x", 0).attr("y", 0)
    .text("Darker shading means a higher weight assigned by the authors (schematic)");

  const items = [
    { color: "#b8862e", label: "Austronesian",
      sub: "Taiwan, Indonesia, the Philippines" },
    { color: "#2c6479", label: "Papuan",
      sub: "New Guinea, the Bismarcks, the Solomons" },
    { color: "#a8442d", label: "Polynesian",
      sub: "Tonga, Samoa, Hawaiʻi, Aotearoa" },
  ];
  const SWATCH_W = 56, SWATCH_H = 12;
  items.forEach((it, i) => {
    const y = 22 + i * 30;
    [0.18, 0.40, 0.70].forEach((a, k) => {
      legend.append("rect")
        .attr("x", k * (SWATCH_W / 3))
        .attr("y", y - 10)
        .attr("width", SWATCH_W / 3 + 0.6)
        .attr("height", SWATCH_H)
        .attr("fill", withAlpha(it.color, a));
    });
    legend.append("text").attr("class", "lf-legend-label")
      .attr("x", SWATCH_W + 10).attr("y", y).text(it.label);
    legend.append("text").attr("class", "lf-legend-sub")
      .attr("x", SWATCH_W + 10).attr("y", y + 12).text(it.sub);
  });
}
