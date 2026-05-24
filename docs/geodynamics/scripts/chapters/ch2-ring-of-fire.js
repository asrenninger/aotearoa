/**
 * Chapter 2 — The Ring of Fire.
 *
 * Sticky-scrolly Mapbox map (globe → New Zealand). Four steps:
 *   1. The whole Pacific rim lights up with major volcanoes.
 *   2. Fly to New Zealand; the Pacific–Australian plate boundary appears
 *      (the Alpine Fault + the Hikurangi subduction front).
 *   3. Zoom to the South Island and the Alpine Fault.
 *   4. Zoom to the Taupō Volcanic Zone in the North Island.
 *
 * Volcano coordinates are a curated set of well-known Ring-of-Fire cones;
 * fault geometry is a hand-simplified trace of the plate boundary. Both are
 * indicative — see docs/METHODOLOGY.md.
 */

import { PALETTE } from '../core/palette.js';

// Major Ring-of-Fire volcanoes, clockwise from the Aleutians. `nz` flags the
// New-Zealand / Taupō-Volcanic-Zone cones so they can be emphasised later.
const VOLCANOES = [
  { name: 'Redoubt',        coords: [-152.74, 60.49] },
  { name: 'Mt St Helens',   coords: [-122.18, 46.19] },
  { name: 'Lassen',         coords: [-121.51, 40.49] },
  { name: 'Popocatépetl',   coords: [-98.62, 19.02] },
  { name: 'Fuego',          coords: [-90.88, 14.47] },
  { name: 'Cotopaxi',       coords: [-78.44, -0.68] },
  { name: 'Misti',          coords: [-71.41, -16.29] },
  { name: 'Villarrica',     coords: [-71.93, -39.42] },
  { name: 'Erebus',         coords: [167.15, -77.53] },
  { name: 'Ruapehu',        coords: [175.57, -39.28], nz: true },
  { name: 'Tongariro',      coords: [175.65, -39.13], nz: true },
  { name: 'Taupō',          coords: [175.90, -38.82], nz: true },
  { name: 'Tarawera',       coords: [176.51, -38.23], nz: true },
  { name: 'Whakaari',       coords: [177.18, -37.52], nz: true },
  { name: 'Taranaki',       coords: [174.06, -39.30], nz: true },
  { name: 'Raoul',          coords: [-177.92, -29.27] },
  { name: 'Yasur',          coords: [169.45, -19.53] },
  { name: 'Rabaul',         coords: [152.20, -4.27] },
  { name: 'Krakatoa',       coords: [105.42, -6.10] },
  { name: 'Merapi',         coords: [110.45, -7.54] },
  { name: 'Tambora',        coords: [118.00, -8.25] },
  { name: 'Pinatubo',       coords: [120.35, 15.13] },
  { name: 'Mayon',          coords: [123.69, 13.26] },
  { name: 'Fuji',           coords: [138.73, 35.36] },
  { name: 'Sakurajima',     coords: [130.66, 31.59] },
  { name: 'Klyuchevskaya',  coords: [160.64, 56.06] }
];

// Plate-boundary traces (hand-simplified).
const ALPINE_FAULT = [
  [167.0, -44.6], [168.4, -44.1], [169.6, -43.6], [170.6, -43.2],
  [171.5, -42.8], [172.3, -42.4], [173.0, -42.0]
];
const HIKURANGI = [
  [178.2, -41.6], [178.6, -40.2], [179.2, -38.8], [179.8, -37.5], [179.95, -36.4]
];

function volcanoFC(filterNz) {
  const feats = VOLCANOES
    .filter(v => !filterNz || v.nz)
    .map(v => ({
      type: 'Feature',
      properties: { name: v.name, nz: v.nz ? 1 : 0 },
      geometry: { type: 'Point', coordinates: v.coords }
    }));
  return { type: 'FeatureCollection', features: feats };
}

function lineFC(lines) {
  return {
    type: 'FeatureCollection',
    features: lines.map((coords, i) => ({
      type: 'Feature', properties: { id: i },
      geometry: { type: 'LineString', coordinates: coords }
    }))
  };
}

