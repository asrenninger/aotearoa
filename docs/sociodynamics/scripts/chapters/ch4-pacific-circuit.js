/**
 * Chapter 4 — The Pacific gold-rush circuit.
 *
 * Globe projection over the Pacific. The chapter is structured as a network:
 * origins (Cornwall, Guangdong) feed way-stations (California, Victoria,
 * Hong Kong) that feed NZ fields (Otago, West Coast). Step 2 swaps the map
 * for an SVG network overlay that flattens the geography into a Sankey-like
 * three-column flow; the population-growth inset (steps 3–5) fills in
 * progressively as each rush peak is reached.
 */

import { PALETTE } from '../core/palette.js';
import { makePaperStyle, applyPaperFog } from '../core/mapbox-style.js';
import { pointFC, arcFC } from '../core/mapbox-helpers.js';
import { el } from '../core/svg.js';

// ---------------------------------------------------------------------------
// Population-growth inset chart — rendered once at page load. Step actions
// below progressively reveal bars + milestones via the data-fill attribute.
// ---------------------------------------------------------------------------

/** NZ non-Māori population by census, 1858–1881 (thousands). Census figures
 *  from Stats NZ historical series. The rush spans roughly the four central
 *  bars (1861–1871) — the decade in which population jumped from ~99k to ~256k. */
const POP_DATA = [
  { year: 1858, value:  59 },
  { year: 1861, value:  99 },
  { year: 1864, value: 172 },
  { year: 1867, value: 218 },
  { year: 1871, value: 256 },
  { year: 1874, value: 300 },
  { year: 1878, value: 414 },
  { year: 1881, value: 490 }
];

function renderPopBars() {
  const c = document.getElementById('ch4-pop-bars');
  if (!c) return;
  const max = 500;            // thousands; gives headroom above 490
  const chartH = 130;
  const barW = 32, gap = 8;
  // Y-grid + tick labels (every 100k)
  for (let v = 0; v <= max; v += 100) {
    const y = chartH - (v / max) * chartH;
    c.appendChild(el('line', {
      x1: 0, y1: y, x2: 8 * (barW + gap) - gap, y2: y,
      stroke: '#c9b894', 'stroke-width': 0.4, 'stroke-dasharray': '2 3'
    }));
    if (v === 0 || v === 200 || v === 400) {
      const t = el('text', {
        x: -4, y: y + 3, 'text-anchor': 'end',
        'font-family': 'IBM Plex Mono', 'font-size': 8, fill: '#8a7659'
      });
      t.textContent = v + 'k';
      c.appendChild(t);
    }
  }
  POP_DATA.forEach((d, i) => {
    const barH = (d.value / max) * chartH;
    const x = i * (barW + gap);
    const y = chartH - barH;
    // Single colour for all bars — the chapter's gold signature. The
    // progressive scaleY reveal and the step-annotation strip beneath
    // already do the year-specific highlighting; an extra "rush-peak"
    // colour without a legend just reads as unexplained emphasis.
    c.appendChild(el('rect', {
      x, y,
      width: barW, height: barH,
      fill: '#c9882a',
      'data-year': d.year, class: 'bar'
    }));
    const yearTxt = el('text', {
      x: x + barW / 2, y: chartH + 14,
      'text-anchor': 'middle',
      'font-family': 'IBM Plex Mono', 'font-size': 9, fill: '#8a7659'
    });
    yearTxt.textContent = d.year;
    c.appendChild(yearTxt);
  });
}

export function render() {
  renderPopBars();
}

// NZ + Pacific-Rim fields (filled gold dots).
const FIELDS = [
  { id: 'california', name: 'CALIFORNIA · 1848', coords: [-121.5,  38.5] },
  { id: 'victoria',   name: 'VICTORIA · 1851',   coords: [144.28, -36.76] },
  { id: 'otago',      name: 'OTAGO · 1861',      coords: [169.20, -45.04] },
  { id: 'westcoast',  name: 'WEST COAST · 1865', coords: [170.97, -42.72] }
];

// Origins / way-stations: not strikes themselves, but where flows started or
// transhipped. Smaller dots, coloured by origin community.
const ORIGINS = [
  { id: 'cornwall',  name: 'CORNWALL',  coords: [-5.05,  50.27], colour: PALETTE.british },
  { id: 'guangdong', name: 'GUANGDONG', coords: [113.27, 23.13], colour: PALETTE.chinese },
  { id: 'hongkong',  name: 'HONG KONG', coords: [114.17, 22.32], colour: PALETTE.chinese }
];

