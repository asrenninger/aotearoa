/**
 * Survey-charts renderer.
 *
 * Inline SVG charts driven by the same `data/survey/atlas_stats.json` that
 * `survey-facts.js` reads. Mount points are plain `<div data-survey-chart>`
 * elements; this module fills them on page load.
 *
 * Supported `data-survey-chart` kinds:
 *
 *   warmth-matrix          — 4×4 grid, respondent × target ethnicity,
 *                            colour-intensified by warmth. Most recent
 *                            wave by default; override with data-year.
 *   goldfields-lollipop    — horizontal lollipop of life satisfaction by
 *                            old-goldfield territorial authority,
 *                            ordered by value, Auckland as reference.
 *   convergence            — multi-line series, the four warmth-target
 *                            trajectories T01–T16 (Warm.NZEuro /
 *                            Warm.Maori / Warm.Pacific / Warm.Asians).
 *   lifesat-trajectory     — single-line series with annotations for
 *                            peak / current.
 *
 * No external dependencies — pure inline SVG, same palette as the rest
 * of the atlas.
 */

import { el } from './svg.js';
import { PALETTE } from './palette.js';

const DATA_URL = './data/survey/atlas_stats.json';

let dataPromise = null;
function fetchOnce() {
  if (!dataPromise) {
    dataPromise = fetch(DATA_URL).then(r => r.json());
  }
  return dataPromise;
}

// ---- Shared style tokens ----------------------------------------------

const INK       = PALETTE.ink;
const INK_SOFT  = PALETTE.inkSoft;
const INK_FAINT = PALETTE.inkFaint;
const RULE      = PALETTE.rule;
const PAPER     = PALETTE.paper;

// Ethnic-target colours (consistent with the rest of the atlas).
const ETH_COLOR = {
  NZEuro:  PALETTE.british,  // kokowai
  Maori:   PALETTE.maori,    // pounamu
  Pacific: PALETTE.pacific,  // coral
  Asians:  PALETTE.asian,    // violet
  // group-name aliases for the matrix
  nz_european: PALETTE.british,
  maori:       PALETTE.maori,
  pacific:     PALETTE.pacific,
  asian:       PALETTE.asian,
};

const ETH_LABEL = {
  NZEuro:  'Pākehā',
  Maori:   'Māori',
  Pacific: 'Pacific',
  Asians:  'Asian',
  nz_european: 'Pākehā',
  maori:       'Māori',
  pacific:     'Pacific',
  asian:       'Asian',
};

// ---- SVG helpers ------------------------------------------------------

function text(parent, attrs, content) {
  const n = el('text', attrs);
  n.textContent = content;
  parent.appendChild(n);
  return n;
}

function svgRoot(viewBox) {
  return el('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox,
    preserveAspectRatio: 'xMidYMid meet'
  });
}

function title(parent, x, y, t) {
  text(parent, {
    x, y,
    'font-family': 'Fraunces, Georgia, serif',
    'font-style': 'italic',
    'font-size': 19,
    fill: INK
  }, t);
}

function overline(parent, x, y, t) {
  text(parent, {
    x, y,
    'font-family': 'IBM Plex Mono, monospace',
    'font-size': 9,
    'letter-spacing': 1.5,
    fill: INK_FAINT
  }, t.toUpperCase());
}

function caption(parent, x, y, t) {
  text(parent, {
    x, y,
    'font-family': 'IBM Plex Mono, monospace',
    'font-size': 10,
    fill: INK_FAINT
  }, t);
}

// Linear interpolation in HSL between two hex colours.
function lerpHex(a, b, t) {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0')}`;
}

// Waves are keyed by the year fieldwork began; each ran into the next
// year (T16 "2024" ran from May 2024 to September 2025).
function waveLabel(year) {
  return `${year}–${String(year + 1).slice(2)}`;
}

// ---- Lookup ----------------------------------------------------------

function seriesFor(json, item, group) {
  const entry = json[item];
  if (!entry) return null;
  return entry.groups[group] || null;
}

