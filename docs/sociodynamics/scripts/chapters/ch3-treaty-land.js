/**
 * Chapter 3 — Treaty, war, and the conversion of land.
 *
 * Mercator projection over Aotearoa. Real Natural-Earth NZ outline as the
 * basemap; smoothed-blob confiscation polygons for the four NZSA 1863
 * raupatu zones; and a separate smoothed-blob layer for indicative
 * 1890 still-Māori-held areas.
 *
 * Colour story (deliberately distinct):
 *   - Pre-war Māori-held wash: maori-green (#2d5a3d) at low opacity
 *   - NZSA confiscation:        british oxblood (#8c2230) at high opacity
 *   - 1890 remaining:           maori-green at high opacity
 *
 * The same green is used in two roles, but the opacity gap is large
 * enough that the wash and the 1890 patches read as different states.
 */

import { PALETTE } from '../core/palette.js';
import { makePaperStyle, applyPaperFog } from '../core/mapbox-style.js';
import { smoothPolygonFeature, offsetPolygonFeature } from '../core/mapbox-helpers.js';

/**
 * Build a stack of inward-offset, smoothed copies of a polygon collection
 * so the renderer can paint them as concentric softer→bolder fills. The
 * result is four FeatureCollections at progressively shrunken sizes; when
 * stacked with rising opacity at render time the eye reads them as a
 * KDE-like density falloff rather than a hard polygon edge.
 */
function buildFeatherStack(fc, samples = 14) {
  const factors = [0, 0.16, 0.30, 0.44];
  return factors.map(factor => ({
    type: 'FeatureCollection',
    features: fc.features.map(f => smoothPolygonFeature(offsetPolygonFeature(f, factor), samples))
  }));
}

// Per-layer opacity ratios — the outermost ring is a soft wash, the
// innermost ring is the strongest. Multiply the chapter's "active"
// opacity for the polygon group by these to get each layer's opacity.
const FEATHER_RATIOS = [0.30, 0.55, 0.85, 1.0];