export function init(state) {
  const map = new mapboxgl.Map({
    container: 'map-ch2',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    projection: 'globe',
    center: [-150, 0], zoom: 1.05,
    interactive: false, attributionControl: false
  });
  state.map = map;

  map.on('load', () => {
    // Strip road labels (and road shields) — we want bare terrain, not a street map.
    try {
      map.getStyle().layers.forEach(l => {
        if (l.type === 'symbol' && /road|street|motorway|shield|transit/i.test(l.id)) {
          map.setLayoutProperty(l.id, 'visibility', 'none');
        }
      });
    } catch (e) { /* style layer ids vary; ignore */ }

    // 3D terrain — real elevation, so we can pitch the camera and see the
    // Southern Alps and the volcanoes in perspective.
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14
      });
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.addLayer({
      id: 'sky', type: 'sky',
      paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0, 0], 'sky-atmosphere-sun-intensity': 8 }
    });
    map.setFog({ 'horizon-blend': 0.1, 'color': '#cdd6d6', 'high-color': '#5a7a8a', 'space-color': '#1d1610', 'star-intensity': 0.15 });

    // GEBCO bathymetry (shaded relief incl. ocean depth) — shown on the
    // plate-boundary overview so the Hikurangi trench reads. Graceful if it
    // fails to load (map still works on satellite).
    try {
      map.addSource('gebco', {
        type: 'raster', tileSize: 256,
        tiles: ['https://wms.gebco.net/mapserv?request=getmap&service=wms&version=1.3.0&layers=GEBCO_LATEST&styles=&format=image/png&transparent=false&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}']
      });
      map.addLayer({ id: 'ch2-bathy', type: 'raster', source: 'gebco', paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 1000 } } });
    } catch (e) { /* bathymetry optional */ }

    // Plate boundary — bright amber over a dark casing so it reads on satellite.
    map.addSource('ch2-faults', { type: 'geojson', data: lineFC([ALPINE_FAULT, HIKURANGI]) });
    map.addLayer({
      id: 'ch2-faults-casing', type: 'line', source: 'ch2-faults',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1d1610', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 8], 'line-opacity': 0, 'line-opacity-transition': { duration: 1200 } }
    });
    map.addLayer({
      id: 'ch2-faults-line', type: 'line', source: 'ch2-faults',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffce4d', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.4, 8, 4], 'line-dasharray': [2, 1.4], 'line-opacity': 0, 'line-opacity-transition': { duration: 1200 } }
    });

    // All Ring-of-Fire volcanoes.
    map.addSource('ch2-volcanoes', { type: 'geojson', data: volcanoFC(false) });
    map.addLayer({
      id: 'ch2-volcanoes-pts', type: 'circle', source: 'ch2-volcanoes',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 4, 4.5, 7, 7],
        'circle-color': PALETTE.fire,
        'circle-opacity': 0, 'circle-opacity-transition': { duration: 1400 },
        'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2
      }
    });
    map.addLayer({
      id: 'ch2-volcanoes-labels', type: 'symbol', source: 'ch2-volcanoes',
      filter: ['==', ['get', 'nz'], 1],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Regular'],
        'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-letter-spacing': 0.06
      },
      paint: { 'text-color': '#fff', 'text-halo-color': '#1d1610', 'text-halo-width': 1.8, 'text-opacity': 0, 'text-opacity-transition': { duration: 800 } }
    });

    state.ready = true;
    state.pending.forEach(fn => fn());
    state.pending = [];
  });
}

function setBathy(map, on) { if (map.getLayer('ch2-bathy')) map.setPaintProperty('ch2-bathy', 'raster-opacity', on ? 0.85 : 0); }
function setFaults(map, op) {
  if (map.getLayer('ch2-faults-line')) map.setPaintProperty('ch2-faults-line', 'line-opacity', op);
  if (map.getLayer('ch2-faults-casing')) map.setPaintProperty('ch2-faults-casing', 'line-opacity', op ? Math.min(1, op + 0.1) : 0);
}

export const actions = {
  'ch2-step1': (s) => {
    s.map.flyTo({ center: [-150, 0], zoom: 1.05, pitch: 0, bearing: 0, duration: 2400, essential: true });
    s.map.setPaintProperty('ch2-volcanoes-pts', 'circle-opacity', 0.95);
    setFaults(s.map, 0); setBathy(s.map, false);
    s.map.setPaintProperty('ch2-volcanoes-labels', 'text-opacity', 0);
  },
  'ch2-step2': (s) => {
    // Plate-boundary overview, with GEBCO bathymetry so the Hikurangi trench reads.
    s.map.flyTo({ center: [176.5, -40], zoom: 4.3, pitch: 35, bearing: 0, duration: 2800, essential: true });
    s.map.setPaintProperty('ch2-volcanoes-pts', 'circle-opacity', 0.95);
    setFaults(s.map, 0.95); setBathy(s.map, true);
    s.map.setPaintProperty('ch2-volcanoes-labels', 'text-opacity', 0);
  },
  'ch2-step3': (s) => {
    // Alpine Fault — pitched hard to throw the Southern Alps into perspective.
    s.map.flyTo({ center: [170.2, -43.5], zoom: 7.2, pitch: 72, bearing: 38, duration: 3000, essential: true });
    setFaults(s.map, 1); setBathy(s.map, false);
    s.map.setPaintProperty('ch2-volcanoes-labels', 'text-opacity', 0.9);
  },
  'ch2-step4': (s) => {
    // Taupō Volcanic Zone — the central-plateau cones in perspective.
    s.map.flyTo({ center: [175.9, -39.0], zoom: 7.4, pitch: 66, bearing: -10, duration: 3000, essential: true });
    setFaults(s.map, 0.5); setBathy(s.map, false);
    s.map.setPaintProperty('ch2-volcanoes-labels', 'text-opacity', 1);
  }
};
