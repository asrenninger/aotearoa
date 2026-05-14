/**
 * Chapter 7 — Refrigeration & the Britain-bound century.
 *
 * Not a map — a data-driven SVG line chart of NZ exports going to Britain.
 * The init() builds the entire chart from an annual-anchor data series
 * (axes, gridlines, area fill, polyline, flag markers). The step actions
 * advance a stroke-dashoffset reveal across four windows of time:
 *   step 1 → 1880–1905 (the rise)
 *   step 2 → through 1960 (the long peak)
 *   step 3 → static (chapter shifts to what the line stands on)
 *   step 4 → through 2024 (the cliff and what came after)
 *
 * Anchors are sourced from Te Ara, Stats NZ historical series, and trade
 * ministry reporting. Inter-anchor years are linearly interpolated for
 * the rendered curve. The chart label notes the schematic interpolation.
 */

// Confirmed anchor points (rounded to whole percent except where finer
// detail is widely cited). Source notes:
//   1882–1955     — Te Ara, "Britain, Europe and New Zealand" / "Trade
//                   with Britain" (1966 Encyclopaedia)
//   1932 (88%)    — Ottawa imperial preference; widely cited peak
//   1940 (88%)    — WWII, Britain commandeering pastoral output
//   1955 (65.3%)  — Stats NZ
//   1960 (53%)    — Te Ara
//   1973 (~27%)   — end-of-year share after UK accession to EEC (Te Ara)
//   1990 (7.0%)   — World Bank WITS / Stats NZ
//   2000 (6.2%)   — Te Ara
//   2008          — NZ–China FTA in force; UK share continues to fall
//   2024 (~2.5%)  — Stats NZ / MFAT
const EXPORT_DATA = [
  { year: 1880, share: 72 },
  { year: 1882, share: 75 },
  { year: 1885, share: 78 },
  { year: 1890, share: 80 },
  { year: 1895, share: 82 },
  { year: 1900, share: 80 },
  { year: 1905, share: 78 },
  { year: 1910, share: 78 },
  { year: 1915, share: 85 },
  { year: 1920, share: 82 },
  { year: 1925, share: 80 },
  { year: 1930, share: 84 },
  { year: 1932, share: 88 },
  { year: 1935, share: 87 },
  { year: 1940, share: 88 },
  { year: 1945, share: 80 },
  { year: 1950, share: 70 },
  { year: 1955, share: 65 },
  { year: 1960, share: 53 },
  { year: 1961, share: 52 },
  { year: 1965, share: 47 },
  { year: 1970, share: 36 },
  { year: 1973, share: 27 },
  { year: 1975, share: 21 },
  { year: 1980, share: 14 },
  { year: 1985, share: 9 },
  { year: 1990, share: 7 },
  { year: 1995, share: 6.5 },
  { year: 2000, share: 6.2 },
  { year: 2005, share: 5 },
  { year: 2008, share: 4.5 },
  { year: 2010, share: 4 },
  { year: 2015, share: 3.5 },
  { year: 2020, share: 3 },
  { year: 2024, share: 2.5 }
];

// Pivotal moments — each renders as a full-height dashed vertical line
// with a rotated label running along it. `kind` selects the colour
// (oxblood for UK pivots, asian violet for China). The 1961 marker is
// the early warning: UK first applied to the EEC then, vetoed twice by
// de Gaulle (1963, 1967) before the 1971-72 accession negotiations.
// NZ began diversifying immediately, which is why the curve is already
// down 26 points by the time the formal entry lands in 1973.
const PIVOTS = [
  { year: 1882, kind: 'uk',     label: 'First frozen meat to Britain' },
  { year: 1932, kind: 'uk',     label: 'Ottawa imperial preference · 88%' },
  { year: 1961, kind: 'uk',     label: 'UK first seeks EEC entry · 52%' },
  { year: 1973, kind: 'uk-eec', label: 'UK joins the EEC · 27%' },
  { year: 2008, kind: 'china',  label: 'NZ–China FTA · 4.5%' }
];

// Chart geometry within the existing 600×600 viewBox. Plot area sits at
// (60, 80) with a 500×400 inner box, leaving room for axis labels and the
// chart title above + a caption strip below.
const PLOT = { x: 60, y: 80, w: 500, h: 400 };
const X_MIN = 1880, X_MAX = 2024;

const SVG_NS = 'http://www.w3.org/2000/svg';
const xScale = year => PLOT.x + (year - X_MIN) / (X_MAX - X_MIN) * PLOT.w;
const yScale = pct  => PLOT.y + (1 - pct / 100) * PLOT.h;

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function text(parent, attrs, content) {
  const n = el('text', attrs, parent);
  n.textContent = content;
  return n;
}

// ---------------------------------------------------------------------------
// Pivot colour assignment
// ---------------------------------------------------------------------------

function pivotColour(kind) {
  // British eras and the EEC rupture share the chapter's oxblood signature;
  // the post-British China FTA marker uses violet to flag the new partner.
  return kind === 'china' ? '#6b3a82' : '#8c2230';
}

// ---------------------------------------------------------------------------
// Chart construction
// ---------------------------------------------------------------------------

