/**
 * Chapter 5 — New Gold Mountain & the making of exclusion.
 *
 * Renders the single-waffle gender-imbalance figure (1881 census) into
 * the SVG slot in index.html. The other ch5 figure — the poll-tax
 * timeline — is static SVG with a CSS reveal, no JS render needed.
 */

import { el } from '../core/svg.js';

/** Gender-imbalance waffle: 5,000 person silhouettes (rounded from the
 *  5,004 census total). Men in chinese-gold; the nine women cluster in
 *  the bottom-right 3×3 corner in oxblood. Uses the <symbol id="person-glyph">
 *  defined inline in the figure's SVG. */
function renderGenderWaffle({
  containerId = 'gender-waffle',
  cols = 100,
  rows = 50,
  cellW = 7,
  cellH = 11,
  manFill = '#c9882a',
  womanFill = '#8c2230'
} = {}) {
  const c = document.getElementById(containerId);
  if (!c) return;

  // Bottom-right 3×3 cluster — 9 cells (women).
  const womenCells = new Set();
  const blockCols = 3, blockRows = 3;
  for (let r = rows - blockRows; r < rows; r++) {
    for (let col = cols - blockCols; col < cols; col++) {
      womenCells.add(r * cols + col);
    }
  }

  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const isWoman = womenCells.has(i);
    const u = el('use', {
      href: '#person-glyph',
      x: col * cellW,
      y: row * cellH,
      width: cellW - 1,
      height: cellH - 1,
      fill: isWoman ? womanFill : manFill,
      class: isWoman ? 'fig fig-woman' : 'fig fig-man'
    });
    c.appendChild(u);
  }

  // Highlight ring around the women cluster — drawn last so it sits on
  // top. Sized to enclose the 3×3 block with a small breathing margin.
  const blockX = (cols - blockCols) * cellW - 2;
  const blockY = (rows - blockRows) * cellH - 2;
  const blockW = blockCols * cellW + 2;
  const blockH = blockRows * cellH + 2;
  c.appendChild(el('rect', {
    class: 'women-cluster-ring',
    x: blockX, y: blockY, width: blockW, height: blockH,
    fill: 'none', stroke: '#8c2230', 'stroke-width': 1.2,
    'stroke-dasharray': '3 3'
  }));
}

export function render() {
  renderGenderWaffle();
}
