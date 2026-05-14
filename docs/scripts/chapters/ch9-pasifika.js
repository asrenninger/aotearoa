/**
 * Chapter 9 — Pacific labour migration to Auckland.
 *
 * Globe projection. Six island origins (Sāmoa, Tonga, Cook Is., Niue,
 * Tokelau, Fiji) and arcs converging on Auckland. Step 4 zooms hard
 * into Auckland and surfaces the Pasifika suburb anchors (Ponsonby/Grey
 * Lynn for the 1960s entry; Ōtara/Māngere/Manukau for the 1970s onward
 * shift south).
 */

import { PALETTE } from '../core/palette.js';
import { makePaperStyle, applyPaperFog } from '../core/mapbox-style.js';
import { pointFC, arcFC } from '../core/mapbox-helpers.js';

export function init(state) {
  const map = new mapboxgl.Map({
    container: 'map-ch9',
    style: makePaperStyle(),
    projection: 'globe',
    center: [-178, -22], zoom: 2.3,
    interactive: false, attributionControl: false
  });
  state.map = map;

  map.on('load', async () => {
    try {
      applyPaperFog(map);

      const islands = [
        { id: 'samoa',   name: 'SĀMOA',     coords: [-171.78, -13.83] },
        { id: 'tonga',   name: 'TONGA',     coords: [-175.20, -21.13] },
        { id: 'cook',    name: 'COOK IS.',  coords: [-159.78, -21.23] },
        { id: 'niue',    name: 'NIUE',      coords: [-169.92, -19.05] },
        { id: 'tokelau', name: 'TOKELAU',   coords: [-172.50,  -8.55] },
        { id: 'fiji',    name: 'FIJI',      coords: [ 178.42, -18.13] }
      ];
      map.addSource('ch9-islands', { type: 'geojson', data: pointFC(islands) });
      map.addLayer({
        id: 'ch9-islands-pts', type: 'circle', source: 'ch9-islands',
        paint: {
          'circle-radius': 5, 'circle-color': PALETTE.pacific,
          'circle-stroke-color': PALETTE.paper, 'circle-stroke-width': 1.4
        }
      });
      map.addLayer({
        id: 'ch9-islands-labels', type: 'symbol', source: 'ch9-islands',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10, 'text-offset': [0.9, 0], 'text-anchor': 'left',
          'text-letter-spacing': 0.16
        },
        paint: {
          'text-color': PALETTE.pacific,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.6
        }
      });

      const akl = [174.76, -36.85];
      map.addSource('ch9-auckland', {
        type: 'geojson',
        data: pointFC([{ name: 'AUCKLAND', coords: akl }])
      });
      map.addLayer({
        id: 'ch9-auckland-halo', type: 'circle', source: 'ch9-auckland',
        paint: {
          'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': PALETTE.pacific, 'circle-stroke-width': 1.2,
          'circle-stroke-opacity': 0.6
        }
      });
      map.addLayer({
        id: 'ch9-auckland-pt', type: 'circle', source: 'ch9-auckland',
        paint: {
          'circle-radius': 7, 'circle-color': PALETTE.pacific,
          'circle-stroke-color': PALETTE.paper, 'circle-stroke-width': 1.6
        }
      });
      map.addLayer({
        id: 'ch9-auckland-label', type: 'symbol', source: 'ch9-auckland',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Italic', 'Arial Unicode MS Regular'],
          'text-size': 13, 'text-offset': [0, 1.5], 'text-letter-spacing': 0.18
        },
        paint: {
          'text-color': PALETTE.ink,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.6
        }
      });

      // Migration arcs from each island to Auckland
      const arcs = islands.map(i => ({ from: i.coords, to: akl, id: 'r-' + i.id }));
      map.addSource('ch9-arcs', { type: 'geojson', data: arcFC(arcs) });
      map.addLayer({
        id: 'ch9-arcs-line', type: 'line', source: 'ch9-arcs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': PALETTE.pacific,
          'line-width': 1.6, 'line-dasharray': [2, 2.5],
          'line-opacity': 0,
          'line-opacity-transition': { duration: 1500 }
        }
      });

      // Auckland Pasifika suburb anchors — only meaningful at high zoom
      const suburbs = await fetch('./data/auckland-pasifika-anchors.geojson')
        .then(r => r.json());
      map.addSource('ch9-suburbs', { type: 'geojson', data: suburbs });
      map.addLayer({
        id: 'ch9-suburbs-pts', type: 'circle', source: 'ch9-suburbs',
        paint: {
          'circle-radius': 5, 'circle-color': PALETTE.pacific,
          'circle-stroke-color': PALETTE.paper, 'circle-stroke-width': 1.4,
          'circle-opacity': 0, 'circle-stroke-opacity': 0,
          'circle-opacity-transition': { duration: 1000 },
          'circle-stroke-opacity-transition': { duration: 1000 }
        }
      });
      map.addLayer({
        id: 'ch9-suburbs-labels', type: 'symbol', source: 'ch9-suburbs',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Italic', 'Arial Unicode MS Regular'],
          'text-size': 12, 'text-offset': [0.9, 0], 'text-anchor': 'left'
        },
        paint: {
          'text-color': PALETTE.ink,
          'text-halo-color': PALETTE.paper, 'text-halo-width': 1.4,
          'text-opacity': 0,
          'text-opacity-transition': { duration: 1000 }
        }
      });

      state.ready = true;
      state.pending.forEach(fn => fn());
      state.pending = [];
    } catch (err) {
      console.error('ch9: init failed', err);
    }
  });
}

const setSuburbs = (s, op) => {
  s.map.setPaintProperty('ch9-suburbs-pts', 'circle-opacity', op);
  s.map.setPaintProperty('ch9-suburbs-pts', 'circle-stroke-opacity', op);
  s.map.setPaintProperty('ch9-suburbs-labels', 'text-opacity', op);
};

export const actions = {
  'ch9-step1': (s) => {
    s.map.flyTo({ center: [-178, -22], zoom: 2.3, pitch: 0,
                  duration: 2400, essential: true });
    s.map.setPaintProperty('ch9-arcs-line', 'line-opacity', 0);
    setSuburbs(s, 0);
  },
  'ch9-step2': (s) => {
    s.map.flyTo({ center: [-178, -25], zoom: 2.7, pitch: 20,
                  duration: 2800, essential: true });
    s.map.setPaintProperty('ch9-arcs-line', 'line-opacity', 0.85);
  },
  'ch9-step3': (s) => {
    s.map.flyTo({ center: [174.76, -36.85], zoom: 5.2, pitch: 25,
                  duration: 3000, essential: true });
    s.map.setPaintProperty('ch9-arcs-line', 'line-opacity', 0.55);
    setSuburbs(s, 0);
  },
  'ch9-step4': (s) => {
    s.map.flyTo({ center: [174.83, -36.93], zoom: 9.4, pitch: 35,
                  duration: 3000, essential: true });
    s.map.setPaintProperty('ch9-arcs-line', 'line-opacity', 0.25);
    setSuburbs(s, 1);
  }
};