function rowFor(json, item, group, year) {
  const s = seriesFor(json, item, group);
  if (!s) return null;
  return s.find(r => r.year === Number(year)) || null;
}

// ---- 1. Warmth matrix ------------------------------------------------
//
// 4×4 grid. Rows = respondent ethnicity, cols = target ethnicity.
// Each cell shows the mean warmth of the row group toward the col group.
// Colour intensity scales with warmth (clamped 4.0 → 6.0 on a 1–7 scale,
// since most cells fall in that band).
function renderWarmthMatrix(container, json) {
  const year = Number(container.dataset.year || 2024);
  const targets = ['NZEuro', 'Maori', 'Pacific', 'Asians'];
  const respondents = ['nz_european', 'maori', 'pacific', 'asian'];

  const W = 640, H = 380;
  const M = { l: 110, t: 112, r: 24, b: 56 };
  const cellW = (W - M.l - M.r) / targets.length;
  const cellH = (H - M.t - M.b) / respondents.length;

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, `Warmth between groups · ${waveLabel(year)}`);
  title(svg, M.l, 50, 'Each group rates its own group most warmly');
  caption(svg, M.l, 68, 'Means on a 1–7 thermometer scale. Darker = warmer.');

  // Column (target) labels — sit just above the grid
  targets.forEach((t, i) => {
    const x = M.l + cellW * (i + 0.5);
    text(svg, {
      x, y: M.t - 10,
      'text-anchor': 'middle',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1.5,
      fill: ETH_COLOR[t]
    }, ETH_LABEL[t].toUpperCase());
  });

  // Row (respondent) labels
  respondents.forEach((r, i) => {
    const y = M.t + cellH * (i + 0.5);
    text(svg, {
      x: M.l - 14, y: y + 4,
      'text-anchor': 'end',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1.5,
      fill: ETH_COLOR[r]
    }, ETH_LABEL[r].toUpperCase());
  });

  // Cells
  const LO = 4.0, HI = 6.0;
  for (let r = 0; r < respondents.length; r++) {
    for (let c = 0; c < targets.length; c++) {
      const row = rowFor(json, `Warm.${targets[c]}`, respondents[r], year);
      const v = row && row.mean != null ? row.mean : null;
      const x = M.l + c * cellW;
      const y = M.t + r * cellH;
      const t = v == null ? 0 : Math.max(0, Math.min(1, (v - LO) / (HI - LO)));
      const fill = v == null ? PAPER : lerpHex(PALETTE.paperDeep, INK, t * 0.7);
      svg.appendChild(el('rect', {
        x: x + 2, y: y + 2,
        width: cellW - 4, height: cellH - 4,
        fill, stroke: RULE, 'stroke-width': 0.5
      }));
      // diagonal highlight (in-group cells)
      const inGroup =
        (respondents[r] === 'nz_european' && targets[c] === 'NZEuro') ||
        (respondents[r] === 'maori'       && targets[c] === 'Maori')  ||
        (respondents[r] === 'pacific'     && targets[c] === 'Pacific') ||
        (respondents[r] === 'asian'       && targets[c] === 'Asians');
      if (inGroup) {
        svg.appendChild(el('rect', {
          x: x + 2, y: y + 2,
          width: cellW - 4, height: cellH - 4,
          fill: 'none',
          stroke: ETH_COLOR[targets[c]],
          'stroke-width': 1.5
        }));
      }
      if (v != null) {
        text(svg, {
          x: x + cellW / 2,
          y: y + cellH / 2 + 5,
          'text-anchor': 'middle',
          'font-family': 'Fraunces, Georgia, serif',
          'font-weight': 600, 'font-size': 18,
          fill: t > 0.55 ? PAPER : INK
        }, v.toFixed(2));
      } else {
        text(svg, {
          x: x + cellW / 2,
          y: y + cellH / 2 + 4,
          'text-anchor': 'middle',
          'font-family': 'IBM Plex Mono, monospace',
          'font-size': 10, fill: INK_FAINT
        }, '—');
      }
    }
  }

  // Footer line
  caption(svg, M.l, H - 16, `Source: NZAVS, T16 (${waveLabel(year)}). Unweighted respondent means.`);
}

