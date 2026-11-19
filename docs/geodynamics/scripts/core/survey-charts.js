/**
 * Survey-charts renderer (climate atlas).
 *
 * Inline SVG charts driven by `data/survey/atlas_stats.json`, written by
 * `scripts/data-prep/extract_atlas_stats.R`. Mount points are
 * `<div data-survey-chart="kind">` — this module fills them on load.
 *
 * Supported `data-survey-chart` kinds:
 *
 *   climate-belief-trends — three-line series across 2009 → 2024 showing
 *                           the share who agree climate change is real,
 *                           is human-caused, and they are deeply
 *                           concerned about it. The chapter's punchline
 *                           is the gap between "real" and "cause".
 *   regional-concern       — horizontal lollipop ranking 10 of the 16
 *                           regional councils (those in the extract) by
 *                           share concerned about climate change in the
 *                           latest wave. No longer mounted on the page
 *                           (removed at launch: it covered 10 of 16
 *                           regions and the ranking changes with all 16).
 *   quake-anxiety-regions  — time series, Canterbury vs Wellington vs
 *                           rest of NZ (which includes Wellington), share
 *                           who worried "some of the time" or more in the
 *                           past month that a big earthquake might hit
 *                           their region. Rises in the waves spanning the
 *                           2016 Kaikoura earthquake and the March 2021
 *                           Kermadec and East Cape earthquakes (wave
 *                           labelled 2020). Waves with fewer than 1,000
 *                           respondents nationally are dropped (T15, 2023).
 *   env-satisfaction-eth   — small horizontal lollipop, mean
 *                           satisfaction with the quality of NZ's
 *                           natural environment in the latest wave,
 *                           by ethnicity.
 *
 * No external dependencies — pure inline SVG, same palette tokens as
 * the rest of the atlas.
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

// Force signatures from palette.js. Each chart uses one of these as its
// dominant colour, keyed to the chapter the chart will live in.
const C = {
  fire:   PALETTE.fire,    // ch3 / ch6 — volcanism
  quake:  PALETTE.quake,   // ch2 — tectonics
  carbon: PALETTE.carbon,  // ch8 — CO₂
  ozone:  PALETTE.ozone,   // ch9 — UV / ozone
  heat:   PALETTE.heat,    // ch11 — warming
  ocean:  PALETTE.ocean    // ch12 — futures / sea level
};

// Pākehā / Māori / Pacific / Asian — only used by the ethnicity lollipop.
// Borrowed from the sociodynamics palette (kokowai / pounamu / coral /
// violet). Repeated here so we don't have to take a cross-atlas import.
const ETH_COLOR = {
  nz_european: '#a8442d',  // kokowai
  maori:       '#2d6e4d',  // pounamu
  pacific:     '#cc5e3f',  // coral
  asian:       '#6b3a82'   // violet
};
const ETH_LABEL = {
  nz_european: 'Pākehā',
  maori:       'Māori',
  pacific:     'Pacific',
  asian:       'Asian'
};

// Stats NZ regional-council keys → display label. Keys must match the
// `region_*` group keys written by extract_atlas_stats.R.
const REGION_LABEL = {
  region_canterbury:    'Canterbury',
  region_wellington:    'Wellington',
  region_auckland:      'Auckland',
  region_bay_of_plenty: 'Bay of Plenty',
  region_waikato:       'Waikato',
  region_otago:         'Otago',
  region_northland:     'Northland',
  region_hawkes_bay:    'Hawke’s Bay',
  region_gisborne:      'Gisborne',
  region_west_coast:    'West Coast',
  region_tvz:           'Taupō Volcanic Zone'
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

function caption(parent, x, y, t, anchor) {
  const node = text(parent, {
    x, y,
    'font-family': 'IBM Plex Mono, monospace',
    'font-size': 10,
    fill: INK_FAINT
  }, t);
  if (anchor) node.setAttribute('text-anchor', anchor);
  return node;
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

function latestYear(json, item, group) {
  const s = seriesFor(json, item, group);
  if (!s) return null;
  let max = -Infinity;
  for (const r of s) if (r.pct_agree != null && r.year > max) max = r.year;
  return Number.isFinite(max) ? max : null;
}

// ---- 1. Climate-belief trend lines -----------------------------------
//
// Three lines: ClimateChgReal, ClimateChgCause, ClimateChgConcern.
// The story is the persistent gap between "is real" and "is caused by
// humans" — a country that broadly accepts the phenomenon but trails on
// attribution.
function renderClimateBeliefTrends(container, json) {
  const items = [
    { item: 'Env.ClimateChgReal',    label: 'IS REAL',          color: C.carbon },
    { item: 'Env.ClimateChgCause',   label: 'HUMAN-CAUSED',     color: C.heat },
    { item: 'Env.ClimateChgConcern', label: 'DEEPLY CONCERNED', color: C.ozone }
  ];
  const group = container.dataset.group || 'all';

  const lines = items.map(o => {
    const s = seriesFor(json, o.item, group) || [];
    return {
      ...o,
      points: s.filter(r => r.pct_agree != null)
               .map(r => ({ x: r.year, y: r.pct_agree }))
               .sort((a, b) => a.x - b.x)
    };
  }).filter(l => l.points.length > 0);

  if (lines.length === 0) return;

  const W = 720, H = 420;
  const M = { l: 56, t: 112, r: 160, b: 56 };

  const allYears = lines.flatMap(l => l.points.map(p => p.x));
  const xMin = Math.min(...allYears), xMax = Math.max(...allYears);
  const yMin = 0.4, yMax = 1.0;

  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);
  const yScale = v => M.t + (H - M.t - M.b) * (1 - (v - yMin) / (yMax - yMin));

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, `Climate beliefs · ${xMin} → ${xMax}`);
  title(svg, M.l, 50, 'Belief that climate change is real peaked before 2020 and has eased since');
  caption(svg, M.l, 68, 'Share of survey respondents who agree (5 or more on a 1–7 scale).');

  // Y gridlines + labels
  for (let v = 0.4; v <= 1.0001; v += 0.1) {
    const y = yScale(v);
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: W - M.r, y2: y,
      stroke: RULE, 'stroke-width': 0.5
    }));
    caption(svg, M.l - 8, y + 3, `${Math.round(v * 100)}%`, 'end');
  }

  // X ticks (5-year markers, plus endpoints)
  const xTicks = new Set([xMin, xMax]);
  for (let y = Math.ceil(xMin / 5) * 5; y <= xMax; y += 5) {
    // skip a 5-year marker that would crowd an endpoint label
    if (y - xMin >= 3 && xMax - y >= 3) xTicks.add(y);
  }
  Array.from(xTicks).sort((a, b) => a - b).forEach(yr => {
    const x = xScale(yr);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b, x2: x, y2: H - M.b + 4, stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, String(yr), 'middle');
  });

  // Lines
  lines.forEach(l => {
    const path = l.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`)
      .join(' ');
    svg.appendChild(el('path', {
      d: path, fill: 'none', stroke: l.color,
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
  });

  // End-of-line labels (stacked, with collision avoidance)
  const ends = lines.map(l => ({
    label: l.label, color: l.color,
    x: xScale(l.points[l.points.length - 1].x),
    yTarget: yScale(l.points[l.points.length - 1].y),
    value: l.points[l.points.length - 1].y
  }));
  ends.sort((a, b) => a.yTarget - b.yTarget);
  const MIN_GAP = 16;
  ends.forEach((e, i) => {
    if (i === 0) { e.y = e.yTarget; return; }
    e.y = Math.max(e.yTarget, ends[i - 1].y + MIN_GAP);
  });
  ends.forEach(e => {
    text(svg, {
      x: e.x + 8, y: e.y + 2,
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1,
      fill: e.color
    }, e.label);
    text(svg, {
      x: e.x + 8, y: e.y + 16,
      'font-family': 'Fraunces, Georgia, serif',
      'font-weight': 600, 'font-size': 12,
      fill: e.color
    }, `${Math.round(e.value * 100)}%`);
  });

  caption(svg, M.l, H - 16, `Source: NZAVS, unweighted, waves ${xMin}–${String(xMin + 1).slice(2)} to ${xMax}–${String(xMax + 1).slice(2)}. Years mark the start of each wave.`);
}

// ---- 2. Regional concern lollipop ------------------------------------
//
// Horizontal lollipop. One row per Stats NZ regional council, ordered by
// share concerned about climate change in the latest wave. National
// average is a dashed reference line.
function renderRegionalConcern(container, json) {
  const item = container.dataset.item || 'Env.ClimateChgConcern';
  const year = Number(container.dataset.year || latestYear(json, item, 'all'));
  if (!year) return;

  const regionKeys = [
    'region_wellington', 'region_auckland', 'region_otago',
    'region_hawkes_bay', 'region_canterbury', 'region_bay_of_plenty',
    'region_northland', 'region_waikato', 'region_west_coast',
    'region_gisborne'
  ];
  const data = regionKeys.map(k => {
    const row = rowFor(json, item, k, year);
    return row ? { key: k, label: REGION_LABEL[k] || k,
                   value: row.pct_agree, n: row.n } : null;
  }).filter(d => d && d.value != null);
  data.sort((a, b) => b.value - a.value);

  const nationalRow = rowFor(json, item, 'all', year);
  const national = nationalRow ? nationalRow.pct_agree : null;

  const W = 720, H = 460;
  const M = { l: 160, t: 112, r: 64, b: 88 };
  const rowH = (H - M.t - M.b) / data.length;

  const vals = data.map(d => d.value);
  const xMin = Math.min(0.55, Math.floor(Math.min(...vals) * 20) / 20);
  const xMax = Math.max(0.80, Math.ceil(Math.max(...vals) * 20) / 20);
  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, `Climate concern by region · ${year}`);
  title(svg, M.l, 50, 'Where the worry sits');
  caption(svg, M.l, 68,
          'Share of survey respondents who agree they are deeply concerned about climate change.');

  // National-average reference line — runs only behind the data rows.
  if (national != null) {
    const ax = xScale(national);
    svg.appendChild(el('line', {
      x1: ax, y1: M.t, x2: ax, y2: H - M.b,
      stroke: INK_FAINT, 'stroke-width': 1, 'stroke-dasharray': '3 3'
    }));
    caption(svg, ax, H - M.b + 30,
            `NATIONAL ${Math.round(national * 100)}%`, 'middle');
  }

  // Axis ticks
  for (let v = xMin; v <= xMax + 1e-6; v += 0.05) {
    const x = xScale(v);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b, x2: x, y2: H - M.b + 4, stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, `${Math.round(v * 100)}%`, 'middle');
  }
  svg.appendChild(el('line', {
    x1: M.l, y1: H - M.b, x2: W - M.r, y2: H - M.b, stroke: RULE
  }));

  data.forEach((d, i) => {
    const y = M.t + rowH * (i + 0.5);
    const x = xScale(d.value);
    // Region label
    text(svg, {
      x: M.l - 12, y: y + 4,
      'text-anchor': 'end',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1, fill: INK_SOFT
    }, d.label.toUpperCase());
    // Stem
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: x, y2: y,
      stroke: RULE, 'stroke-width': 1
    }));
    // Dot — colour by how far from national
    const above = national != null && d.value > national;
    const fill  = above ? C.heat : d.value < (national || 0) - 0.05
                                   ? C.ocean : INK_SOFT;
    svg.appendChild(el('circle', {
      cx: x, cy: y, r: 5,
      fill, stroke: PAPER, 'stroke-width': 1.5
    }));
    // Value
    text(svg, {
      x: x + 12, y: y + 4,
      'font-family': 'Fraunces, Georgia, serif',
      'font-weight': 600, 'font-size': 13, fill: INK
    }, `${Math.round(d.value * 100)}%`);
  });

  caption(svg, M.l, H - 16,
          `Source: NZAVS, unweighted, wave starting ${year}. Ten of sixteen regions.`);
}

// ---- 3. Quake-anxiety regional time-series ---------------------------
//
// Three lines — Canterbury, Wellington, rest-of-NZ — for the share who
// worry "sometimes" or more often that a big earthquake will hit their
// region. Earthquake.Anxiety is on a 0–4 frequency scale; the threshold
// `≥ 2 = at least sometimes` is set in extract_atlas_stats.R.
function renderQuakeAnxietyRegions(container, json) {
  const groups = [
    { key: 'region_canterbury',           label: 'CANTERBURY', color: C.quake },
    { key: 'region_wellington',           label: 'WELLINGTON', color: C.fire  },
    { key: 'region_outside_canterbury',   label: 'REST OF NZ', color: INK_FAINT }
  ];

  // Drop waves where the item barely ran (T15, 2023: 347 respondents in all).
  const MIN_N = 1000;
  const national = seriesFor(json, 'Earthquake.Anxiety', 'all') || [];
  const keepYear = new Set(national.filter(r => r.n >= MIN_N).map(r => r.year));

  const lines = groups.map(g => {
    const s = seriesFor(json, 'Earthquake.Anxiety', g.key) || [];
    return {
      ...g,
      points: s.filter(r => r.pct_agree != null && keepYear.has(r.year))
               .map(r => ({ x: r.year, y: r.pct_agree }))
               .sort((a, b) => a.x - b.x)
    };
  }).filter(l => l.points.length > 0);

  if (lines.length === 0) return;

  const W = 720, H = 400;
  const M = { l: 56, t: 112, r: 132, b: 56 };

  const allYears = lines.flatMap(l => l.points.map(p => p.x));
  const xMin = Math.min(...allYears), xMax = Math.max(...allYears);
  const allVals = lines.flatMap(l => l.points.map(p => p.y));
  const yMin = 0.0;
  const yMax = Math.max(0.35, Math.ceil(Math.max(...allVals) * 20) / 20);

  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);
  const yScale = v => M.t + (H - M.t - M.b) * (1 - (v - yMin) / (yMax - yMin));

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, `Earthquake worry by region · ${xMin} → ${xMax}`);
  title(svg, M.l, 50, 'Earthquake worry in Canterbury has more than halved since 2012');
  caption(svg, M.l, 68,
          'Share of survey respondents who worried at least some of the time in the past month');
  caption(svg, M.l, 82, 'that a big earthquake might hit their region.');

  // Y gridlines + labels
  for (let v = 0; v <= yMax + 1e-6; v += 0.1) {
    const y = yScale(v);
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: W - M.r, y2: y,
      stroke: RULE, 'stroke-width': 0.5
    }));
    caption(svg, M.l - 8, y + 3, `${Math.round(v * 100)}%`, 'end');
  }

  // X ticks (every 2 years)
  for (let y = xMin; y <= xMax; y += 2) {
    const x = xScale(y);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b, x2: x, y2: H - M.b + 4, stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, String(y), 'middle');
  }

  // Lines
  lines.forEach(l => {
    const path = l.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`)
      .join(' ');
    svg.appendChild(el('path', {
      d: path, fill: 'none', stroke: l.color,
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
  });

  // End-of-line labels — colour-matched, stacked to avoid overlap.
  const ends = lines.map(l => ({
    label: l.label, color: l.color,
    x: xScale(l.points[l.points.length - 1].x),
    yTarget: yScale(l.points[l.points.length - 1].y),
    value: l.points[l.points.length - 1].y
  }));
  ends.sort((a, b) => a.yTarget - b.yTarget);
  // Each label is a two-line stack (name + value), so the gap has to
  // clear ~28 px to keep adjacent labels from running into each other.
  const MIN_GAP = 28;
  ends.forEach((e, i) => {
    if (i === 0) { e.y = e.yTarget; return; }
    e.y = Math.max(e.yTarget, ends[i - 1].y + MIN_GAP);
  });
  ends.forEach(e => {
    text(svg, {
      x: e.x + 8, y: e.y + 2,
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1, fill: e.color
    }, e.label);
    text(svg, {
      x: e.x + 8, y: e.y + 16,
      'font-family': 'Fraunces, Georgia, serif',
      'font-weight': 600, 'font-size': 12, fill: e.color
    }, `${Math.round(e.value * 100)}%`);
  });

  caption(svg, M.l, H - 16, `Source: NZAVS, unweighted, waves ${xMin}–${String(xMin + 1).slice(2)} to ${xMax}–${String(xMax + 1).slice(2)}. Rest of NZ includes Wellington.`);
}

// ---- 4. Environment satisfaction by ethnicity ------------------------
//
// Small horizontal lollipop, 4 rows. Mean Env.SatNZEnvironment in the
// latest wave by ethnicity. Useful for the futures chapter as the
// "do New Zealanders think things are getting worse?" baseline.
function renderEnvSatisfactionEth(container, json) {
  const item = container.dataset.item || 'Env.SatNZEnvironment';
  const year = Number(container.dataset.year || latestYear(json, item, 'all'));
  if (!year) return;

  const groups = ['nz_european', 'maori', 'pacific', 'asian'];
  const data = groups.map(g => {
    const row = rowFor(json, item, g, year);
    return row && row.mean != null
      ? { key: g, label: ETH_LABEL[g], value: row.mean, n: row.n,
          color: ETH_COLOR[g] }
      : null;
  }).filter(Boolean);
  data.sort((a, b) => b.value - a.value);

  const allRow = rowFor(json, item, 'all', year);
  const national = allRow ? allRow.mean : null;

  const W = 640, H = 320;
  const M = { l: 130, t: 104, r: 64, b: 80 };
  const rowH = (H - M.t - M.b) / data.length;

  // X-axis: snap to the actual data range with a little headroom on
  // either side, so the data set the bounds. The item is scored 0–10.
  const vals = data.map(d => d.value).concat(national != null ? [national] : []);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const xMin = Math.floor(Math.min(dataMin - 0.3, 4.5) * 2) / 2;  // step 0.5
  const xMax = Math.ceil(Math.max(dataMax + 0.3, 6.0) * 2) / 2;
  const xScale = v => M.l + (W - M.l - M.r) * (v - xMin) / (xMax - xMin);

  const svg = svgRoot(`0 0 ${W} ${H}`);
  container.innerHTML = '';
  container.appendChild(svg);

  overline(svg, M.l, 24, `Satisfaction with the environment · ${year}–${String(year + 1).slice(2)}`);
  title(svg, M.l, 50, 'Asian respondents rate it highest, Māori lowest');
  caption(svg, M.l, 68,
          'Mean satisfaction with New Zealand\'s natural environment, on a zero-to-ten scale.');

  if (national != null) {
    const ax = xScale(national);
    svg.appendChild(el('line', {
      x1: ax, y1: M.t, x2: ax, y2: H - M.b,
      stroke: INK_FAINT, 'stroke-width': 1, 'stroke-dasharray': '3 3'
    }));
    caption(svg, ax, H - M.b + 28,
            `ALL ${national.toFixed(2)}`, 'middle');
  }

  // Axis
  for (let v = xMin; v <= xMax + 1e-6; v += 0.5) {
    const x = xScale(v);
    svg.appendChild(el('line', {
      x1: x, y1: H - M.b, x2: x, y2: H - M.b + 4, stroke: RULE
    }));
    caption(svg, x, H - M.b + 16, v.toFixed(1), 'middle');
  }
  svg.appendChild(el('line', {
    x1: M.l, y1: H - M.b, x2: W - M.r, y2: H - M.b, stroke: RULE
  }));

  data.forEach((d, i) => {
    const y = M.t + rowH * (i + 0.5);
    const x = xScale(d.value);
    text(svg, {
      x: M.l - 12, y: y + 4,
      'text-anchor': 'end',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, 'letter-spacing': 1, fill: d.color
    }, d.label.toUpperCase());
    svg.appendChild(el('line', {
      x1: M.l, y1: y, x2: x, y2: y, stroke: RULE, 'stroke-width': 1
    }));
    svg.appendChild(el('circle', {
      cx: x, cy: y, r: 5,
      fill: d.color, stroke: PAPER, 'stroke-width': 1.5
    }));
    text(svg, {
      x: x + 12, y: y + 4,
      'font-family': 'Fraunces, Georgia, serif',
      'font-weight': 600, 'font-size': 13, fill: INK
    }, d.value.toFixed(2));
  });

  caption(svg, M.l, H - 16, `Source: NZAVS, unweighted, wave ${year}–${String(year + 1).slice(2)}. Pākehā is the survey's NZ European group.`);
}

// ---- Mount -----------------------------------------------------------

const RENDERERS = {
  'climate-belief-trends':  renderClimateBeliefTrends,
  'regional-concern':       renderRegionalConcern,
  'quake-anxiety-regions':  renderQuakeAnxietyRegions,
  'env-satisfaction-eth':   renderEnvSatisfactionEth
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
