/**
 * Chapter 8 — The Anthropocene arrives (CO₂).
 *
 * The one chart-scrolly of the piece. The real Mauna Loa monthly record — the
 * Keeling Curve, with its seasonal sawtooth — spliced to Law Dome ice-core
 * anchors before 1958, drawn on a sticky chart whose reveal tracks scroll.
 * Data: data/co2-monthly.json (built from NOAA by data/build/build-co2.py).
 *
 * Step boundaries:
 *   1 → pre-industrial baseline (~280 ppm)
 *   2 → through 1958, Keeling begins at Mauna Loa
 *   3 → 1972, Baring Head (NZ) begins, marked on the shared curve
 *   4 → through today, past 420 ppm
 *
 * The 2015 flag marks Mauna Loa's first annual mean above 400 ppm (401.0);
 * the head label is the latest monthly value in the data (April 2026).
 */

const PLOT = { x: 64, y: 80, w: 496, h: 400 };
const X_MIN = 1850, X_MAX = 2026;
const Y_MIN = 270, Y_MAX = 440;

const SVG_NS = 'http://www.w3.org/2000/svg';
const xScale = y => PLOT.x + (y - X_MIN) / (X_MAX - X_MIN) * PLOT.w;
const yScale = p => PLOT.y + (1 - (p - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.h;

function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, attrs, content) { const n = el('text', attrs, parent); n.textContent = content; return n; }

const CARBON = '#6b6253';
const FIRE   = '#c0431f';

const PIVOTS = [
  { year: 1958, label: 'Keeling begins · Mauna Loa' },
  { year: 1972, label: 'Baring Head · NZ begins' },
  { year: 2015, label: 'Past 400 ppm · annual mean' }
];

let curveEl = null, curveLen = 0, iceEl = null, iceLen = 0, ppmAt = () => null;

async function buildChart() {
  const svg = document.getElementById('viz-ch8');
  if (!svg) return false;
  let data;
  try { data = await fetch('./data/co2-monthly.json').then(r => r.json()); }
  catch (e) { console.warn('ch8: CO2 data load failed', e); return false; }

  const plot = el('g', { transform: `translate(${PLOT.x}, ${PLOT.y})` }, svg);
  const grid = el('g', { class: 'grid-line' }, plot);
  for (let v = 280; v <= 440; v += 40) {
    const y = yScale(v) - PLOT.y;
    el('line', { x1: 0, y1: y, x2: PLOT.w, y2: y }, grid);
    text(plot, { x: -8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, v);
  }
  // pre-industrial reference
  const preY = yScale(data.preindustrial) - PLOT.y;
  el('line', { x1: 0, y1: preY, x2: PLOT.w, y2: preY, stroke: '#8a7659', 'stroke-width': 0.8, 'stroke-dasharray': '2 3' }, plot);
  text(plot, { x: 4, y: preY - 5, 'font-family': 'IBM Plex Mono', 'font-size': 9, fill: '#8a7659' }, 'pre-industrial · 280');

  el('line', { x1: 0, y1: 0, x2: 0, y2: PLOT.h, class: 'axis-line' }, plot);
  el('line', { x1: 0, y1: PLOT.h, x2: PLOT.w, y2: PLOT.h, class: 'axis-line' }, plot);
  for (const yr of [1850, 1900, 1958, 2000, 2026]) {
    const x = xScale(yr) - PLOT.x;
    el('line', { x1: x, y1: PLOT.h, x2: x, y2: PLOT.h + 4, stroke: '#8a7659', 'stroke-width': 0.5 }, plot);
    text(plot, { x, y: PLOT.h + 18, 'text-anchor': 'middle', class: 'axis-label' }, yr);
  }

  // Ice-core line (pre-1958), faint
  const iceD = data.icecore.map((d, i) => (i === 0 ? 'M' : 'L') + ' ' + (xScale(d[0]) - PLOT.x).toFixed(1) + ' ' + (yScale(d[1]) - PLOT.y).toFixed(1)).join(' ');
  iceEl = el('path', { d: iceD, stroke: CARBON, 'stroke-width': 1.4, fill: 'none', 'stroke-dasharray': '4 3', opacity: 0.7 }, plot);
  data.icecore.forEach(d => el('circle', { cx: xScale(d[0]) - PLOT.x, cy: yScale(d[1]) - PLOT.y, r: 1.6, fill: CARBON }, plot));

  // Keeling sawtooth (monthly, real)
  const m = data.monthly;
  const curveD = m.map((d, i) => (i === 0 ? 'M' : 'L') + ' ' + (xScale(d[0]) - PLOT.x).toFixed(1) + ' ' + (yScale(d[1]) - PLOT.y).toFixed(1)).join(' ');
  curveEl = el('path', { d: curveD, stroke: CARBON, 'stroke-width': 1.4, fill: 'none', 'stroke-linejoin': 'round' }, plot);

  // lookup ppm at a given year (nearest monthly sample)
  ppmAt = (yr) => {
    let best = null, bd = 1e9;
    for (const d of m) { const dd = Math.abs(d[0] - yr); if (dd < bd) { bd = dd; best = d; } }
    return best ? best[1] : null;
  };

  // Inline label at the curve head
  text(plot, { x: xScale(2026) - PLOT.x - 4, y: yScale(431) - PLOT.y - 8, 'text-anchor': 'end', fill: CARBON, 'font-family': 'IBM Plex Mono', 'font-size': 10, id: 'ch8-head' }, '431 ppm · Apr 2026');

  // Pivot markers
  const flagsG = el('g', {}, plot);
  PIVOTS.forEach(p => {
    const x = xScale(p.year) - PLOT.x;
    const py = yScale(ppmAt(p.year) || 320) - PLOT.y;
    const g = el('g', { id: 'ch8-flag-' + p.year, opacity: 0 }, flagsG);
    el('line', { x1: x, y1: 0, x2: x, y2: PLOT.h, stroke: '#8a7659', 'stroke-width': 0.8, 'stroke-dasharray': '3 4', opacity: 0.8 }, g);
    el('circle', { cx: x, cy: py, r: 3.2, fill: p.year === 1972 ? FIRE : CARBON, stroke: '#f3ecdd', 'stroke-width': 1.2 }, g);
    const ly = PLOT.h - 8;
    const t = el('text', { x: x + 10, y: ly, transform: `rotate(-90, ${x + 10}, ${ly})`, 'text-anchor': 'start', 'font-family': 'IBM Plex Mono', 'font-size': 9.5, 'letter-spacing': 1.2, fill: p.year === 1972 ? FIRE : '#4a3d2e', stroke: '#f3ecdd', 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke fill' }, g);
    t.textContent = (p.year + ' · ' + p.label).toUpperCase();
  });

  curveLen = curveEl.getTotalLength();
  iceLen = iceEl.getTotalLength();
  curveEl.style.transition = 'none'; iceEl.style.transition = 'none';
  curveEl.style.strokeDasharray = curveLen; curveEl.style.strokeDashoffset = curveLen;
  iceEl.style.strokeDasharray = iceLen; iceEl.style.strokeDashoffset = iceLen;
  return true;
}

function revealToYear(year) {
  if (iceEl) {
    const it = Math.max(0, Math.min(1, (year - 1850) / (1958 - 1850)));
    iceEl.style.strokeDashoffset = iceLen * (1 - it);
  }
  if (curveEl) {
    const ct = Math.max(0, Math.min(1, (year - 1958) / (X_MAX - 1958)));
    curveEl.style.strokeDashoffset = curveLen * (1 - ct);
    const head = document.getElementById('ch8-head');
    if (head) head.setAttribute('opacity', year >= 2010 ? '1' : '0');
  }
  PIVOTS.forEach(p => { const n = document.getElementById('ch8-flag-' + p.year); if (n) n.setAttribute('opacity', p.year <= year ? '1' : '0'); });
}

function progressToYear(p) {
  if (p < 0.25) return 1850 + (p / 0.25) * (1958 - 1850);
  if (p < 0.50) return 1958 + ((p - 0.25) / 0.25) * (1972 - 1958);
  if (p < 0.72) return 1972 + ((p - 0.50) / 0.22) * (2000 - 1972);
  return 2000 + ((p - 0.72) / 0.28) * (X_MAX - 2000);
}

let attached = false;
function attachScroll() {
  if (attached) return;
  const scrolly = document.querySelector('#ch8 .scrolly');
  if (!scrolly) return;
  attached = true;
  const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
  let pending = false;
  const update = () => {
    pending = false;
    const r = scrolly.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    if (total <= 0) return;
    if (isNarrow()) { revealToYear(X_MAX); return; }
    const progress = Math.max(0, Math.min(1, -r.top / total));
    revealToYear(progressToYear(progress));
  };
  window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

export async function init(state) {
  if (await buildChart()) attachScroll();
  state.ready = true;
  state.pending.forEach(fn => fn());
  state.pending = [];
}

export const actions = {
  'ch8-step1': () => {}, 'ch8-step2': () => {}, 'ch8-step3': () => {}, 'ch8-step4': () => {}
};