export function init(state) {
  const map = new mapboxgl.Map({
    container: 'map-ch3',
    style: makePaperStyle(),
    projection: 'mercator',
    center: [175.8, -38.4], zoom: 5.4,
    interactive: false, attributionControl: false
  });
  state.map = map;
  map.addControl(new mapboxgl.AttributionControl({ compact: true }));

  map.on('load', async () => {
    try {
      applyPaperFog(map);

      // Fetch all the chapter's data in parallel
      const [nz, conf, remain, places] = await Promise.all([
        fetch('./data/nz-islands.geojson').then(r => r.json()),
        fetch('./data/confiscation-zones.geojson').then(r => r.json()),
        fetch('./data/maori-land-1890.geojson').then(r => r.json()),
        fetch('./data/ni-places.geojson').then(r => r.json())
      ]);

      const ni = nz.features.find(f => f.properties.name === 'North Island');
      const si = nz.features.find(f => f.properties.name === 'South Island');

      // South Island context — paper-toned dashed outline behind everything
      map.addSource('ch3-si', { type: 'geojson', data: si });
      map.addLayer({
        id: 'ch3-si-fill', type: 'fill', source: 'ch3-si',
        paint: { 'fill-color': PALETTE.paperDeep, 'fill-opacity': 0.45 }
      });
      map.addLayer({
        id: 'ch3-si-line', type: 'line', source: 'ch3-si',
        paint: {
          'line-color': PALETTE.inkFaint,
          'line-width': 0.6, 'line-opacity': 0.5, 'line-dasharray': [3, 3]
        }
      });

      // North Island base — sandy land tint + clean stroke
      map.addSource('ch3-ni', { type: 'geojson', data: ni });
      map.addLayer({
        id: 'ch3-ni-fill', type: 'fill', source: 'ch3-ni',
        paint: { 'fill-color': PALETTE.paperDeep, 'fill-opacity': 0.65 }
      });
      map.addLayer({
        id: 'ch3-ni-line', type: 'line', source: 'ch3-ni',
        paint: { 'line-color': PALETTE.inkSoft, 'line-width': 1.0 }
      });

      // Pre-war Māori-held wash (covers entire NI; visible in steps 1–2)
      map.addLayer({
        id: 'ch3-prewar-fill', type: 'fill', source: 'ch3-ni',
        paint: {
          'fill-color': PALETTE.maori,
          'fill-opacity': 0,
          'fill-opacity-transition': { duration: 1500 }
        }
      });

      // NZSA 1863 confiscation zones — KDE-like feathered fill (four
      // concentric inward-offset copies stacked with rising opacity).
      // No outline; the soft falloff is the boundary.
      buildFeatherStack(conf, 14).forEach((data, i) => {
        const sid = 'ch3-conf-' + i;
        map.addSource(sid, { type: 'geojson', data });
        map.addLayer({
          id: sid + '-fill', type: 'fill', source: sid,
          paint: {
            'fill-color': PALETTE.british,
            'fill-opacity': 0,
            'fill-opacity-transition': { duration: 1500 }
          }
        });
      });

      // 1890 still-Māori-held — same feathered treatment in greenstone.
      // The Te Rohe Pōtae × Central Plateau merge in the geojson is
      // smoothed at render time into a single peanut-shaped blob.
      buildFeatherStack(remain, 14).forEach((data, i) => {
        const sid = 'ch3-remain-' + i;
        map.addSource(sid, { type: 'geojson', data });
        map.addLayer({
          id: sid + '-fill', type: 'fill', source: sid,
          paint: {
            'fill-color': PALETTE.maori,
            'fill-opacity': 0,
            'fill-opacity-transition': { duration: 1500 }
          }
        });
      });

      // Settler-era town markers
      map.addSource('ch3-places', { type: 'geojson', data: places });
      map.addLayer({
        id: 'ch3-places-pt', type: 'circle', source: 'ch3-places',
        paint: {
          'circle-radius': 3, 'circle-color': PALETTE.paper,
          'circle-stroke-color': PALETTE.ink, 'circle-stroke-width': 1
        }
      });
      map.addLayer({
        id: 'ch3-places-label', type: 'symbol', source: 'ch3-places',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Italic', 'Arial Unicode MS Regular'],
          'text-size': 11, 'text-offset': [0.6, 0.2], 'text-anchor': 'left',
          'text-padding': 4
        },
        paint: {
          'text-color': PALETTE.ink,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.4
        }
      });

      // Confiscation labels — separate symbol layer at each zone's centroid.
      // text-allow-overlap so they don't get suppressed by Mapbox's collision
      // detection against the base style's city labels.
      const confLabels = {
        type: 'FeatureCollection',
        features: conf.features.map(f => ({
          type: 'Feature',
          properties: { name: f.properties.name.toUpperCase(), year: f.properties.year },
          geometry: { type: 'Point', coordinates: f.properties.centroid }
        }))
      };
      map.addSource('ch3-conf-labels', { type: 'geojson', data: confLabels });
      map.addLayer({
        id: 'ch3-conf-labels-name', type: 'symbol', source: 'ch3-conf-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11, 'text-letter-spacing': 0.2, 'text-offset': [0, -0.4],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': PALETTE.paper,
          'text-halo-color': PALETTE.ink, 'text-halo-width': 1.6,
          'text-opacity': 0,
          'text-opacity-transition': { duration: 1500 }
        }
      });
      map.addLayer({
        id: 'ch3-conf-labels-year', type: 'symbol', source: 'ch3-conf-labels',
        layout: {
          'text-field': ['get', 'year'],
          'text-font': ['Open Sans Italic', 'Arial Unicode MS Regular'],
          'text-size': 10, 'text-offset': [0, 0.9],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': PALETTE.british,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.6,
          'text-opacity': 0,
          'text-opacity-transition': { duration: 1500 }
        }
      });

      // Year stamp — HTML overlay pinned to the map-pane corner. Easier than
      // fighting Mapbox to position a fixed-pixel symbol layer on the canvas.
      const yearEl = document.createElement('div');
      yearEl.className = 'ch3-year-stamp';
      yearEl.textContent = '1840';
      document.getElementById('map-ch3').appendChild(yearEl);
      state.yearEl = yearEl;

      // Force a repaint so the geojson worker tiles the freshly-added
      // sources. Without this, when multiple Mapbox instances are
      // off-screen at init the worker can leave new sources untiled
      // until the canvas is next interacted with.
      map.triggerRepaint();

      state.ready = true;
      state.pending.forEach(fn => fn());
      state.pending = [];
    } catch (err) {
      console.error('ch3: init failed', err);
    }
  });
}

