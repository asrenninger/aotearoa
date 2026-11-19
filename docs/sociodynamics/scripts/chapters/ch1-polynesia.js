/**
 * Chapter 1 — Polynesian voyaging across Te Moana-nui-a-Kiwa.
 *
 * Globe projection. Two distinct voyaging routes terminate at real
 * archaeological first-settlement regions: Society Is. → Northland
 * (Bay of Islands), and Cook Is. → Otago (Shag/Pleasant River mouths).
 * Each route is a chunky dashed great-circle ending in a triangular
 * arrowhead drawn into a canvas at init and registered as a Mapbox
 * image, then rotated by the line's incoming bearing.
 */

import { PALETTE } from '../core/palette.js';
import { makePaperStyle, applyPaperFog } from '../core/mapbox-style.js';
import { pointFC, greatCirclePoints, bearingDeg } from '../core/mapbox-helpers.js';

export function init(state) {
  const map = new mapboxgl.Map({
    container: 'map-ch1',
    style: makePaperStyle(),
    projection: 'globe',
    center: [-160, -15], zoom: 1.4,
    interactive: false, attributionControl: false
  });
  state.map = map;
  map.addControl(new mapboxgl.AttributionControl({ compact: true }));

  map.on('load', () => {
    applyPaperFog(map);

    // Polynesian island origins
    const origins = [
      { name: 'HAWAIʻI',     coords: [-155.5,  19.9] },
      { name: 'MARQUESAS',   coords: [-139.0,  -9.0] },
      { name: 'SOCIETY IS.', coords: [-149.5, -17.5] },
      { name: 'COOK IS.',    coords: [-159.7, -21.2] },
      { name: 'SAMOA',       coords: [-171.7, -13.85] },
      { name: 'TONGA',       coords: [-175.2, -21.10] },
      { name: 'RAPA NUI',    coords: [-109.4, -27.10] }
    ];
    map.addSource('ch1-origins', { type: 'geojson', data: pointFC(origins) });
    map.addLayer({
      id: 'ch1-origins-pts', type: 'circle', source: 'ch1-origins',
      paint: {
        'circle-radius': 4, 'circle-color': PALETTE.poly,
        'circle-stroke-color': PALETTE.paper, 'circle-stroke-width': 1.4
      }
    });
    map.addLayer({
      id: 'ch1-origins-labels', type: 'symbol', source: 'ch1-origins',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 10, 'text-offset': [0.9, 0], 'text-anchor': 'left',
        'text-letter-spacing': 0.14, 'text-padding': 2
      },
      paint: {
        'text-color': PALETTE.poly,
        'text-halo-color': PALETTE.paper, 'text-halo-width': 1.6
      }
    });

    // Two voyaging routes — Society→Northland, Cook→Otago.
    const routes = [
      { id: 'society-northland', from: [-149.5, -17.5], to: [174.10, -35.30] },
      { id: 'cook-otago',        from: [-159.7, -21.2], to: [170.70, -45.55] }
    ];
    const routePts = routes.map(r => greatCirclePoints(r.from, r.to, 120));

    map.addSource('ch1-routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: routes.map((r, i) => ({
          type: 'Feature',
          properties: { id: r.id },
          geometry: { type: 'LineString', coordinates: routePts[i] }
        }))
      }
    });
    map.addLayer({
      id: 'ch1-routes-line', type: 'line', source: 'ch1-routes',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': PALETTE.poly,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3.0, 4, 4.5, 6, 5.5],
        'line-dasharray': [1.6, 1.2],
        'line-opacity': 0,
        'line-opacity-transition': { duration: 1500 }
      }
    });

    // Triangular arrowhead → canvas → addImage. Tip points "up" (north) by
    // default; the symbol layer rotates by each route's terminal bearing.
    if (!map.hasImage('ch1-arrow')) {
      const sz = 36;
      const cv = document.createElement('canvas');
      cv.width = sz; cv.height = sz;
      const cx = cv.getContext('2d');
      cx.fillStyle = PALETTE.poly;
      cx.beginPath();
      cx.moveTo(sz / 2, 3);             // tip
      cx.lineTo(sz - 5, sz - 5);        // back-right
      cx.lineTo(sz / 2, sz - 11);       // notch (gives the arrow a kite tail)
      cx.lineTo(5,      sz - 5);        // back-left
      cx.closePath();
      cx.fill();
      map.addImage('ch1-arrow', cx.getImageData(0, 0, sz, sz));
    }

    map.addSource('ch1-arrows', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: routes.map((r, i) => {
          const pts = routePts[i];
          const last = pts[pts.length - 1];
          const prev = pts[pts.length - 2];
          return {
            type: 'Feature',
            properties: { id: r.id, bearing: bearingDeg(prev, last) },
            geometry: { type: 'Point', coordinates: last }
          };
        })
      }
    });
    map.addLayer({
      id: 'ch1-arrows-symbol', type: 'symbol', source: 'ch1-arrows',
      layout: {
        'icon-image': 'ch1-arrow',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 4, 1.0, 6, 1.4],
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-anchor': 'top'
      },
      paint: {
        'icon-opacity': 0,
        'icon-opacity-transition': { duration: 1500 }
      }
    });

    state.ready = true;
    state.pending.forEach(fn => fn());
    state.pending = [];
  });
}

export const actions = {
  'ch1-step1': (s) => {
    s.map.flyTo({ center: [-155, -10], zoom: 1.5, pitch: 0, bearing: 0,
                  duration: 2400, essential: true });
    s.map.setPaintProperty('ch1-routes-line',  'line-opacity', 0);
    s.map.setPaintProperty('ch1-arrows-symbol', 'icon-opacity', 0);
  },
  'ch1-step2': (s) => {
    s.map.flyTo({ center: [-178, -27], zoom: 2.4, pitch: 25, bearing: 0,
                  duration: 2800, essential: true });
    s.map.setPaintProperty('ch1-routes-line',  'line-opacity', 0.9);
    s.map.setPaintProperty('ch1-arrows-symbol', 'icon-opacity', 1);
  },
  'ch1-step3': (s) => {
    s.map.flyTo({ center: [174, -38.5], zoom: 4.4, pitch: 30, bearing: 0,
                  duration: 2800, essential: true });
    s.map.setPaintProperty('ch1-routes-line',  'line-opacity', 0.85);
    s.map.setPaintProperty('ch1-arrows-symbol', 'icon-opacity', 1);
  }
};
