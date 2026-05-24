/**
 * Chapter 9 — The hole in the sky (ozone), as a scrolly.
 *
 * A sticky south-polar log-azimuthal map of REAL total-column ozone (NASA GIBS
 * / OMI), drawn as a soft Dobson-Unit gradient — so the deep hole over
 * Antarctica and the reduced-ozone shoulder spilling toward the Southern Ocean
 * read as a continuum, not a hard circle. Two observed states (a record
 * deep-hole spring day and a calm summer day) are morphed by each year's
 * measured maximum hole area, so scrolling grows the hole then heals it. The
 * 220 DU contour (the official "hole" edge) is drawn as a line; NZ/AU/AR sit on
 * the coloured field. A sparkline carries the real area-over-time record, with
 * the Montreal Protocol marked.
 *
 * Field: data/ozone-field.json. Area: NASA Ozone Watch annual maxima.
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { logAzimuthalRaw } from '../core/projection.js';

// year, maximum hole area (million km²) — NASA Ozone Watch
const AREA = [
  [1979,0.1],[1980,1.4],[1982,4.8],[1984,10.1],[1985,14.2],[1986,11.3],[1987,19.3],
  [1988,13.8],[1989,19.5],[1990,19.2],[1991,20.0],[1992,22.3],[1993,24.2],[1994,23.6],
  [1995,23.0],[1996,22.8],[1997,22.1],[1998,25.9],[1999,23.3],[2000,29.9],[2001,25.0],
  [2002,12.0],[2003,28.2],[2004,19.5],[2005,24.4],[2006,29.6],[2007,25.2],[2008,27.0],
  [2009,24.1],[2010,22.2],[2011,26.0],[2012,21.2],[2013,24.0],[2014,24.1],[2015,28.2],
  [2016,23.0],[2017,19.6],[2018,24.8],[2019,16.4],[2020,24.8],[2021,24.8],[2022,26.4],
  [2023,26.0],[2024,22.0]
];
const Y0 = AREA[0][0], Y1 = AREA[AREA.length - 1][0], PEAK = 29.9;

// DU thresholds → soft violet ramp (low ozone = deep violet, high = pale).
const BANDS = [
  [130, "#2b1b4d"], [160, "#3d2a66"], [190, "#52407f"], [220, "#6a5896"],
  [250, "#8a7cae"], [280, "#ada3c6"], [310, "#cdc6dd"], [340, "#e6e1ee"], [370, "#f1ecf3"]
];
const THRESHOLDS = BANDS.map(b => b[0]);
const bandColour = v => (BANDS.find(b => b[0] === v) || BANDS[BANDS.length - 1])[1];

function areaAt(year) {
  if (year <= Y0) return AREA[0][1];
  if (year >= Y1) return AREA[AREA.length - 1][1];
  for (let i = 1; i < AREA.length; i++) {
    if (AREA[i][0] >= year) {
      const [x0, a0] = AREA[i - 1], [x1, a1] = AREA[i];
      return a0 + (a1 - a0) * (year - x0) / (x1 - x0);
    }
  }
  return AREA[AREA.length - 1][1];
}

let projection, path, fieldG, yearEl, areaEl, cursorEl, meta, deep, calm, field, lastYear = null;
const SPL = { x: 40, y: 604, w: 520, h: 56 };
const sx = y => SPL.x + (y - Y0) / (Y1 - Y0) * SPL.w;
const sy = a => SPL.y + (1 - a / 30) * SPL.h;

async function build() {
  const svg = document.getElementById("viz-ch9");
  if (!svg) return false;
  let world, data;
  try {
    [world, data] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"),
      d3.json("./data/ozone-field.json"),
    ]);
  } catch (e) { console.warn("ch9: load failed", e); return false; }
  const land = topojson.feature(world, world.objects.land);
  meta = data.grid_meta; deep = data.deep; calm = data.calm; field = deep.slice();
  const sel = d3.select(svg);

  const W = 600, mapTop = 86, mapBot = 512, pad = 34;

  // Title block
  sel.append("text").attr("x", 24).attr("y", 24).attr("font-family", "IBM Plex Mono").attr("font-size", 10).attr("letter-spacing", 2).attr("fill", "#8a7659").text("TOTAL COLUMN OZONE · NASA OMI");
  sel.append("text").attr("x", 24).attr("y", 52).attr("font-family", "Fraunces").attr("font-style", "italic").attr("font-size", 22).attr("fill", "#1d1610").text("How the hole opened, then began to close");

  const raw = logAzimuthalRaw(0.9, 75);
  projection = d3.geoProjection(raw).rotate([0, 90]).clipAngle(74.6);
  const cap = d3.geoCircle().center([0, -90]).radius(74)();
  projection.fitExtent([[pad, mapTop], [W - pad, mapBot]], cap);
  path = d3.geoPath(projection);

  // Base = deepest-ozone violet, continuing the ramp below 130 DU, so the hole
  // core (and any contour gaps) read as "deepest", not a dark gap.
  sel.append("path").attr("d", path({ type: "Sphere" })).attr("fill", "#241a4a").attr("stroke", "#1d1610").attr("stroke-width", 0.6);
  fieldG = sel.append("g");                       // ozone field (redrawn)
  sel.append("path").attr("d", path(d3.geoGraticule10())).attr("fill", "none").attr("stroke", "#ffffff").attr("stroke-width", 0.3).attr("stroke-opacity", 0.18);
  // land as outline only, so the field shows through (NZ/AU sit on the colour)
  sel.append("path").attr("d", path(land)).attr("fill", "none").attr("stroke", "#1d1610").attr("stroke-width", 0.5).attr("stroke-opacity", 0.55);

  const places = [[174, -41, "NZ"], [134, -25, "AU"], [-64, -34, "AR"]];
  places.forEach(([lon, lat, t]) => {
    const xy = projection([lon, lat]); if (!xy) return;
    sel.append("circle").attr("cx", xy[0]).attr("cy", xy[1]).attr("r", 3).attr("fill", "#1d1610").attr("stroke", "#fff").attr("stroke-width", 1);
    sel.append("text").attr("x", xy[0] + 6).attr("y", xy[1] + 3).attr("font-family", "IBM Plex Mono").attr("font-size", 10).attr("font-weight", 600)
      .attr("fill", "#1d1610").attr("stroke", "#fff").attr("stroke-width", 2.4).attr("paint-order", "stroke fill").text(t);
  });

  // Dynamic year + area, top-right
  yearEl = sel.append("text").attr("x", W - 24).attr("y", 42).attr("text-anchor", "end").attr("font-family", "Fraunces").attr("font-weight", 600).attr("font-size", 40).attr("fill", "#1d1610");
  areaEl = sel.append("text").attr("x", W - 24).attr("y", 60).attr("text-anchor", "end").attr("font-family", "IBM Plex Mono").attr("font-size", 10).attr("letter-spacing", 1).attr("fill", "#5b4a8a");

  // DU legend — one clean row below the map
  const lg = sel.append("g").attr("transform", `translate(${pad}, ${mapBot + 32})`);
  lg.append("text").attr("x", 0).attr("y", 0).attr("font-family", "IBM Plex Mono").attr("font-size", 9.5).attr("letter-spacing", 0.6).attr("fill", "#8a7659").text("TOTAL OZONE · DOBSON UNITS");
  BANDS.forEach((b, i) => lg.append("rect").attr("x", i * 22).attr("y", 8).attr("width", 22).attr("height", 10).attr("fill", b[1]));
  lg.append("text").attr("x", 2).attr("y", 17).attr("font-family", "IBM Plex Mono").attr("font-size", 8).attr("fill", "#f3ecdd").text("130");
  lg.append("text").attr("x", BANDS.length * 22 + 6).attr("y", 17).attr("font-family", "IBM Plex Mono").attr("font-size", 8).attr("fill", "#8a7659").text("370+");

  // Area-over-time sparkline — clearly separated, below the legend
  sel.append("text").attr("x", SPL.x).attr("y", SPL.y - 10).attr("font-family", "IBM Plex Mono").attr("font-size", 9.5).attr("letter-spacing", 0.6).attr("fill", "#8a7659").text("MAXIMUM HOLE AREA · MILLION KM²");
  sel.append("path").attr("d", AREA.map((d, i) => (i ? "L" : "M") + sx(d[0]).toFixed(1) + " " + sy(d[1]).toFixed(1)).join(" ")).attr("fill", "none").attr("stroke", "#5b4a8a").attr("stroke-width", 1.6);
  const mx = sx(1987);
  sel.append("line").attr("x1", mx).attr("y1", SPL.y - 2).attr("x2", mx).attr("y2", SPL.y + SPL.h).attr("stroke", "#1d1610").attr("stroke-width", 0.8).attr("stroke-dasharray", "3 3");
  sel.append("text").attr("x", mx + 5).attr("y", SPL.y + 9).attr("font-family", "IBM Plex Mono").attr("font-size", 8.5).attr("fill", "#1d1610").text("MONTREAL 1987");
  cursorEl = sel.append("circle").attr("r", 3.5).attr("fill", "#5b4a8a").attr("stroke", "#f3ecdd").attr("stroke-width", 1.4);
  sel.append("text").attr("x", SPL.x).attr("y", SPL.y + SPL.h + 14).attr("font-family", "IBM Plex Mono").attr("font-size", 8).attr("fill", "#8a7659").text("1979");
  sel.append("text").attr("x", SPL.x + SPL.w).attr("y", SPL.y + SPL.h + 14).attr("text-anchor", "end").attr("font-family", "IBM Plex Mono").attr("font-size", 8).attr("fill", "#8a7659").text("2024");

  update(Y0);
  return true;
}

function redrawField(year) {
  const h = Math.max(0, Math.min(1, areaAt(year) / PEAK));
  for (let i = 0; i < field.length; i++) field[i] = calm[i] + (deep[i] - calm[i]) * h;
  const m = meta;
  const lonStep = (m.lon_max - m.lon_min) / (m.n_lon - 1);
  const latStep = (m.lat_max - m.lat_min) / (m.n_lat - 1);
  const toLonLat = ([x, y]) => [m.lon_min + x * lonStep, m.lat_min + y * latStep];
  const contours = d3.contours().size([m.n_lon, m.n_lat]).thresholds(THRESHOLDS)(field);
  const proj = contours.map(c => ({ value: c.value, type: c.type, coordinates: c.coordinates.map(p => p.map(r => r.map(toLonLat))) }));
  fieldG.selectAll("path").data(proj).join("path").attr("d", d => path(d)).attr("fill", d => bandColour(d.value)).attr("stroke", "none");
}

function update(year) {
  if (lastYear === null || Math.abs(year - lastYear) >= 1) { redrawField(year); lastYear = year; }
  const a = areaAt(year);
  yearEl.text(Math.round(year));
  areaEl.text(a.toFixed(1) + " M KM² HOLE");
  cursorEl.attr("cx", sx(year)).attr("cy", sy(a));
}

function progressToYear(p) {
  if (p < 0.28) return Y0 + (p / 0.28) * (1987 - Y0);
  if (p < 0.58) return 1987 + ((p - 0.28) / 0.30) * (2006 - 1987);
  return 2006 + ((p - 0.58) / 0.42) * (Y1 - 2006);
}

let attached = false;
function attachScroll() {
  if (attached) return;
  const scrolly = document.querySelector("#ch9 .scrolly");
  if (!scrolly) return;
  attached = true;
  const isNarrow = () => window.matchMedia("(max-width: 900px)").matches;
  let pending = false;
  const upd = () => {
    pending = false;
    const r = scrolly.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    if (total <= 0) return;
    if (isNarrow()) { update(2006); return; }
    update(progressToYear(Math.max(0, Math.min(1, -r.top / total))));
  };
  window.addEventListener("scroll", () => { if (!pending) { pending = true; requestAnimationFrame(upd); } }, { passive: true });
  window.addEventListener("resize", upd, { passive: true });
  upd();
}

export async function init(state) {
  if (await build()) attachScroll();
  state.ready = true;
  state.pending.forEach(fn => fn());
  state.pending = [];
}

export const actions = {
  "ch9-step1": () => {}, "ch9-step2": () => {}, "ch9-step3": () => {}, "ch9-step4": () => {}
};