// Migration routes. Weights: 'main' = thick solid trans-Pacific flow; 'sec' =
// secondary (Vic→WC); 'dir' = direct-from-origin (dashed, since these are
// smaller streams that bypass the Cal/Vic shipping routes).
const ROUTES = [
  { from: [-121.5,  38.5], to: [144.28, -36.76], id: 'r-cal-vic',   weight: 'main' },
  { from: [144.28, -36.76], to: [169.20, -45.04], id: 'r-vic-otago', weight: 'main' },
  { from: [144.28, -36.76], to: [170.97, -42.72], id: 'r-vic-wc',    weight: 'sec'  },
  { from: [169.20, -45.04], to: [170.97, -42.72], id: 'r-otago-wc',  weight: 'main' },
  { from: [-5.05,   50.27], to: [169.20, -45.04], id: 'r-cw-otago',  weight: 'dir'  },
  { from: [113.27,  23.13], to: [114.17,  22.32], id: 'r-gd-hk',     weight: 'sec'  },
  { from: [114.17,  22.32], to: [169.20, -45.04], id: 'r-hk-otago',  weight: 'dir'  }
];

function routePaint(weight) {
  switch (weight) {
    case 'main': return { width: 1.8, dash: [2, 2.5] };
    case 'sec':  return { width: 1.2, dash: [2, 2.5] };
    case 'dir':  return { width: 1.2, dash: [1, 3.5] };
    default:     return { width: 1.2, dash: [2, 2.5] };
  }
}

export function init(state) {
  const map = new mapboxgl.Map({
    container: 'map-ch4',
    style: makePaperStyle(),
    projection: 'globe',
    center: [-150, 5], zoom: 1.1,
    interactive: false, attributionControl: false
  });
  state.map = map;
  map.addControl(new mapboxgl.AttributionControl({ compact: true }));

  // DOM handle for the population-chart inset.
  state.popChart = document.getElementById('ch4-pop');

  map.on('load', () => {
    applyPaperFog(map);

    FIELDS.forEach(f => {
      const sid = 'ch4-' + f.id;
      map.addSource(sid, { type: 'geojson', data: pointFC([{ name: f.name, coords: f.coords }]) });
      map.addLayer({
        id: sid + '-pt', type: 'circle', source: sid,
        paint: {
          'circle-radius': 6, 'circle-color': PALETTE.chinese,
          'circle-stroke-color': PALETTE.ink, 'circle-stroke-width': 1.2,
          'circle-opacity': 0, 'circle-stroke-opacity': 0,
          'circle-opacity-transition': { duration: 1000 },
          'circle-stroke-opacity-transition': { duration: 1000 }
        }
      });
      map.addLayer({
        id: sid + '-label', type: 'symbol', source: sid,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11, 'text-offset': [0, -1.5], 'text-letter-spacing': 0.18
        },
        paint: {
          'text-color': PALETTE.ink,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.6,
          'text-opacity': 0, 'text-opacity-transition': { duration: 1000 }
        }
      });
    });

    ORIGINS.forEach(o => {
      const sid = 'ch4-' + o.id;
      map.addSource(sid, { type: 'geojson', data: pointFC([{ name: o.name, coords: o.coords }]) });
      map.addLayer({
        id: sid + '-pt', type: 'circle', source: sid,
        paint: {
          'circle-radius': 4, 'circle-color': o.colour,
          'circle-stroke-color': PALETTE.paper, 'circle-stroke-width': 1.4,
          'circle-opacity': 0, 'circle-stroke-opacity': 0,
          'circle-opacity-transition': { duration: 1000 },
          'circle-stroke-opacity-transition': { duration: 1000 }
        }
      });
      map.addLayer({
        id: sid + '-label', type: 'symbol', source: sid,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10, 'text-offset': [0.9, 0], 'text-anchor': 'left',
          'text-letter-spacing': 0.16, 'text-padding': 2
        },
        paint: {
          'text-color': o.colour,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.6,
          'text-opacity': 0, 'text-opacity-transition': { duration: 1000 }
        }
      });
    });

    ROUTES.forEach(r => {
      const sid = 'ch4-' + r.id;
      const paint = routePaint(r.weight);
      map.addSource(sid, { type: 'geojson', data: arcFC([r]) });
      map.addLayer({
        id: sid + '-line', type: 'line', source: sid,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': PALETTE.chinese,
          'line-width': paint.width,
          'line-dasharray': paint.dash,
          'line-opacity': 0,
          'line-opacity-transition': { duration: 1500 }
        }
      });
    });

    state.ready = true;
    state.pending.forEach(fn => fn());
    state.pending = [];
  });
}