/** Set the four feathered layers of a polygon group to a target peak
 *  opacity. FEATHER_RATIOS scales each layer's opacity so the outer
 *  rings are soft wash and the inner ring lands at the peak value. */
function setFeather(map, prefix, peak) {
  for (let i = 0; i < FEATHER_RATIOS.length; i++) {
    map.setPaintProperty(`${prefix}-${i}-fill`, 'fill-opacity', peak * FEATHER_RATIOS[i]);
  }
}

export const actions = {
  'ch3-step1': (s) => {
    s.map.flyTo({ center: [175.8, -38.4], zoom: 5.4, duration: 2200, essential: true });
    s.map.setPaintProperty('ch3-prewar-fill',      'fill-opacity', 0.32);
    setFeather(s.map, 'ch3-conf',   0);
    setFeather(s.map, 'ch3-remain', 0);
    s.map.setPaintProperty('ch3-conf-labels-name', 'text-opacity', 0);
    s.map.setPaintProperty('ch3-conf-labels-year', 'text-opacity', 0);
    if (s.yearEl) s.yearEl.textContent = '1840';
  },
  'ch3-step2': (s) => {
    s.map.flyTo({ center: [175.8, -38.4], zoom: 5.5, duration: 2200, essential: true });
    s.map.setPaintProperty('ch3-prewar-fill',      'fill-opacity', 0.36);
    setFeather(s.map, 'ch3-conf',   0);
    setFeather(s.map, 'ch3-remain', 0);
    s.map.setPaintProperty('ch3-conf-labels-name', 'text-opacity', 0);
    s.map.setPaintProperty('ch3-conf-labels-year', 'text-opacity', 0);
    if (s.yearEl) s.yearEl.textContent = '1860';
  },
  'ch3-step3': (s) => {
    // Hover over the Waikato confiscation; rest of NI still legible.
    s.map.flyTo({ center: [175.30, -37.55], zoom: 6.8, duration: 2400, essential: true });
    s.map.setPaintProperty('ch3-prewar-fill',      'fill-opacity', 0.16);
    setFeather(s.map, 'ch3-conf',   0.55);
    setFeather(s.map, 'ch3-remain', 0);
    s.map.setPaintProperty('ch3-conf-labels-name', 'text-opacity', 0.95);
    s.map.setPaintProperty('ch3-conf-labels-year', 'text-opacity', 0.85);
    if (s.yearEl) s.yearEl.textContent = '1863';
  },
  'ch3-step4': (s) => {
    // Pull back to show all four NZSA zones plus the 1890 remaining patches.
    s.map.flyTo({ center: [176.0, -38.6], zoom: 5.3, duration: 2400, essential: true });
    s.map.setPaintProperty('ch3-prewar-fill',      'fill-opacity', 0.10);
    setFeather(s.map, 'ch3-conf',   0.55);
    setFeather(s.map, 'ch3-remain', 0.65);
    s.map.setPaintProperty('ch3-conf-labels-name', 'text-opacity', 0.95);
    s.map.setPaintProperty('ch3-conf-labels-year', 'text-opacity', 0.85);
    if (s.yearEl) s.yearEl.textContent = '1890';
  }
};
