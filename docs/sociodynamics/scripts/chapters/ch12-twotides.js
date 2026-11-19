/**
 * Chapter 12 — "Two tides" (arrivals + departures flow pair).
 *
 * Renders the chapter's pair of log-azimuthal flow maps (arrivals and
 * departures) into the SVG slots in index.html. Shares the projection
 * (Auckland-centred) with ch1's ancestry surfaces; the helpers live in
 * core/projection.js.
 *
 * The chart on the same chapter — net migration by citizenship, year
 * ended January 2026 — is rendered inline in the HTML as static SVG
 * since it's just a horizontal bar chart over hard-coded Stats NZ
 * values; no projection math, no live data fetch.
 *
 * Static figure — fired once at page load. If the chapter's target nodes
 * are absent (older builds, partial HTML) it exits silently.
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

import { AKL, logAzimuthalRaw } from '../core/projection.js';

// Shared projection knobs — tuned for visual parity with the standalone
// `log-azimuthal-static.html` development page.
const PARAMS = { S: 1.4, B: 170, gamma: 0.55, topN: 10 };

// ---------------------------------------------------------------------------
// Rectangle-aware label dodge: pairwise collision plus a wall clamp that
// keeps every label fully inside a safe rectangle (so labels can't drift
// into the chapter's title row or past the bottom edge).
// ---------------------------------------------------------------------------
function rectCollide(passes, bounds) {
  let nodes;
  function force() {
    for (let p = 0; p < passes; p++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = (a.bw + b.bw) / 2 - Math.abs(dx);
          const oy = (a.bh + b.bh) / 2 - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            if (ox < oy) {
              const push = ox / 2;
              if (dx >= 0) { a.x -= push; b.x += push; }
              else        { a.x += push; b.x -= push; }
            } else {
              const push = oy / 2;
              if (dy >= 0) { a.y -= push; b.y += push; }
              else        { a.y += push; b.y -= push; }
            }
          }
        }
      }
      for (const a of nodes) {
        const hx = a.bw / 2, hy = a.bh / 2;
        if (a.x - hx < bounds.x0) a.x = bounds.x0 + hx;
        if (a.x + hx > bounds.x1) a.x = bounds.x1 - hx;
        if (a.y - hy < bounds.y0) a.y = bounds.y0 + hy;
        if (a.y + hy > bounds.y1) a.y = bounds.y1 - hy;
      }
    }
  }
  force.initialize = n => (nodes = n);
  return force;
}

// ---------------------------------------------------------------------------
// Per-panel renderer.
// ---------------------------------------------------------------------------
function renderPanel({ root, kind, data, eyebrow, title, stat, land }) {
  const W = 480, H = 490;
  const mapTop = 70, mapBot = 470, mapL = 4, mapR = W - 4;

  const svg = d3.select(root)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("xmlns", "http://www.w3.org/2000/svg");
  svg.selectAll("*").remove();

  // Header (matches the rest of the chapter's typographic stack).
  svg.append("text").attr("class", "tt-eyebrow")
    .attr("x", 0).attr("y", 16).text(eyebrow);
  svg.append("text").attr("class", "tt-stat")
    .attr("x", W).attr("y", 22).attr("text-anchor", "end").text(stat);
  svg.append("text").attr("class", "tt-title")
    .attr("x", 0).attr("y", 46).text(title);

  // Projection sized to the map area.
  const raw = logAzimuthalRaw(PARAMS.S, PARAMS.B);
  const projection = d3.geoProjection(raw)
    .rotate([-AKL[0], -AKL[1]])
    .clipAngle(PARAMS.B - 0.001);
  const cap = d3.geoCircle().center(AKL).radius(Math.min(PARAMS.B - 0.5, 179.5))();
  projection.fitExtent([[mapL, mapTop], [mapR, mapBot]], cap);
  const path = d3.geoPath(projection);

  const gMap = svg.append("g");
  gMap.append("path").attr("class", "tt-sphere").attr("d", path({ type: "Sphere" }));
  gMap.append("path").attr("class", "tt-graticule").attr("d", path(d3.geoGraticule10()));
  gMap.append("path").attr("class", "tt-land").attr("d", path(land));

  // Flow scaling — top-N by value.
  const top = data.slice(0, PARAMS.topN);
  const maxV = d3.max(top, d => d.value);
  const widthFor  = d => 0.6 + 5.2 * Math.pow(d.value / maxV, PARAMS.gamma);
  const radiusFor = d => 1.4 + 4.4 * Math.pow(d.value / maxV, PARAMS.gamma);

  function arc(a, b, n = 64) {
    const interp = d3.geoInterpolate(a, b);
    return { type: "LineString", coordinates: d3.range(n + 1).map(i => interp(i / n)) };
  }

  svg.append("g").selectAll("path").data(top).join("path")
    .attr("class", `tt-flow tt-${kind}`)
    .attr("d", d => kind === "in"
      ? path(arc(d.lonlat, AKL))
      : path(arc(AKL, d.lonlat)))
    .attr("stroke-width", widthFor);

  // City layer (dots + dodged labels).
  const cx = (mapL + mapR) / 2, cy = (mapTop + mapBot) / 2;
  const projected = top.map(d => {
    const xy = projection(d.lonlat);
    if (!xy || !isFinite(xy[0]) || !isFinite(xy[1])) return null;
    const r = radiusFor(d);
    const dx = xy[0] - cx, dy = xy[1] - cy;
    const m = Math.hypot(dx, dy) || 1;
    const k = r + 8;
    const lx0 = xy[0] + (dx / m) * k;
    const ly0 = xy[1] + (dy / m) * k;
    return { ...d, xy, r, x0: lx0, y0: ly0, x: lx0, y: ly0 };
  }).filter(Boolean);

  const gCity = svg.append("g");
  gCity.selectAll("circle.tt-city-dot").data(projected).join("circle")
    .attr("class", `tt-city-dot tt-${kind}`)
    .attr("cx", d => d.xy[0]).attr("cy", d => d.xy[1])
    .attr("r", d => d.r);

  const lblG = gCity.selectAll("g.tt-lbl").data(projected).join("g").attr("class", "tt-lbl");
  lblG.append("text").attr("class", "tt-city-label")
    .attr("text-anchor", "middle").attr("dy", -0.5)
    .text(d => d.country);
  lblG.append("text").attr("class", `tt-city-count tt-${kind}`)
    .attr("text-anchor", "middle").attr("dy", 10.5)
    .text(d => (d.est ? "≈" : "") + d3.format(",")(d.value));
  lblG.attr("transform", d => `translate(${d.x0},${d.y0})`);

  lblG.each(function(d) {
    const bb = this.getBBox();
    d.bw = bb.width + 6;
    d.bh = bb.height + 3;
  });

  const bounds = { x0: 4, x1: W - 4, y0: 72, y1: 485 };
  d3.forceSimulation(projected)
    .alphaDecay(0.04)
    .force("rect", rectCollide(4, bounds))
    .force("x", d3.forceX(d => d.x0).strength(0.24))
    .force("y", d3.forceY(d => d.y0).strength(0.24))
    .stop()
    .tick(260);
  lblG.attr("transform", d => `translate(${d.x},${d.y})`);

  // Auckland.
  const akl = projection(AKL);
  svg.append("circle").attr("class", "tt-akl-dot")
    .attr("cx", akl[0]).attr("cy", akl[1]).attr("r", 3.4);
  svg.append("text").attr("class", "tt-akl-label")
    .attr("x", akl[0] + 6).attr("y", akl[1] + 3.5)
    .text("Auckland");
}

// ---------------------------------------------------------------------------
// Public entry point. Idempotent: re-running it is harmless since
// renderPanel clears its container first.
// ---------------------------------------------------------------------------
export async function render() {
  const inSvg  = document.getElementById("tt-map-in");
  const outSvg = document.getElementById("tt-map-out");
  if (!inSvg || !outSvg) return;   // chapter not present on this page

  const [world, arrivals, departures] = await Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"),
    d3.csv("data/nz-migrant-arrivals-2026.csv", d => ({
      country: d.country, iso3: d.iso3,
      value: +d.arrivals, lonlat: [+d.lon, +d.lat],
    })),
    d3.csv("data/nz-migrant-departures-2024.csv", d => ({
      country: d.country, iso3: d.iso3,
      value: +d.departures, lonlat: [+d.lon, +d.lat],
      // Only Australia is a published count; the rest are modelled.
      est: d.source === "estimated",
    })),
  ]);
  const land = topojson.feature(world, world.objects.land);

  renderPanel({
    root: inSvg, kind: "in", data: arrivals, land,
    eyebrow: "Arrivals · non-NZ citizens · year to Jan 2026",
    title: "Where new migrants come from",
    stat: "111k",
  });
  renderPanel({
    root: outSvg, kind: "out", data: departures, land,
    eyebrow: "Departures · NZ citizens · 2024",
    title: "Where New Zealanders go (≈ estimated)",
    stat: "≈72k",
  });
}
