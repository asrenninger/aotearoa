/**
 * Generic SVG construction helpers used by chapter render modules.
 *
 * Chapter-specific generators (gender waffle, pop bars, ancestry surfaces)
 * live in their respective chapter files. Only utilities that are reused
 * across chapters belong here.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with the given attributes. */
export function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** A 10-column dot grid — `total` rounded squares, the first `filled`
 *  rendered in `fillColor` and the rest in `emptyColor`. Used by chapters
 *  that depict shares as pictograms (ch8 urbanisation). */
export function generateDotGrid(containerId, total, filled, fillColor, emptyColor, dotSize, gap) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const cols = 10;
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    c.appendChild(el('rect', {
      x: col * (dotSize + gap),
      y: row * (dotSize + gap),
      width: dotSize, height: dotSize,
      rx: dotSize / 4,
      fill: i < filled ? fillColor : emptyColor
    }));
  }
}
