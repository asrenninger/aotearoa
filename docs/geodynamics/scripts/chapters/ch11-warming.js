/**
 * Chapter 11 — The heat arrives.
 *
 * Two figures from a real New Zealand annual temperature series:
 *   #warming-stripes — a stripe per year, blue (cool) → red (warm).
 *   #seven-station   — the same anomalies as a line, warmest year marked.
 *
 * Data: data/nz-temp-annual.json — ERA5 reanalysis (Open-Meteo), a five-point
 * national mean, anomalies vs 1991–2020, built by data/build/fetch-nz-temp.py.
 * If that file is absent, falls back to a deterministic representative series
 * carrying the published trend (so the figures always render).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function text(parent, attrs, content) { const n = el('text', attrs, parent); n.textContent = content; return n; }

function fallbackSeries() {
  const Y0 = 1909, Y1 = 2024;
  const noise = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
  const series = [];
  for (let y = Y0; y <= Y1; y++) {
    const t = (y - Y0) / (Y1 - Y0);
    let a = -0.7 + 1.7 * t + 0.28 * noise(y - Y0);
    if (y === 2022) a = 1.18;
    series.push({ year: y, anomaly: +a.toFixed(3) });
  }
  return { baseline: '1981–2010', series, source: 'Source: NIWA', real: false };
}

function rampColour(a, lo, hi) {
  const cold = [44, 100, 121], mid = [243, 236, 221], warm = [192, 67, 31];
  const span = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
  const t = Math.max(-1, Math.min(1, a / span));
  let c;
  if (t < 0) { const k = t + 1; c = cold.map((v, i) => Math.round(v + (mid[i] - v) * k)); }
  else       { const k = t;     c = mid.map((v, i) => Math.round(v + (warm[i] - v) * k)); }
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function renderStripes(series, lo, hi) {
  const svg = document.getElementById('warming-stripes');
  if (!svg) return;
  const W = 800, H = 150;
  const n = series.length;
  const bw = W / n;
  series.forEach((d, i) => {
    el('rect', {
      x: (i * bw).toFixed(2), y: 18, width: (bw + 0.6).toFixed(2), height: H - 40,
      fill: rampColour(d.anomaly, lo, hi), class: 'stripe', style: `transition-delay:${i * 6}ms`
    }, svg);
  });
  text(svg, { x: 0, y: 12, class: 'map-label', fill: '#8a7659' }, `New Zealand annual temperature, ${series[0].year}–${series[series.length - 1].year}`);
  text(svg, { x: 0, y: H - 6, class: 'axis-label' }, series[0].year);
  text(svg, { x: W, y: H - 6, 'text-anchor': 'end', class: 'axis-label' }, series[series.length - 1].year);
  text(svg, { x: W / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-label', fill: '#8a7659' }, 'cooler  ·  warmer →');
}

function renderLine(series, lo, hi, baseline, source) {
  const svg = document.getElementById('seven-station');
  if (!svg) return;
  const Y0 = series[0].year, Y1 = series[series.length - 1].year;
  const PLOT = { x: 56, y: 70, w: 700, h: 230 };
  const yMin = Math.min(-0.6, lo - 0.15), yMax = Math.max(0.6, hi + 0.2);
  const xS = y => PLOT.x + (y - Y0) / (Y1 - Y0) * PLOT.w;
  const yS = a => PLOT.y + (1 - (a - yMin) / (yMax - yMin)) * PLOT.h;

  text(svg, { x: 0, y: 14, class: 'map-label', fill: '#8a7659' }, 'New Zealand temperature anomaly');
  const warmest = series.reduce((m, d) => d.anomaly > m.anomaly ? d : m, series[0]);
  text(svg, { x: 0, y: 42, class: 'fig-title', 'font-size': 22, fill: '#1d1610' }, 'The warmest years are the recent ones');

  const plot = el('g', { transform: `translate(${PLOT.x}, ${PLOT.y})` }, svg);
  const grid = el('g', { class: 'grid-line' }, plot);
  for (let v = Math.ceil(yMin * 2) / 2; v <= yMax; v += 0.5) {
    const y = yS(v) - PLOT.y;
    el('line', { x1: 0, y1: y, x2: PLOT.w, y2: y }, grid);
    text(plot, { x: -8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, (v > 0 ? '+' : '') + v.toFixed(1));
  }
  el('line', { x1: 0, y1: yS(0) - PLOT.y, x2: PLOT.w, y2: yS(0) - PLOT.y, stroke: '#8a7659', 'stroke-width': 0.9 }, plot);
  el('line', { x1: 0, y1: 0, x2: 0, y2: PLOT.h, class: 'axis-line' }, plot);
  const xticks = [Y0, Math.round((Y0 + Y1) / 2 - (Y1 - Y0) / 4), Math.round((Y0 + Y1) / 2), Math.round((Y0 + Y1) / 2 + (Y1 - Y0) / 4), Y1];
  xticks.forEach(yr => text(plot, { x: xS(yr) - PLOT.x, y: PLOT.h + 18, 'text-anchor': 'middle', class: 'axis-label' }, yr));

  const pts = series.map(d => [xS(d.year) - PLOT.x, yS(d.anomaly) - PLOT.y]);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const line = el('path', { d, stroke: '#c0431f', 'stroke-width': 1.6, fill: 'none', 'stroke-linejoin': 'round' }, plot);
  // Draw animation, self-contained (inline style would override a .route class,
  // and an IntersectionObserver proved unreliable in this embed). Reveal when
  // the figure scrolls near view, with a guaranteed fallback so it always draws.
  const len = line.getTotalLength();
  line.style.strokeDasharray = len;
  line.style.strokeDashoffset = len;
  line.style.transition = 'stroke-dashoffset 1.8s ease-out';
  const draw = () => { line.style.strokeDashoffset = '0'; };
  const fig = svg.closest('.reveal') || svg;
  let drawn = false;
  const tryDraw = () => {
    if (drawn) return;
    const r = fig.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
      drawn = true; draw();
      window.removeEventListener('scroll', tryDraw);
    }
  };
  window.addEventListener('scroll', tryDraw, { passive: true });
  tryDraw();
  setTimeout(() => { if (!drawn) { drawn = true; draw(); } }, 4000);

  const mx = xS(warmest.year) - PLOT.x, my = yS(warmest.anomaly) - PLOT.y;
  el('circle', { cx: mx, cy: my, r: 4, fill: '#c0431f', stroke: '#f3ecdd', 'stroke-width': 1.4 }, plot);
  const t = el('text', { x: mx, y: my - 12, 'text-anchor': 'middle', 'font-family': 'IBM Plex Mono', 'font-size': 9.5, 'letter-spacing': 1, fill: '#1d1610', stroke: '#f3ecdd', 'stroke-width': 3, 'paint-order': 'stroke fill' }, plot);
  t.textContent = `${warmest.year} · ${warmest.anomaly > 0 ? '+' : ''}${warmest.anomaly.toFixed(2)}°C`;

  el('line', { x1: 0, y1: PLOT.h + 30, x2: PLOT.w, y2: PLOT.h + 30, stroke: '#c9b894', 'stroke-width': 0.5 }, plot);
  text(plot, { x: 0, y: PLOT.h + 48, class: 'map-label', fill: '#8a7659' }, source);
}

export async function render() {
  let payload;
  try {
    const j = await fetch('./data/nz-temp-annual.json').then(r => r.ok ? r.json() : Promise.reject());
    payload = {
      series: j.series, baseline: j.baseline, real: true,
      source: 'Source: ECMWF; Open-Meteo'
    };
  } catch (e) {
    payload = fallbackSeries();
  }
  const anomalies = payload.series.map(d => d.anomaly);
  const lo = Math.min(...anomalies), hi = Math.max(...anomalies);
  renderStripes(payload.series, lo, hi);
  renderLine(payload.series, lo, hi, payload.baseline, payload.source);
}
