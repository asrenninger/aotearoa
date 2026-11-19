/**
 * Chapter 12 — The climates ahead.
 *
 * Projected New Zealand warming by 2090 under four SSP scenarios, against the
 * 1995–2014 average, from the Ministry for the Environment / NIWA 2024
 * projections: SSP1-2.6 +0.8, SSP2-4.5 +1.9, SSP3-7.0 +3.0, SSP5-8.5 +3.7 °C
 * (2081–2100 mean). Only those end values are projections. Each scenario is
 * drawn as a straight line from the observed 2016–2025 mean to its 2090
 * value; the path between is schematic, and the source line says so.
 *
 * Observed: the ERA5 five-site annual series from data/nz-temp-annual.json
 * (the ch11 data), re-expressed against 1995–2014. No hand-set points.
 * Rendered once into #viz-ch12.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLOT = { x: 58, y: 84, w: 590, h: 360 };  // right margin holds the end labels
const X_MIN = 1990, X_MAX = 2090;
const Y_MIN = -1.2, Y_MAX = 4.0;
const BASE0 = 1995, BASE1 = 2014;

const xS = y => PLOT.x + (y - X_MIN) / (X_MAX - X_MIN) * PLOT.w;
const yS = a => PLOT.y + (1 - (a - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.h;

function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, attrs, content) { const n = el('text', attrs, parent); n.textContent = content; return n; }

// MfE / NIWA 2024: warming by 2090 (2081–2100) against 1995–2014, °C.
const SCENARIOS = [
  { id: 'SSP5-8.5', name: 'Very high', end: 3.7, stroke: '#c0431f', label: '#c0431f', width: 2.2 },
  { id: 'SSP3-7.0', name: 'High', end: 3.0, stroke: '#c0431f', label: '#c0431f', width: 2.0, dash: '5 4' },
  { id: 'SSP2-4.5', name: 'Middle', end: 1.9, stroke: '#d8662f', label: '#a8542a', width: 2.0 },
  { id: 'SSP1-2.6', name: 'Deep cuts', end: 0.8, stroke: '#2c6479', label: '#2c6479', width: 2.0 }
];

async function observedSeries() {
  try {
    const j = await fetch('./data/nz-temp-annual.json').then(r => r.ok ? r.json() : Promise.reject());
    const base = j.series.filter(d => d.year >= BASE0 && d.year <= BASE1);
    if (base.length < 15) return null;
    const b = base.reduce((s, d) => s + d.anomaly, 0) / base.length;
    return j.series.filter(d => d.year >= X_MIN).map(d => [d.year, d.anomaly - b]);
  } catch (e) { return null; }
}

const line = pts => pts.map((p, i) => (i ? 'L' : 'M') + xS(p[0]).toFixed(1) + ' ' + yS(p[1]).toFixed(1)).join(' ');

export async function render() {
  const svg = document.getElementById('viz-ch12');
  if (!svg) return;
  const obs = await observedSeries();

  text(svg, { x: 0, y: 16, class: 'map-label', fill: '#8a7659' }, 'Projected New Zealand warming · °C above the 1995–2014 average');
  text(svg, { x: 0, y: 44, class: 'fig-title', 'font-size': 22, fill: '#1d1610' }, 'Warming by 2090 ranges from 0.8°C to 3.7°C');

  // Gridlines + y labels (°C against 1995–2014)
  const grid = el('g', { class: 'grid-line' }, svg);
  for (let v = -1; v <= 4; v += 1) {
    const y = yS(v);
    el('line', { x1: PLOT.x, y1: y, x2: PLOT.x + PLOT.w, y2: y }, grid);
    text(svg, { x: PLOT.x - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '°C');
  }
  el('line', { x1: PLOT.x, y1: PLOT.y, x2: PLOT.x, y2: PLOT.y + PLOT.h, class: 'axis-line' }, svg);
  el('line', { x1: PLOT.x, y1: yS(0), x2: PLOT.x + PLOT.w, y2: yS(0), stroke: '#8a7659', 'stroke-width': 0.9 }, svg);
  text(svg, { x: PLOT.x + PLOT.w, y: yS(0) - 6, 'text-anchor': 'end', class: 'axis-label', fill: '#8a7659' }, '0 = 1995–2014 AVERAGE');
  for (const yr of [1990, 2025, 2050, 2090]) {
    text(svg, { x: xS(yr), y: PLOT.y + PLOT.h + 20, 'text-anchor': 'middle', class: 'axis-label' }, yr);
  }

  // "Now" divider
  el('line', { x1: xS(2025), y1: PLOT.y, x2: xS(2025), y2: PLOT.y + PLOT.h, stroke: '#8a7659', 'stroke-width': 0.7, 'stroke-dasharray': '2 3', opacity: 0.7 }, svg);
  text(svg, { x: xS(2025) + 6, y: PLOT.y + 14, class: 'axis-label', fill: '#8a7659' }, 'NOW');

  // Start of the projection lines: the observed mean of the last ten years,
  // placed at that decade's midpoint. Without data, start at the baseline.
  let start = [(BASE0 + BASE1) / 2, 0];
  if (obs && obs.length >= 10) {
    const last = obs.slice(-10);
    start = [(last[0][0] + last[9][0]) / 2, last.reduce((s, d) => s + d[1], 0) / 10];
  }

  // Fan between the lowest and highest scenarios
  const hi = SCENARIOS[0], lo = SCENARIOS[SCENARIOS.length - 1];
  el('path', { d: line([start, [X_MAX, hi.end], [X_MAX, lo.end]]) + ' Z', fill: '#d8662f', opacity: 0.10, stroke: 'none' }, svg);

  // Observed annual series (thin), then the scenario lines
  if (obs) {
    el('path', { d: line(obs), stroke: '#4a3d2e', 'stroke-width': 1.2, fill: 'none', 'stroke-linejoin': 'round' }, svg);
    text(svg, { x: xS(1991), y: yS(1.25), class: 'axis-label', fill: '#4a3d2e' }, 'OBSERVED');
  }
  SCENARIOS.forEach(sc => {
    const attrs = { d: line([start, [X_MAX, sc.end]]), stroke: sc.stroke, 'stroke-width': sc.width, fill: 'none', 'stroke-linecap': 'round' };
    if (sc.dash) attrs['stroke-dasharray'] = sc.dash;
    el('path', attrs, svg);
    const t = el('text', { x: xS(X_MAX) + 8, y: yS(sc.end) + 4, 'font-family': 'IBM Plex Mono', 'font-size': 10, 'letter-spacing': 0.5, fill: sc.label }, svg);
    t.textContent = `${sc.name} · +${sc.end.toFixed(1)}°C`;
  });

  // Sea-level callout, top-right (current guidance, before land movement)
  const g = el('g', { transform: `translate(${PLOT.x + PLOT.w}, 64)` }, svg);
  text(g, { x: 0, y: 0, 'text-anchor': 'end', 'font-family': 'Fraunces', 'font-weight': 600, 'font-size': 30, fill: '#2c6479' }, '0.5–0.9 m');
  text(g, { x: 0, y: 18, 'text-anchor': 'end', class: 'axis-label', fill: '#8a7659' }, 'SEA-LEVEL RISE BY 2090 · BEFORE LAND MOVEMENT');

  // Source lines
  el('line', { x1: 0, y1: PLOT.y + PLOT.h + 36, x2: 740, y2: PLOT.y + PLOT.h + 36, stroke: '#c9b894', 'stroke-width': 0.5 }, svg);
  text(svg, { x: 0, y: PLOT.y + PLOT.h + 54, class: 'map-label', fill: '#8a7659' }, 'Projections: MfE / NIWA 2024, 2081–2100 mean against 1995–2014 · paths to 2090 are schematic');
  text(svg, { x: 0, y: PLOT.y + PLOT.h + 70, class: 'map-label', fill: '#8a7659' },
       'Emissions: deep cuts SSP1-2.6 · middle SSP2-4.5 · high SSP3-7.0 · very high SSP5-8.5');
  text(svg, { x: 0, y: PLOT.y + PLOT.h + 86, class: 'map-label', fill: '#8a7659' },
       obs ? 'Observed: Copernicus ERA5 via Open-Meteo, five-site mean, against 1995–2014 · sea level: MfE 2024 guidance'
           : 'Sea level: MfE 2024 coastal guidance');
}