function buildChart() {
  const svg = document.getElementById('viz-ch7');
  if (!svg) return null;

  // Header text already lives in the SVG markup. We only generate the
  // plot-area contents here (axes, line, area, flags).
  const plot = el('g', { id: 'ch7-plot', transform: `translate(${PLOT.x}, ${PLOT.y})` }, svg);

  // Y-axis gridlines + labels at 0/20/40/60/80/100
  const grid = el('g', { class: 'grid-line' }, plot);
  for (let v = 0; v <= 100; v += 20) {
    const y = (1 - v / 100) * PLOT.h;
    el('line', { x1: 0, y1: y, x2: PLOT.w, y2: y }, grid);
    text(plot, { x: -8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, v + '%');
  }

  // Axis lines
  el('line', { x1: 0, y1: 0,         x2: 0,        y2: PLOT.h, class: 'axis-line' }, plot);
  el('line', { x1: 0, y1: PLOT.h,    x2: PLOT.w,   y2: PLOT.h, class: 'axis-line' }, plot);

  // X-axis labels at decade-ish marks
  const xLabels = [1882, 1900, 1932, 1960, 1973, 1990, 2008, 2024];
  for (const yr of xLabels) {
    const x = xScale(yr) - PLOT.x;
    el('line', { x1: x, y1: PLOT.h, x2: x, y2: PLOT.h + 4, stroke: '#8a7659', 'stroke-width': 0.5 }, plot);
    text(plot, { x, y: PLOT.h + 18, 'text-anchor': 'middle', class: 'axis-label' }, yr);
  }

  // Build the polyline path d-string from data
  const linePts = EXPORT_DATA.map(d => [xScale(d.year) - PLOT.x, yScale(d.share) - PLOT.y]);
  const lineD = linePts.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  // Filled area under the curve
  const areaD = lineD + ` L ${linePts[linePts.length - 1][0].toFixed(1)} ${PLOT.h} L ${linePts[0][0].toFixed(1)} ${PLOT.h} Z`;
  el('path', { id: 'ch7-area', d: areaD, fill: '#8c2230', opacity: 0.14, stroke: 'none' }, plot);

  // The line itself — stroke-dasharray + stroke-dashoffset will animate
  // the reveal. We compute the path length from the rendered DOM after
  // appending so the offset is exact.
  const line = el('path', {
    id: 'ch7-line',
    d: lineD,
    stroke: '#8c2230',
    'stroke-width': 2.2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    fill: 'none'
  }, plot);

  // The data dots — small circles at each anchor, so the viewer sees this
  // is a plotted series rather than a smooth illustration.
  const dotsG = el('g', { id: 'ch7-dots' }, plot);
  EXPORT_DATA.forEach(d => {
    el('circle', {
      cx: xScale(d.year) - PLOT.x,
      cy: yScale(d.share) - PLOT.y,
      r: 1.6,
      fill: '#8c2230',
      'data-year': d.year
    }, dotsG);
  });

  // Cursor — a larger dot that sits at the rightmost revealed year. We
  // move it explicitly per step.
  el('circle', {
    id: 'ch7-cursor',
    cx: xScale(EXPORT_DATA[0].year) - PLOT.x,
    cy: yScale(EXPORT_DATA[0].share) - PLOT.y,
    r: 5,
    fill: '#8c2230',
    stroke: '#f3ecdd',
    'stroke-width': 2,
    opacity: 0
  }, plot);

  // Pivot markers — full-height dashed vertical lines with a rotated label
  // running upward along the right side of each. Each lives in a group keyed
  // `ch7-flag-${year}` so the reveal logic can fade them in as the line
  // sweeps past their year.
  const flagsG = el('g', { id: 'ch7-flags' }, plot);
  PIVOTS.forEach(p => {
    const datum = EXPORT_DATA.find(d => d.year === p.year);
    if (!datum) return;
    const x  = xScale(p.year) - PLOT.x;
    const dy = yScale(datum.share) - PLOT.y;
    const colour = pivotColour(p.kind);

    const g = el('g', { id: 'ch7-flag-' + p.year, opacity: 0 }, flagsG);

    // Full-height dashed vertical guide. The 1973 rupture gets a slightly
    // bolder stroke to read as the structural break.
    el('line', {
      x1: x, y1: 0, x2: x, y2: PLOT.h,
      stroke: colour,
      'stroke-width': p.kind === 'uk-eec' ? 1.2 : 0.8,
      'stroke-dasharray': p.kind === 'uk-eec' ? '5 3' : '3 4',
      opacity: 0.85
    }, g);

    // Anchor dot where the guide intersects the curve — picks out the pivot
    // visually and gives the eye a place to land.
    el('circle', { cx: x, cy: dy, r: 3.4, fill: colour, stroke: '#f3ecdd', 'stroke-width': 1.2 }, g);

    // Rotated label running upward along the right side of the line.
    // Offset 10px right of the line so it doesn't graze the dashes, and
    // painted with a paper-coloured stroke under the fill (paint-order:
    // stroke fill) — that gives each glyph a halo so the text pops above
    // the chart curve and gridlines.
    const labelAnchorY = PLOT.h - 8;
    const labelText = el('text', {
      x: x + 10,
      y: labelAnchorY,
      transform: `rotate(-90, ${x + 10}, ${labelAnchorY})`,
      'text-anchor': 'start',
      'font-family': 'IBM Plex Mono',
      'font-size': 9.5,
      'letter-spacing': 1.4,
      fill: colour,
      stroke: '#f3ecdd',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
      'paint-order': 'stroke fill'
    }, g);
    labelText.textContent = (p.year + ' · ' + p.label).toUpperCase();
  });

  return { line, plot };
}

// ---------------------------------------------------------------------------
// Reveal — driven by scroll position through the .scrolly section
// ---------------------------------------------------------------------------

let lineEl = null;
let lineLength = 0;

function revealUpToYear(targetYear) {
  if (!lineEl) return;
  if (!lineLength) lineLength = lineEl.getTotalLength();

  // Path is monotonic in x (years strictly increase), so the fraction by
  // year-distance closely approximates fraction by arc-length.
  const t = Math.max(0, Math.min(1, (targetYear - X_MIN) / (X_MAX - X_MIN)));
  lineEl.style.strokeDasharray = lineLength;
  lineEl.style.strokeDashoffset = lineLength * (1 - t);

  document.querySelectorAll('#ch7-dots circle').forEach(c => {
    const yr = parseInt(c.dataset.year, 10);
    c.style.opacity = (yr <= targetYear) ? '1' : '0';
  });

  // Cursor: positioned at the latest revealed data point.
  const visible = EXPORT_DATA.filter(d => d.year <= targetYear);
  const last = visible[visible.length - 1] || EXPORT_DATA[0];
  const cursor = document.getElementById('ch7-cursor');
  if (cursor) {
    cursor.setAttribute('cx', xScale(last.year) - PLOT.x);
    cursor.setAttribute('cy', yScale(last.share) - PLOT.y);
    cursor.setAttribute('opacity', targetYear > X_MIN ? '1' : '0');
  }
}

function showFlagsThrough(year) {
  PIVOTS.forEach(p => {
    const node = document.getElementById('ch7-flag-' + p.year);
    if (node) node.setAttribute('opacity', p.year <= year ? '1' : '0');
  });
}

// Map a 0..1 scroll progress through the .scrolly section to a target year.
// Anchors are aligned with the four step boundaries so the line's reveal
// matches what each step's prose is talking about:
//   0.00–0.30 → 1880 → 1905   (step 1: refrigeration takes hold)
//   0.30–0.55 → 1905 → 1960   (step 2: the long peak)
//   0.55–0.75 → 1960 (static) (step 3: what the line stood on — Māori land)
//   0.75–1.00 → 1960 → 2024   (step 4: the cliff)
function progressToYear(p) {
  if (p < 0.30) return 1880 + (p / 0.30) * 25;
  if (p < 0.55) return 1905 + ((p - 0.30) / 0.25) * 55;
  if (p < 0.75) return 1960;
  return 1960 + ((p - 0.75) / 0.25) * 64;
}

let scrollAttached = false;
function attachScrollDrivenReveal() {
  if (scrollAttached) return;
  const scrolly = document.querySelector('#ch7 .scrolly');
  if (!scrolly) return;
  scrollAttached = true;

  // At narrow widths the .scrolly viz-pane isn't sticky (responsive single-
  // column), so a scroll-tied reveal can't co-display chart + prose. Fall
  // back to the final state once the section enters view.
  const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

  let pending = false;
  const update = () => {
    pending = false;
    const r = scrolly.getBoundingClientRect();
    const vpH = window.innerHeight;
    const total = r.height - vpH;
    if (total <= 0) return;

    if (isNarrow()) {
      revealUpToYear(X_MAX);
      showFlagsThrough(X_MAX);
      return;
    }

    const progress = Math.max(0, Math.min(1, -r.top / total));
    const year = progressToYear(progress);
    revealUpToYear(year);
    showFlagsThrough(year);
  };

  window.addEventListener('scroll', () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function init(state) {
  const built = buildChart();
  if (built) {
    lineEl = built.line;
    // getTotalLength requires the path to be in the DOM; buildChart
    // appended it to the SVG before returning, so this is safe.
    lineLength = lineEl.getTotalLength();
    // No CSS transition: the reveal is driven directly by the scroll
    // listener (rAF-throttled), so each frame's update should land
    // immediately. A long transition would smear the scroll coupling.
    lineEl.style.transition = 'none';
    lineEl.style.strokeDasharray = lineLength;
    lineEl.style.strokeDashoffset = lineLength;
    attachScrollDrivenReveal();
  }
  state.ready = true;
  state.pending.forEach(fn => fn());
  state.pending = [];
}

// Step actions are no-ops: the scroll listener is the source of truth for
// the line's reveal. Kept here so the dispatcher recognises ch7 steps and
// the IO observer's is-active toggling on the prose still works.
export const actions = {
  'ch7-step1': () => {},
  'ch7-step2': () => {},
  'ch7-step3': () => {},
  'ch7-step4': () => {}
};
