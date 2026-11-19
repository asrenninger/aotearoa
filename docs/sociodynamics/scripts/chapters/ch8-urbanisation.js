/**
 * Chapter 8 — The welfare state & Māori urbanisation.
 *
 * Renders the two pictogram dot-grids that depict the Māori urban share
 * in 1945 (26%) and 1966 (62%). The dot-grid generator itself is a
 * generic core helper since the visual idiom is reusable.
 */

import { generateDotGrid } from '../core/svg.js';

const FILL = '#2d5a3d';   // pounamu — chapter's signature
const EMPTY = '#dcd0b4';
const DOT_SIZE = 12;
const GAP = 4;

export function render() {
  generateDotGrid('dots-1945', 100, 26, FILL, EMPTY, DOT_SIZE, GAP);
  generateDotGrid('dots-1966', 100, 62, FILL, EMPTY, DOT_SIZE, GAP);
}
