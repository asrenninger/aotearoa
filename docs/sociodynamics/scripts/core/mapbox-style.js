/**
 * Paper-toned Mapbox style.
 *
 * No roads, no POI, no place labels for non-settlements — we want the
 * built environment to disappear so the historical overlays carry the
 * narrative. Only land, water, country/state borders, and city labels.
 *
 * Fonts: Open Sans only. DIN Pro is hosted by Mapbox but the public
 * glyph endpoint returns 404 for `DIN Pro Italic`, which silently
 * blocks the `load` event for any map that uses italic symbol layers.
 */

import { PALETTE } from './palette.js';

// Mapbox public (pk.*) tokens ship in the browser; protection is the URL
// restriction set in the Mapbox dashboard, not secrecy. This deployed build
// hard-codes ONLY the token restricted to the asrenninger.github.io domain, so
// the unrestricted dev token is never published. Local development uses the dev
// token via the source site (context/migration), not this build.
export const MAPBOX_TOKEN =
  'pk.eyJ1IjoiYXNyZW5uaW5nZXIiLCJhIjoiY2szMGV1OG9jMDM4aTNkbnphNXpzcm1wYyJ9.UnnfQkiXT3y4ALqIjzHnNw';

export function makePaperStyle() {
  return {
    version: 8,
    sources: {
      composite: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' }
    },
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background', type: 'background',
        paint: { 'background-color': PALETTE.paper }
      },
      {
        id: 'water', type: 'fill', source: 'composite', 'source-layer': 'water',
        paint: { 'fill-color': PALETTE.sea, 'fill-opacity': 0.22 }
      },
      {
        id: 'admin-1', type: 'line', source: 'composite', 'source-layer': 'admin',
        filter: ['all',
          ['==', ['get', 'admin_level'], 1],
          ['!=', ['get', 'maritime'], 'true']
        ],
        paint: {
          'line-color': PALETTE.inkFaint,
          'line-width': 0.4,
          'line-opacity': 0.30,
          'line-dasharray': [3, 3]
        }
      },
      {
        id: 'admin-0', type: 'line', source: 'composite', 'source-layer': 'admin',
        filter: ['all',
          ['==', ['get', 'admin_level'], 0],
          ['!=', ['get', 'maritime'], 'true']
        ],
        paint: { 'line-color': PALETTE.inkSoft, 'line-width': 0.6, 'line-opacity': 0.55 }
      },
      {
        id: 'place-country', type: 'symbol', source: 'composite', 'source-layer': 'place_label',
        filter: ['==', ['get', 'class'], 'country'],
        maxzoom: 5,
        layout: {
          'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
          'text-font': ['Open Sans Italic', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-letter-spacing': 0.18,
          'text-max-width': 6
        },
        paint: {
          'text-color': PALETTE.inkSoft,
          'text-halo-color': PALETTE.paper,
          'text-halo-width': 1.2,
          'text-opacity': 0.55
        }
      },
      {
        id: 'place-settlement', type: 'symbol', source: 'composite', 'source-layer': 'place_label',
        filter: ['==', ['get', 'class'], 'settlement'],
        minzoom: 4, maxzoom: 14,
        layout: {
          'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 10, 13],
          'text-padding': 4
        },
        paint: {
          'text-color': PALETTE.ink,
          'text-halo-color': PALETTE.paper,
          'text-halo-width': 1.2,
          'text-opacity': 0.7
        }
      }
    ]
  };
}

/** Apply a paper-toned fog (only visible in globe projection). */
export function applyPaperFog(map) {
  if (!map.setFog) return;
  map.setFog({
    'horizon-blend': 0.05,
    'color': PALETTE.paper,
    'high-color': PALETTE.sea,
    'space-color': PALETTE.paperDeep,
    'star-intensity': 0
  });
}
