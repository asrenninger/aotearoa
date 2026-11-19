/**
 * Survey-facts sprinkle (inline-span variant).
 *
 * Reads `data/survey/atlas_stats.json` once and fills each
 * `[data-fact-item]` element with a single value from the NZAVS extract.
 * Designed for inline prose:
 *
 *   In 2024, <span data-fact-item="HistNeg01"
 *                  data-fact-year="2024"
 *                  data-fact-stat="pct_agree">—</span>
 *   of New Zealanders agreed that…
 *
 * Supported stats:
 *
 *   mean         — the mean (1–7 Likert or hours/week as recorded)
 *   mean_unreversed — 8 − mean, for items stored reverse scored on a
 *                  1–7 scale (names ending `r`), so the value reads in
 *                  the direction of the statement as worded
 *   pct_agree    — share scoring ≥5 on a 1–7 scale, as a percent
 *   pct_disagree — 1 − pct_agree, as a percent
 *   n            — respondent count for the wave
 *
 * Comparison stats (need both data-fact-year and data-fact-from-year):
 *
 *   delta              — (to − from) for the chosen stat (`data-fact-base`)
 *   ratio-vs-group     — ratio against another group on `data-fact-base`;
 *                        target group given via data-fact-vs-group
 *
 * Group is `data-fact-group` (defaults to `all`); options:
 *   all · nz_european · maori · pacific · asian · outgroup
 *
 * Optional `data-fact-dp` sets the decimal places for a mean.
 *
 * The element's existing text is used as a fallback if the lookup fails.
 */

const DATA_URL = './data/survey/atlas_stats.json';

let dataPromise = null;
function fetchOnce() {
  if (!dataPromise) {
    dataPromise = fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(`survey-facts: ${r.status}`);
      return r.json();
    });
  }
  return dataPromise;
}

function findGroups(json, itemName) {
  const entry = json[itemName];
  return entry ? entry.groups : null;
}

function pickWaveByYear(series, year) {
  if (!year || !series) return null;
  const target = Number(year);
  let best = null, bestDist = Infinity;
  for (const row of series) {
    if (row.year === target) return row;
    const d = Math.abs(row.year - target);
    if (d < bestDist) { bestDist = d; best = row; }
  }
  return best;
}

function pickWaveByLabel(series, wave) {
  if (!wave || !series) return null;
  return series.find(r => r.wave === wave) || null;
}

function statValue(row, stat) {
  if (!row) return null;
  switch (stat) {
    case 'mean':         return row.mean;
    case 'mean_unreversed': return row.mean == null ? null : 8 - row.mean;
    case 'pct_agree':    return row.pct_agree;
    case 'pct_disagree': return row.pct_agree == null ? null : 1 - row.pct_agree;
    case 'n':            return row.n;
    default:             return null;
  }
}

function fmt(stat, value, dp) {
  if (value == null || Number.isNaN(value)) return null;
  if (dp != null && dp !== '' && !Number.isNaN(Number(dp))) {
    return value.toFixed(Number(dp));
  }
  if (stat === 'pct_agree' || stat === 'pct_disagree') {
    return `${Math.round(value * 100)}%`;
  }
  if (stat === 'n') {
    return value.toLocaleString();
  }
  // mean — 1-7 Likert or hours
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function fmtDelta(stat, from, to) {
  if (from == null || to == null) return null;
  const d = to - from;
  if (stat === 'pct_agree' || stat === 'pct_disagree') {
    const pp = Math.round(d * 100);
    return `${pp > 0 ? '+' : ''}${pp} pp`;
  }
  return `${d > 0 ? '+' : ''}${d.toFixed(2)}`;
}

function fmtRatio(num, den) {
  if (num == null || den == null || den === 0) return null;
  const r = num / den;
  return `${r.toFixed(2)}×`;
}

function resolve(json, el) {
  const item = el.dataset.factItem;
  if (!item) return null;
  const groups = findGroups(json, item);
  if (!groups) { console.warn('survey-facts: unknown item', item); return null; }

  const stat  = el.dataset.factStat || 'mean';
  const group = el.dataset.factGroup || 'all';
  const series = groups[group];
  if (!series) {
    console.warn(`survey-facts: no group "${group}" for`, item);
    return null;
  }

  const wave    = el.dataset.factWave;
  const year    = el.dataset.factYear;
  const fromYear = el.dataset.factFromYear;

  // ---- Composite stats (need two anchors) -----------------------------
  if (stat === 'delta') {
    const base = el.dataset.factBase || 'mean';
    const fromRow = pickWaveByYear(series, fromYear);
    const toRow   = wave ? pickWaveByLabel(series, wave)
                         : pickWaveByYear(series, year);
    return fmtDelta(base, statValue(fromRow, base), statValue(toRow, base));
  }
  if (stat === 'ratio-vs-group') {
    const base = el.dataset.factBase || 'pct_disagree';
    const vs   = el.dataset.factVsGroup || 'nz_european';
    const vsSeries = groups[vs];
    if (!vsSeries) return null;
    const numRow = pickWaveByYear(series, year);
    const denRow = pickWaveByYear(vsSeries, year);
    return fmtRatio(statValue(numRow, base), statValue(denRow, base));
  }

  // ---- Single-value lookup --------------------------------------------
  const row = wave ? pickWaveByLabel(series, wave)
                   : pickWaveByYear(series, year);
  return fmt(stat, statValue(row, stat), el.dataset.factDp);
}

/** Fill any `[data-fact-item]` spans on the page. */
export async function mountSurveyFacts(root = document) {
  const els = root.querySelectorAll('[data-fact-item]');
  if (!els.length) return;
  try {
    const json = await fetchOnce();
    els.forEach(el => {
      const value = resolve(json, el);
      if (value != null) el.textContent = value;
    });
  } catch (err) {
    console.error('survey-facts: failed to load', err);
  }
}