// ---- 2. Goldfields lollipop ------------------------------------------

const GOLDFIELDS_TAS = [
  // Display labels + JSON group keys (lowercase snake). Labels use the
  // single salient name for each district (no hyphenated TA names).
  { label: 'Central Otago', key: 'ta_central_otago_district' },
  { label: 'Queenstown',    key: 'ta_queenstown_lakes_district' },
  { label: 'Coromandel',    key: 'ta_thames_coromandel_district' },
  { label: 'Buller',        key: 'ta_buller_district' },
  { label: 'Westland',      key: 'ta_westland_district' },
  { label: 'Clutha',        key: 'ta_clutha_district' },
  { label: 'Waitaki',       key: 'ta_waitaki_district' },
  { label: 'Hauraki',       key: 'ta_hauraki_district' },
  { label: 'Grey',          key: 'ta_grey_district' }
];

function renderGoldfieldsLollipop(container, json) {
  const year = Number(container.dataset.year || 2024);
  const item = container.dataset.item || 'SWB.LifeSat01';

  const data = GOLDFIELDS_TAS.map(t => {
    const row = rowFor(json, item, t.key, year);
    return { ...t, value: row ? row.mean : null, n: row ? row.n : 0 };
  }).filter(d => d.value != null);
  data.sort((a, b) => b.value - a.value);

  const aucklandRow = rowFor(json, item, 'auckland', year);
  const aucklandValue = aucklandRow ? aucklandRow.mean : null;

  const W = 640, H = 420;
  const M = { l: 160, t: 104, r: 64, b: 88 };
  const rowH = (H - M.t - M.b) / data.length;
  // X-domain: snap to [5.2, 6.0] band
  const xMin = 5.2, xMax = 6.0;
  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, `Life satisfaction · ${waveLabel(year)}`);
  title(svg, M.l, 50, 'Central Otago, Queenstown and the Coromandel rate life highest');
  caption(svg, M.l, 68, 'Mean of "I am satisfied with my life" (1–7).');

  // Auckland reference line — runs only behind the data rows, with the
  // label sitting beneath the axis so it doesn't collide with the title.
  if (aucklandValue != null) {
    const ax = xScale(aucklandValue);
    svg.appendChild(el('line', {
      x1: ax, y1: M.t,
      x2: ax, y2: H - M.b,
      stroke: INK_FAINT, 'stroke-width': 1,
      'stroke-dasharray': '3 3'
    }));
    text(svg, {
      x: ax, y: H - M.b + 30,
      'text-anchor': 'middle',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 9, 'letter-spacing': 1.5,
      fill: INK_FAINT
    }, `AUCKLAND ${aucklandValue.toFixed(2)}`);
  }

  // Axis ticks
  for (let v = 5.2; v <= 6.0001; v += 0.2) {
    const x = xScale(v);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b,
      x2: x, y2: H - M.b + 4,
      stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, v.toFixed(1));
    svg.lastElementChild.setAttribute('text-anchor', 'middle');
  }
  svg.appendChild(el('line', {
    x1: M.l, y1: H - M.b,
    x2: W - M.r, y2: H - M.b,
    stroke: RULE
  }));

  // Lollipops
  data.forEach((d, i) => {
    const y = M.t + rowH * (i + 0.5);
    const x = xScale(d.value);
    // Label
    text(svg, {
      x: M.l - 12, y: y + 4,
      'text-anchor': 'end',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1,
      fill: INK_SOFT
    }, d.label.toUpperCase());
    // Stem
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: x, y2: y,
      stroke: RULE, 'stroke-width': 1
    }));
    // Dot
    const isTop3 = i < 3;
    const isBottom = i === data.length - 1;
    const fill = isTop3 ? PALETTE.poly : isBottom ? PALETTE.british : INK_SOFT;
    svg.appendChild(el('circle', {
      cx: x, cy: y, r: 5,
      fill, stroke: PAPER, 'stroke-width': 1.5
    }));
    // Value at end
    text(svg, {
      x: x + 12, y: y + 4,
      'font-family': 'Fraunces, Georgia, serif',
      'font-weight': 600, 'font-size': 13, fill: INK
    }, d.value.toFixed(2));
  });

  caption(svg, M.l, H - 16,
          `Source: NZAVS, T16 (${waveLabel(year)}). Unweighted respondent means.`);
}

