/**
 * Colour tokens shared between CSS (custom properties) and JS (Mapbox paint).
 * Keep in sync with the `:root` block in styles/frontiers.css.
 */
export const PALETTE = Object.freeze({
  paper:     '#f3ecdd',
  paperDeep: '#ebe1cb',
  ink:       '#1d1610',
  inkSoft:   '#4a3d2e',
  inkFaint:  '#8a7659',
  rule:      '#c9b894',
  sea:       '#7c9d9d',
  // Per-wave colours — each migration story gets a signature.
  // Mapped to Māori pigments (tukutuku / kōwhaiwhai) where meaning aligns;
  // see styles/frontiers.css :root and context/migration/maori-strips.html.
  poly:    '#2c6479',  // aumoana — southern sea-clay blue (Polynesian voyaging)
  british: '#a8442d',  // kokowai — red ochre (settler colonisation, NZSA)
  chinese: '#d4a316',  // pīngao — sand-sedge yellow (gold rush)
  pacific: '#cc5e3f',  // coral — no direct Māori equivalent (Pasifika labour)
  asian:   '#6b3a82',  // violet — no direct Māori equivalent (post-1991 Asian)
  maori:   '#2d6e4d'   // pounamu — greenstone (Māori-held land)
});
