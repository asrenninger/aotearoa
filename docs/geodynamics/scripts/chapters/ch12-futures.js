/**
 * Chapter 12 — The climates ahead.
 *
 * A scenario fan: observed warming to the present, then three diverging SSP
 * pathways for New Zealand-average temperature to 2090 (CMIP6, NIWA/MfE 2024).
 * Rendered once into #viz-ch12. Values are °C relative to a recent baseline,
 * rounded to the published headline figures — see docs/METHODOLOGY.md.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLOT = { x: 58, y: 84, w: 640, h: 360 };
const X_MIN = 1990, X_MAX = 2090;
const Y_MIN = -0.2, Y_MAX = 3.4;

const xS = y => PLOT.x + (y - X_MIN) / (X_MAX - X_MIN) * PLOT.w;
const yS = a => PLOT.y + (1 - (a - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.h;

function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, attrs, content) { const n = el('text', attrs, parent); n.textContent = content; return n; }

const OBSERVED = [[1990, 0.0], [2000, 0.15], [2010, 0.35], [2025, 0.62]];
const SSP126   = [[2025, 0.62], [2050, 0.9], [2070, 1.0], [2090, 1.0]];
const SSP245   = [[2025, 0.62], [2050, 1.2], [2070, 1.6], [2090, 2.0]];
const SSP585   = [[2025, 0.62], [2050, 1.9], [2070, 2.6], [2090, 3.1]];

// Project a [year, °C] series to screen points.
function proj(series) { return series.map(p => [xS(p[0]), yS(p[1])]); }

// Smooth path through points via Catmull-Rom → cubic bezier (stylised elbows).
function smooth(pts) {
  if (pts.length < 3) return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  return d;
}
function dStr(series) { return smooth(proj(series)); }

export function render() {
  const svg = document.getElementById('viz-ch12');
  if (!svg) return;

  text(svg, { x: 0, y: 16, class: 'map-label', fill: '#8a7659' }, 'Projected New Zealand warming · CMIP6');
  text(svg, { x: 0, y: 44, class: 'fig-title', 'font-size': 22, fill: '#1d1610' }, 'How much hotter depends on us');

  // Gridlines + y labels (°C)
  const grid = el('g', { class: 'grid-line' }, svg);
  for (let v = 0; v <= 3; v += 1) {
    const y = yS(v);
    el('line', { x1: PLOT.x, y1: y, x2: PLOT.x + PLOT.w, y2: y }, grid);
    text(svg, { x: PLOT.x - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, '+' + v + '°C');
  }
  // Axes
  el('line', { x1: PLOT.x, y1: PLOT.y, x2: PLOT.x, y2: PLOT.y + PLOT.h, class: 'axis-line' }, svg);
  el('line', { x1: PLOT.x, y1: yS(0), x2: PLOT.x + PLOT.w, y2: yS(0), stroke: '#8a7659', 'stroke-width': 0.9 }, svg);
  for (const yr of [1990, 2025, 2050, 2090]) {
    text(svg, { x: xS(yr), y: PLOT.y + PLOT.h + 20, 'text-anchor': 'middle', class: 'axis-label' }, yr);
  }

  // "Now" divider
  el('line', { x1: xS(2025), y1: PLOT.y, x2: xS(2025), y2: PLOT.y + PLOT.h, stroke: '#8a7659', 'stroke-width': 0.7, 'stroke-dasharray': '2 3', opacity: 0.7 }, svg);
  text(svg, { x: xS(2025) + 6, y: PLOT.y + 14, class: 'axis-label', fill: '#8a7659' }, 'NOW');

  // Fan shading between the low and high pathways (both edges smoothed)
  const fanD = smooth(proj(SSP585)) + ' ' + smooth(proj([...SSP126].reverse())).replace(/^M/, 'L') + ' Z';
  el('path', { d: fanD, fill: '#d8662f', opacity: 0.10, stroke: 'none' }, svg);

  // Observed (quake/ink) then three scenario lines
  el('path', { d: dStr(OBSERVED), stroke: '#1d1610', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }, svg);
  el('path', { d: dStr(SSP585), stroke: '#c0431f', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }, svg);
  el('path', { d: dStr(SSP245), stroke: '#d8662f', 'stroke-width': 2.0, fill: 'none', 'stroke-linecap': 'round' }, svg);
  el('path', { d: dStr(SSP126), stroke: '#2c6479', 'stroke-width': 2.0, fill: 'none', 'stroke-linecap': 'round' }, svg);

  // End labels
  const lab = (series, txt, colour, dy) => {
    const last = series[series.length - 1];
    const t = el('text', { x: xS(last[0]) + 8, y: yS(last[1]) + 4 + (dy || 0), 'font-family': 'IBM Plex Mono', 'font-size': 10, 'letter-spacing': 0.5, fill: colour }, svg);
    t.textContent = txt;
  };
  lab(SSP585, 'SSP5-8.5 · +3.1°C', '#c0431f');
  lab(SSP245, 'SSP2-4.5 · +2.0°C', '#a8542a');
  lab(SSP126, 'SSP1-2.6 · +1.0°C', '#2c6479');

  // Sea-level callout, top-right
  const g = el('g', { transform: `translate(${PLOT.x + PLOT.w}, 64)` }, svg);
  text(g, { x: 0, y: 0, 'text-anchor': 'end', 'font-family': 'Fraunces', 'font-weight': 600, 'font-size': 30, fill: '#2c6479' }, '~0.8 m');
  text(g, { x: 0, y: 18, 'text-anchor': 'end', class: 'axis-label', fill: '#8a7659' }, 'SEA-LEVEL RISE TO PLAN FOR · BY THE 2090s');

  // Caption
  el('line', { x1: 0, y1: PLOT.y + PLOT.h + 36, x2: 740, y2: PLOT.y + PLOT.h + 36, stroke: '#c9b894', 'stroke-width': 0.5 }, svg);
  text(svg, { x: 0, y: PLOT.y + PLOT.h + 54, class: 'map-label', fill: '#8a7659' }, 'Source: NIWA; Ministry for the Environment');
}
