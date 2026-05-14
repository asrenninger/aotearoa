/**
 * Chapter 12 — Trans-Tasman migration time series.
 *
 * Renders a quarterly time series of net NZ↔Australia migration from
 * data/nz-au-migration-quarterly.csv. Data sources: Stats NZ for the
 * AU → NZ arrivals side, ABS (Australian Bureau of Statistics) for the
 * NZ → AU departures side — Australia's count of NZ-citizen arrivals
 * into Australia is the cleanest measurement of the NZ → AU flow,
 * since Stats NZ doesn't publish departures by next-residence country
 * at this granularity.
 *
 * The line plots a 4-quarter trailing rolling average of net flow —
 * that removes the seasonal quarterly oscillation so the trend reads
 * as one continuous arc. Annotations land on the smoothed line.
 */

import { el } from '../core/svg.js';

const PALETTE = {
  ink:      '#1d1610',
  inkSoft:  '#4a3d2e',
  inkFaint: '#8a7659',
  paper:    '#f3ecdd',
  rule:     '#c9b894',
  outbound: '#2c6479',  // sea-clay — net loss to AU
  inbound:  '#a8442d'   // kokowai — net inflow from AU
};

const W = 800, H = 410;
const PLOT = { x: 64, y: 80, w: W - 64 - 24, h: 220 };

const scale = (dMin, dMax, rMin, rMax) => v =>
  rMin + (rMax - rMin) * (v - dMin) / (dMax - dMin);

function quarterToYearFrac(q) {
  const [y, qStr] = q.split('-Q');
  return parseInt(y, 10) + (parseInt(qStr, 10) - 1) * 0.25;
}

function text(parent, attrs, content) {
  const n = el('text', attrs);
  n.textContent = content;
  parent.appendChild(n);
  return n;
}

/** 4-quarter trailing rolling average — smooths the strong quarterly
 *  seasonality (Q1 arrivals are always a dip, Q4 always a peak). */
function rollingAvg(values, window) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

async function loadData() {
  const r = await fetch('./data/nz-au-migration-quarterly.csv');
  const csv = await r.text();
  const lines = csv.trim().split('\n');
  const header = lines.shift().split(',');
  return lines.map(line => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => row[h] = cells[i]);
    row.year = quarterToYearFrac(row.quarter);
    row.net  = parseFloat(row.net_au_nz);
    return row;
  });
}

/** FT-style arced leader: quadratic Bezier from (sx, sy) to (ex, ey),
 *  with control at (ex, sy). The curve starts horizontal at the label
 *  end and ends vertical at the dot end — a clean quarter-circle arc.
 *  The dot end is pulled in by `gap` so it doesn't overlap the marker. */
function arcLeader(sx, sy, ex, ey, gap = 5) {
  const eyAdj = ey > sy ? ey - gap : ey + gap;
  return `M ${sx} ${sy} Q ${ex} ${sy}, ${ex} ${eyAdj}`;
}

