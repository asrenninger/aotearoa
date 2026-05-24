/**
 * Chapter 6 — Tarawera 1886 in context.
 *
 * Real data: every recorded New Zealand eruption since people arrived, plotted
 * by year and size (VEI). Tarawera's 1886 eruption (in the dataset, the
 * Okataina volcanic complex, VEI 5) is highlighted — among the country's
 * largest since settlement, matched only by the Kaharoa eruption around 1314.
 * Data: data/nz-eruptions.json (from the Smithsonian GVP / TidyTuesday set).
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const PLOT = { x: 56, y: 88, w: 704, h: 250 };
const X0 = 1000, X1 = 2020, VMAX = 6;
const FIRE = "#c0431f";

const xS = y => PLOT.x + (y - X0) / (X1 - X0) * PLOT.w;
const yS = v => PLOT.y + (1 - v / VMAX) * PLOT.h;

function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function text(p, a, c) { const n = el("text", a, p); n.textContent = c; return n; }
function jitter(i) { const x = Math.sin(i * 78.233) * 43758.5; return (x - Math.floor(x) - 0.5); }

export async function render() {
  const svg = document.getElementById("eruptions-chart");
  if (!svg) return;
  let data;
  try { data = await fetch("./data/nz-eruptions.json").then(r => r.json()); }
  catch (e) { console.warn("ch6-eruptions: load failed", e); return; }
  const er = data.eruptions.filter(d => d.year >= X0 && d.vei != null);

  text(svg, { x: 0, y: 16, class: "map-label", fill: "#8a7659" }, "New Zealand eruptions since settlement, by size");
  text(svg, { x: 0, y: 44, class: "fig-title", "font-size": 22, fill: "#1d1610" }, "Tarawera 1886 — among the largest in 700 years");

  // gridlines + y labels (VEI)
  const grid = el("g", { class: "grid-line" }, svg);
  for (let v = 0; v <= VMAX; v++) {
    const y = yS(v);
    el("line", { x1: PLOT.x, y1: y, x2: PLOT.x + PLOT.w, y2: y }, grid);
    text(svg, { x: PLOT.x - 8, y: y + 4, "text-anchor": "end", class: "axis-label" }, "VEI " + v);
  }
  el("line", { x1: PLOT.x, y1: PLOT.y, x2: PLOT.x, y2: PLOT.y + PLOT.h, class: "axis-line" }, svg);
  el("line", { x1: PLOT.x, y1: PLOT.y + PLOT.h, x2: PLOT.x + PLOT.w, y2: PLOT.y + PLOT.h, class: "axis-line" }, svg);

  // Recording bias: little is reliably dated before systematic European
  // observation (~1850). The sparse left side is under-recording, not calm —
  // only three eruptions in this set predate 1800.
  const xObs = xS(1850);
  el("rect", { x: PLOT.x, y: PLOT.y, width: xObs - PLOT.x, height: PLOT.h, fill: "#1d1610", opacity: 0.05 }, svg);
  el("line", { x1: xObs, y1: PLOT.y, x2: xObs, y2: PLOT.y + PLOT.h, stroke: "#8a7659", "stroke-width": 0.7, "stroke-dasharray": "2 3", opacity: 0.7 }, svg);

  for (const yr of [1000, 1250, 1500, 1750, 2000]) {
    const x = xS(yr);
    el("line", { x1: x, y1: PLOT.y + PLOT.h, x2: x, y2: PLOT.y + PLOT.h + 4, stroke: "#8a7659", "stroke-width": 0.5 }, svg);
    text(svg, { x, y: PLOT.y + PLOT.h + 18, "text-anchor": "middle", class: "axis-label" }, yr);
  }
  // settlement marker
  const sx = xS(1280);
  el("line", { x1: sx, y1: PLOT.y, x2: sx, y2: PLOT.y + PLOT.h, stroke: "#8a7659", "stroke-width": 0.7, "stroke-dasharray": "2 3", opacity: 0.7 }, svg);
  const sly = PLOT.y + PLOT.h - 8;
  const sLabel = el("text", { x: sx + 4, y: sly, transform: `rotate(-90, ${sx + 4}, ${sly})`,
    "text-anchor": "start", "font-family": "IBM Plex Mono", "font-size": 9.5, "letter-spacing": 1.4,
    fill: "#8a7659", stroke: "#f3ecdd", "stroke-width": 3, "stroke-linejoin": "round", "paint-order": "stroke fill" }, svg);
  sLabel.textContent = "MĀORI SETTLEMENT";

  // points
  const g = el("g", {}, svg);
  er.forEach((d, i) => {
    const big = d.vei >= 5, x = xS(d.year), y = yS(d.vei) + jitter(i) * (d.vei < 3 ? 9 : 4);
    el("circle", { cx: x, cy: y, r: 2.2 + d.vei * 1.2, fill: FIRE,
      "fill-opacity": 0.34 + d.vei * 0.10, stroke: big ? "#1d1610" : "#fff", "stroke-width": big ? 1.2 : 0.5 }, g);
  });

  // annotate the two VEI-5 events
  const mark = (year, label, dy) => {
    const hit = er.find(d => Math.abs(d.year - year) <= 6 && d.vei >= 5);
    if (!hit) return;
    const x = xS(hit.year), y = yS(hit.vei);
    el("circle", { cx: x, cy: y, r: 8, fill: "none", stroke: "#1d1610", "stroke-width": 1.2 }, svg);
    const t = el("text", { x, y: y + dy, "text-anchor": "middle", "font-family": "IBM Plex Mono",
      "font-size": 10, "letter-spacing": 0.5, fill: "#1d1610", stroke: "#f3ecdd", "stroke-width": 3, "paint-order": "stroke fill" }, svg);
    t.textContent = label;
  };
  mark(1886, "1886 · TARAWERA", -16);
  mark(1314, "1314 · KAHAROA", -16);

  // Annotation explaining the sparse early record (placed clear of the
  // settlement marker and the Kaharoa callout, in the open right of the band).
  const sparseMid = (xS(1340) + xObs) / 2;
  for (const [dy, txt] of [[16, "FEW ERUPTIONS RECORDED"], [29, "BEFORE EUROPEAN OBSERVATION"]]) {
    const a = el("text", { x: sparseMid, y: PLOT.y + dy, "text-anchor": "middle", "font-family": "IBM Plex Mono",
      "font-size": 9.5, "letter-spacing": 1, fill: "#8a7659", stroke: "#f3ecdd", "stroke-width": 3, "paint-order": "stroke fill" }, svg);
    a.textContent = txt;
  }

  el("line", { x1: 0, y1: PLOT.y + PLOT.h + 36, x2: 800, y2: PLOT.y + PLOT.h + 36, stroke: "#c9b894", "stroke-width": 0.5 }, svg);
  text(svg, { x: 0, y: PLOT.y + PLOT.h + 54, class: "map-label", fill: "#8a7659" },
    "Source: Smithsonian GVP");
}