// ---- 3. Four-group warmth convergence --------------------------------
//
// One line per target ethnicity. We use the `outgroup` series — warmth
// from everyone *outside* the target group — so each line measures
// out-group sentiment toward that ethnicity rather than mixing in the
// in-group's own rating. This is the paper2 convention and the cleanest
// read for "how does the country feel about each group."
function renderConvergence(container, json) {
  const targets = ['NZEuro', 'Maori', 'Pacific', 'Asians'];

  const W = 720, H = 400;
  const M = { l: 56, t: 108, r: 100, b: 56 };

  // Gather all (year, value) for each line
  const lines = targets.map(t => {
    const s = seriesFor(json, `Warm.${t}`, 'outgroup') || [];
    return {
      target: t,
      label: ETH_LABEL[t],
      color: ETH_COLOR[t],
      points: s.filter(r => r.mean != null).map(r => ({ x: r.year, y: r.mean }))
    };
  }).filter(l => l.points.length > 0);

  const allYears = lines.flatMap(l => l.points.map(p => p.x));
  const allVals  = lines.flatMap(l => l.points.map(p => p.y));
  const xMin = Math.min(...allYears), xMax = Math.max(...allYears);
  const yMin = 4.0, yMax = 5.6;

  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);
  const yScale = v => M.t + (H - M.t - M.b) * (1 - (v - yMin) / (yMax - yMin));

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, 'Warmth towards each group · 2009–10 → 2024–25');
  title(svg, M.l, 50, 'Warmth towards the four largest ethnic groups has converged');
  caption(svg, M.l, 68,
          'Mean warmth (1–7) from respondents outside each target group.');

  // Y gridlines + labels
  for (let v = 4.0; v <= 5.6001; v += 0.4) {
    const y = yScale(v);
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: W - M.r, y2: y,
      stroke: RULE, 'stroke-width': 0.5
    }));
    caption(svg, M.l - 8, y + 3, v.toFixed(1));
    svg.lastElementChild.setAttribute('text-anchor', 'end');
  }

  // X ticks
  [2010, 2015, 2020, 2024].forEach(yr => {
    const x = xScale(yr);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b, x2: x, y2: H - M.b + 4,
      stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, String(yr));
    svg.lastElementChild.setAttribute('text-anchor', 'middle');
  });

  // Lines
  lines.forEach(l => {
    const path = l.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`)
      .join(' ');
    svg.appendChild(el('path', {
      d: path, fill: 'none', stroke: l.color,
      'stroke-width': 2, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));
  });

  // End-of-line labels — staggered so closely-converging lines (Māori,
  // Pacific) don't overlap each other. Sort by y, then walk through and
  // push any label that would land within MIN_GAP pixels of its
  // predecessor down by the difference.
  const ends = lines.map(l => ({
    label: l.label, color: l.color,
    x: xScale(l.points[l.points.length - 1].x),
    yTarget: yScale(l.points[l.points.length - 1].y)
  }));
  ends.sort((a, b) => a.yTarget - b.yTarget);
  const MIN_GAP = 14;
  ends.forEach((e, i) => {
    if (i === 0) { e.y = e.yTarget; return; }
    e.y = Math.max(e.yTarget, ends[i - 1].y + MIN_GAP);
  });
  // Labels alone — colour-coding makes the line-to-label match obvious,
  // so no leaders even when stagger pushes a label off its line.
  ends.forEach(e => {
    text(svg, {
      x: e.x + 8, y: e.y + 2,
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1,
      fill: e.color
    }, e.label.toUpperCase());
  });

  caption(svg, M.l, H - 16, 'Source: NZAVS, T1 (2009–10) → T16 (2024–25). Unweighted; years mark the start of fieldwork.');
}

// ---- 4. Life-satisfaction trajectory --------------------------------

function renderLifesatTrajectory(container, json) {
  const series = seriesFor(json, 'SWB.LifeSat01', 'all') || [];
  const points = series.filter(r => r.mean != null)
                       .map(r => ({ x: r.year, y: r.mean }));
  if (points.length === 0) return;

  const W = 640, H = 340;
  const M = { l: 56, t: 108, r: 24, b: 56 };

  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  const yMin = 5.3, yMax = 5.8;

  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);
  const yScale = v => M.t + (H - M.t - M.b) * (1 - (v - yMin) / (yMax - yMin));

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, 'Life satisfaction · 2009–10 → 2024–25');
  title(svg, M.l, 50, 'The peak came in the 2019–20 wave');
  caption(svg, M.l, 68,
          'Mean of "I am satisfied with my life" (1–7), all respondents. Axis runs 5.3 to 5.8.');

  // Y gridlines
  for (let v = 5.4; v <= 5.8001; v += 0.2) {
    const y = yScale(v);
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: W - M.r, y2: y,
      stroke: RULE, 'stroke-width': 0.5
    }));
    caption(svg, M.l - 8, y + 3, v.toFixed(1));
    svg.lastElementChild.setAttribute('text-anchor', 'end');
  }

  // X ticks
  [2010, 2015, 2020, 2024].forEach(yr => {
    const x = xScale(yr);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b, x2: x, y2: H - M.b + 4,
      stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, String(yr));
    svg.lastElementChild.setAttribute('text-anchor', 'middle');
  });

  // Path
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`).join(' ');
  svg.appendChild(el('path', {
    d, fill: 'none', stroke: INK,
    'stroke-width': 2, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  }));

  // Annotate peak (find the year with max y)
  const peak = points.reduce((a, b) => b.y > a.y ? b : a);
  svg.appendChild(el('circle', {
    cx: xScale(peak.x), cy: yScale(peak.y),
    r: 5, fill: PALETTE.british, stroke: PAPER, 'stroke-width': 1.5
  }));
  text(svg, {
    x: xScale(peak.x), y: yScale(peak.y) - 14,
    'text-anchor': 'middle',
    'font-family': 'IBM Plex Mono, monospace',
    'font-size': 10, 'letter-spacing': 1, fill: PALETTE.british
  }, `${waveLabel(peak.x)} · ${peak.y.toFixed(2)}`);

  // Annotate latest — label sits to the right of the dot, off the line.
  const last = points[points.length - 1];
  svg.appendChild(el('circle', {
    cx: xScale(last.x), cy: yScale(last.y),
    r: 5, fill: INK, stroke: PAPER, 'stroke-width': 1.5
  }));
  text(svg, {
    x: xScale(last.x) + 4, y: yScale(last.y) - 18,
    'text-anchor': 'end',
    'font-family': 'IBM Plex Mono, monospace',
    'font-size': 10, 'letter-spacing': 1, fill: INK
  }, `${waveLabel(last.x)} · ${last.y.toFixed(2)}`);

  caption(svg, M.l, H - 16, 'Source: NZAVS, T1 (2009–10) → T16 (2024–25). Unweighted; years mark the start of fieldwork.');
}

// ---- Mount -----------------------------------------------------------

const RENDERERS = {
  'warmth-matrix':       renderWarmthMatrix,
  'goldfields-lollipop': renderGoldfieldsLollipop,
  'convergence':         renderConvergence,
  'lifesat-trajectory':  renderLifesatTrajectory
};

export async function mountSurveyCharts(root = document) {
  const els = root.querySelectorAll('[data-survey-chart]');
  if (!els.length) return;
  try {
    const json = await fetchOnce();
    els.forEach(c => {
      const fn = RENDERERS[c.dataset.surveyChart];
      if (fn) fn(c, json);
    });
  } catch (err) {
    console.error('survey-charts: failed to load', err);
  }
}
