/**
 * Colour tokens shared between CSS (custom properties) and JS (Mapbox paint).
 * Keep in sync with the `:root` block in styles/frontiers.css.
 *
 * The climate atlas uses one signature colour per recurring FORCE in the
 * story — the equivalent of the migration atlas's per-wave signatures.
 * Each force keeps its colour across every map, chart, label and strip.
 */
export const PALETTE = Object.freeze({
  paper:     '#f3ecdd',
  paperDeep: '#ebe1cb',
  ink:       '#1d1610',
  inkSoft:   '#4a3d2e',
  inkFaint:  '#8a7659',
  rule:      '#c9b894',
  sea:       '#7c9d9d',

  // Force signatures — assign once, reuse everywhere.
  fire:    '#c0431f',  // volcanism — Ring of Fire, Rangitoto, Taupō, Tarawera
  quake:   '#3a342c',  // tectonics — faults, 1855, Napier, Christchurch
  carbon:  '#6b6253',  // atmosphere — CO₂, the Keeling / Baring Head record
  ozone:   '#5b4a8a',  // ozone / UV — the hole, antipodean UV, melanoma
  heat:    '#d8662f',  // warming — heatwaves, observed and projected warming
  ocean:   '#2c6479'   // sea — marine heatwave, sea-level rise
});