export async function render() {
  const svg = document.getElementById('trans-tasman');
  if (!svg) return;

  let data;
  try { data = await loadData(); }
  catch (err) { console.warn('ch12-trans-tasman: data load failed', err); return; }

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // 4Q trailing rolling average. Each point is the average per-quarter
  // net for the trailing year, so seasonal noise drops out.
  const netSmooth = rollingAvg(data.map(d => d.net), 4);

  const x = scale(2003.75, 2025.25, PLOT.x, PLOT.x + PLOT.w);
  const yMin = -14000, yMax = 6000;
  const y = scale(yMin, yMax, PLOT.y + PLOT.h, PLOT.y);
  const y0 = y(0);

  // -------- Header --------
  text(svg, { class: 'map-label', x: 0, y: 16, fill: PALETTE.inkFaint },
       'Trans-Tasman net migration · quarterly · 2003–2025');
  text(svg, {
    x: 0, y: 46,
    'font-family': 'Fraunces', 'font-style': 'italic', 'font-weight': 400, 'font-size': 22, fill: PALETTE.ink
  }, 'Twenty-two years of Kiwis heading west');

  // Stock callout — ABS Estimated Resident Population, NZ-born in
  // Australia, as at 30 June 2025. This is the actual quantity the
  // flow series points at; cumulating 22 years of net flow would drift
  // from this number because the two source agencies (Stats NZ, ABS)
  // use asymmetric long-term thresholds and don't capture Kiwis who
  // arrive in Australia from third countries.
  const statG = el('g', { transform: `translate(${W}, 24)` });
  svg.appendChild(statG);
  text(statG, { x: 0, y: 0, 'text-anchor': 'end', 'font-family': 'Fraunces', 'font-weight': 600, 'font-size': 32, fill: PALETTE.ink }, '637,680');
  text(statG, { x: 0, y: 20, 'text-anchor': 'end', 'font-family': 'IBM Plex Mono', 'font-size': 9, 'letter-spacing': 1.5, fill: PALETTE.inkFaint },
       'NEW ZEALANDERS IN AUSTRALIA');

  // -------- Gridlines + y-axis labels --------
  const yTicks = [-12000, -6000, 0, 6000];
  const gridG = el('g');
  svg.appendChild(gridG);
  for (const v of yTicks) {
    const yy = y(v);
    gridG.appendChild(el('line', {
      x1: PLOT.x, y1: yy, x2: PLOT.x + PLOT.w, y2: yy,
      stroke: v === 0 ? PALETTE.ink : PALETTE.rule,
      'stroke-width': v === 0 ? 0.9 : 0.5,
      'stroke-dasharray': v === 0 ? '' : '2 3',
      opacity: v === 0 ? 1 : 0.55
    }));
    text(gridG, {
      x: PLOT.x - 8, y: yy + 3, 'text-anchor': 'end',
      'font-family': 'IBM Plex Mono', 'font-size': 9, 'letter-spacing': 1.5, fill: PALETTE.inkFaint
    }, v === 0 ? '0' : (v / 1000) + 'k');
  }
  text(gridG, {
    x: PLOT.x - 8, y: PLOT.y - 6, 'text-anchor': 'end',
    'font-family': 'IBM Plex Mono', 'font-size': 8, 'letter-spacing': 1.5, fill: PALETTE.inkFaint
  }, 'PER QUARTER');

  // -------- Diverging filled areas (from smoothed values) --------
  function diverging(side) {
    const top = data.map((d, i) => {
      const py = y(netSmooth[i]);
      return [x(d.year), side === 'above' ? Math.min(py, y0) : Math.max(py, y0)];
    });
    const head = `M ${top[0][0]} ${y0}`;
    const body = top.map(p => `L ${p[0]} ${p[1]}`).join(' ');
    const tail = `L ${top[top.length - 1][0]} ${y0} Z`;
    return `${head} ${body} ${tail}`;
  }
  svg.appendChild(el('path', { d: diverging('below'), fill: PALETTE.outbound, 'fill-opacity': 0.22, stroke: 'none' }));
  svg.appendChild(el('path', { d: diverging('above'), fill: PALETTE.inbound,  'fill-opacity': 0.32, stroke: 'none' }));

  // -------- Smoothed net line --------
  const lineD = data.map((d, i) =>
    (i === 0 ? 'M' : 'L') + ' ' + x(d.year).toFixed(1) + ' ' + y(netSmooth[i]).toFixed(1)
  ).join(' ');
  svg.appendChild(el('path', {
    d: lineD, fill: 'none',
    stroke: PALETTE.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
  }));

  // -------- X-axis year labels --------
  const xTicks = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
  const xG = el('g');
  svg.appendChild(xG);
  for (const yr of xTicks) {
    const xx = x(yr);
    xG.appendChild(el('line', { x1: xx, y1: PLOT.y + PLOT.h, x2: xx, y2: PLOT.y + PLOT.h + 4, stroke: PALETTE.inkFaint, 'stroke-width': 0.5 }));
    text(xG, {
      x: xx, y: PLOT.y + PLOT.h + 18, 'text-anchor': 'middle',
      'font-family': 'IBM Plex Mono', 'font-size': 9, 'letter-spacing': 1.5, fill: PALETTE.inkFaint
    }, yr);
  }

  // -------- Annotations --------
  // FT-style: a small marker on the smoothed line + a curved leader to a
  // serif-italic label. Mining-boom + cost-of-living labels live in the
  // bottom row (below the x-axis ticks); the COVID label sits in the
  // top margin above the spike. The dot for each annotation is placed
  // on the smoothed value at that quarter — not the raw quarter spike —
  // so the marker visually sits on the rendered line.
  const idxOf = q => data.findIndex(d => d.quarter === q);
  const ANNOTATIONS = [
    { idx: idxOf('2012-Q1'), label: 'Mining boom',                          where: 'bottom', lx: x(2010.0) },
    { idx: idxOf('2020-Q3'), label: 'Kiwis came home during the pandemic',  where: 'top',    lx: x(2017.5) },
    { idx: idxOf('2025-Q1'), label: 'Cost-of-living crisis',                where: 'bottom', lx: x(2022.0) }
  ];
  const bottomY = PLOT.y + PLOT.h + 38;   // below x-tick labels
  const topY    = PLOT.y - 14;            // above plot top
  const aG = el('g');
  svg.appendChild(aG);
  for (const a of ANNOTATIONS) {
    const dotX = x(data[a.idx].year);
    const dotY = y(netSmooth[a.idx]);
    const ly   = a.where === 'bottom' ? bottomY : topY;
    const labelGap = 6;  // gap between label text and where the leader starts

    // Marker dot (on the smoothed line)
    aG.appendChild(el('circle', {
      cx: dotX, cy: dotY, r: 3.4,
      fill: PALETTE.ink, stroke: PALETTE.paper, 'stroke-width': 1.4
    }));

    // Curved leader. Start point sits just above (bottom labels) or
    // just below (top label) the label text; end point lands at the dot.
    const sy = a.where === 'bottom' ? ly - labelGap - 6 : ly + labelGap;
    aG.appendChild(el('path', {
      d: arcLeader(a.lx, sy, dotX, dotY),
      fill: 'none',
      stroke: PALETTE.inkSoft, 'stroke-width': 0.9, 'stroke-linecap': 'round',
      opacity: 0.75
    }));

    // Label — serif italic, editorial register
    text(aG, {
      x: a.lx, y: ly,
      'text-anchor': 'middle',
      'font-family': 'Source Serif 4', 'font-style': 'italic',
      'font-size': 12, fill: PALETTE.ink
    }, a.label);
  }

  // -------- Caption + sources --------
  const capY = bottomY + 16;
  svg.appendChild(el('line', { x1: 0, y1: capY, x2: W, y2: capY, stroke: PALETTE.rule, 'stroke-width': 0.5 }));
  text(svg, { class: 'map-label', x: 0, y: capY + 16, fill: PALETTE.inkFaint },
       'Sources: Statistics New Zealand (arrivals); Australian Bureau of Statistics (departures + resident population).');
}