const FIELD_IDS  = FIELDS.map(f => f.id);
const ORIGIN_IDS = ORIGINS.map(o => o.id);
const ROUTE_IDS  = ROUTES.map(r => r.id);

const setPin = (s, id, opacity) => {
  s.map.setPaintProperty('ch4-' + id + '-pt',    'circle-opacity', opacity);
  s.map.setPaintProperty('ch4-' + id + '-pt',    'circle-stroke-opacity', opacity);
  s.map.setPaintProperty('ch4-' + id + '-label', 'text-opacity', opacity);
};
const setRoute = (s, id, opacity) =>
  s.map.setPaintProperty('ch4-' + id + '-line', 'line-opacity', opacity);

const setPop = (s, fillYear) => {
  const wrap = s.popChart;
  if (!wrap) return;
  wrap.classList.toggle('show', fillYear > 0);
  wrap.dataset.fill = String(fillYear);
  wrap.querySelectorAll('rect.bar').forEach(b => {
    const y = parseInt(b.dataset.year, 10);
    b.classList.toggle('shown', y <= fillYear);
  });
  // Show only the latest milestone reached, not all of them stacked.
  const milestones = [1864, 1867, 1881];
  const latest = milestones.filter(m => fillYear >= m).pop();
  milestones.forEach(yr => {
    const node = document.getElementById('ch4-anno-' + yr);
    if (node) node.style.opacity = (yr === latest) ? '1' : '0';
  });
};

// Four-step scrolly: Pacific circuit → Otago → WC crossover → what stayed.
// (The structural "who actually came" network has moved out of the sticky
// pane and lives as a full-chapter figure after the map.)
export const actions = {
  'ch4-step1': (s) => {
    setPop(s, 0);
    s.map.flyTo({ center: [-150, 5], zoom: 1.1, pitch: 0, duration: 2400, essential: true });
    FIELD_IDS.forEach(id => setPin(s, id, 1));
    ORIGIN_IDS.forEach(id => setPin(s, id, 0));
    ROUTE_IDS.forEach(id => setRoute(s, id, 0));
  },
  'ch4-step2': (s) => {
    s.map.flyTo({ center: [172, -42], zoom: 4.4, pitch: 25, duration: 2800, essential: true });
    FIELD_IDS.forEach(id => setPin(s, id, 1));
    setPin(s, 'cornwall', 1);
    setPin(s, 'guangdong', 0);
    setPin(s, 'hongkong',  0);
    setRoute(s, 'r-cal-vic',   0.35);
    setRoute(s, 'r-vic-otago', 0.95);
    setRoute(s, 'r-cw-otago',  0.4);
    setRoute(s, 'r-otago-wc',  0);
    setRoute(s, 'r-vic-wc',    0);
    setRoute(s, 'r-hk-otago',  0);
    setRoute(s, 'r-gd-hk',     0);
    setPop(s, 1864);
  },
  'ch4-step3': (s) => {
    s.map.flyTo({ center: [170.5, -43.4], zoom: 5.3, pitch: 30, duration: 2800, essential: true });
    FIELD_IDS.forEach(id => setPin(s, id, 1));
    setPin(s, 'cornwall', 0.7);
    setPin(s, 'hongkong', 1);
    setPin(s, 'guangdong', 0);
    setRoute(s, 'r-cal-vic',   0.2);
    setRoute(s, 'r-vic-otago', 0.5);
    setRoute(s, 'r-vic-wc',    0.55);
    setRoute(s, 'r-otago-wc',  0.95);
    setRoute(s, 'r-cw-otago',  0.25);
    setRoute(s, 'r-hk-otago',  0.6);
    setRoute(s, 'r-gd-hk',     0);
    setPop(s, 1867);
  },
  'ch4-step4': (s) => {
    s.map.flyTo({ center: [165, -38], zoom: 3.5, pitch: 15, duration: 2800, essential: true });
    FIELD_IDS.forEach(id => setPin(s, id, 1));
    ORIGIN_IDS.forEach(id => setPin(s, id, 1));
    ROUTE_IDS.forEach(id => setRoute(s, id, 0.55));
    setPop(s, 1881);
  }
};
