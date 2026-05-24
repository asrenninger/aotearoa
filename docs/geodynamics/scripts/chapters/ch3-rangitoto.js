/**
 * Chapter 3 — Rangitoto, the new island.
 *
 * A bespoke staged animation (not a chart, not a map): a geological
 * cross-section of Rangitoto's birth. Each eruption deposits a discrete bell-
 * shaped LOBE at the vent; the cone surface at any moment is the running max of
 * all deposited lobes, sitting on the real Gulf seafloor. Older lobes survive
 * as onion-skin outlines inside the cone — the stratigraphy of a real volcanic
 * section. A summit caldera is then carved out of the top. Alongside, callouts
 * mark the milestones, an event rail ticks off each eruption, and a Motutapu
 * inset stacks a layer of ash per pulse with the witnessed footprint sealed
 * between two of them.
 *
 * Ported from a React/Babel prototype into the atlas's vanilla idiom: the SVG
 * shell lives in index.html (#rangitoto); this module builds the static layers
 * once, then runs a single requestAnimationFrame pass when the figure first
 * scrolls into view. Plays once. Honours prefers-reduced-motion by jumping
 * straight to the settled final frame.
 */

// ── colour tokens (kept in sync with core/palette.js + frontiers.css) ──────
const FIRE = '#c0431f';   // volcanism — the cone
const INK = '#1d1610';
const INK_SOFT = '#4a3d2e';
const INK_FAINT = '#8a7659';
const RULE = '#c9b894';
const OCEAN = '#2c6479';
const LIGHT = '#f6efde';   // outlines / inset paper — a touch brighter than the page
const BEDROCK = '#3a342c';
const LAND_TAN = '#a37c44'; // subaerial bedrock above sea level / Motutapu
const SOIL = '#5a4530';
const TOPSOIL = '#7a5a35';

// ── easing + tween helpers (the subset the scene uses) ─────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOutCubic = (t) => (--t) * t * t + 1;
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

// Returns `from` before `start`, `to` after `end`, eased in between.
function animate({ from = 0, to = 1, start = 0, end = 1, ease = easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

// ── canvas + axes geometry ─────────────────────────────────────────────────
// The SVG viewBox (1400×900, set in index.html) is cropped tight to the
// content; the diagram sits inside PLOT.
const PLOT = { x0: 96, x1: 1240, y0: 116, y1: 810 };
const PLOT_W = PLOT.x1 - PLOT.x0;
const PLOT_H = PLOT.y1 - PLOT.y0;

const Y_TOP_M = 300, Y_BOTTOM_M = -100;
const Y_RANGE = Y_TOP_M - Y_BOTTOM_M;
const X_LEFT_KM = 0, X_RIGHT_KM = 7;
const X_RANGE = X_RIGHT_KM - X_LEFT_KM;

const yPx = (m) => PLOT.y0 + ((Y_TOP_M - m) / Y_RANGE) * PLOT_H;
const xPx = (km) => PLOT.x0 + ((km - X_LEFT_KM) / X_RANGE) * PLOT_W;

const VENT_KM = 2.4;

// ── land profile: bathymetry + Motutapu in one curve ───────────────────────
const LAND_PROFILE = [
  [0.00, -34], [0.60, -36], [1.40, -34], [2.00, -32],
  [2.40, -32], [3.00, -31], [3.80, -28], [4.40, -22],
  [4.70, -10], [4.95,   0], [5.20,  35], [5.55,  80],
  [5.90, 115], [6.20, 108], [6.55,  80], [6.85,  40],
  [7.00,   8],
];

// Catmull-Rom interpolation on Y between p1 and p2 (uniform parameterisation).
function catmullRomY(u, y0, y1, y2, y3) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (
    (2 * y1) +
    (-y0 + y2) * u +
    (2 * y0 - 5 * y1 + 4 * y2 - y3) * u2 +
    (-y0 + 3 * y1 - 3 * y2 + y3) * u3
  );
}

function seafloorAt(xKm) {
  const n = LAND_PROFILE.length;
  if (xKm <= LAND_PROFILE[0][0]) return LAND_PROFILE[0][1];
  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = LAND_PROFILE[i];
    const [x2, y2] = LAND_PROFILE[i + 1];
    if (xKm >= x1 && xKm <= x2) {
      const y0 = LAND_PROFILE[Math.max(0, i - 1)][1];
      const y3 = LAND_PROFILE[Math.min(n - 1, i + 2)][1];
      const u = (xKm - x1) / (x2 - x1);
      return catmullRomY(u, y0, y1, y2, y3);
    }
  }
  return LAND_PROFILE[n - 1][1];
}

// Densely sampled smooth land surface — used by the Land path.
function smoothLandPoints(samples) {
  const pts = [];
  const xL = LAND_PROFILE[0][0];
  const xR = LAND_PROFILE[LAND_PROFILE.length - 1][0];
  for (let i = 0; i <= samples; i++) {
    const x = xL + (i / samples) * (xR - xL);
    pts.push([x, seafloorAt(x)]);
  }
  return pts;
}

// ── eruption events ─────────────────────────────────────────────────────────
// Each event deposits a bell-shaped lobe at (cx) of given width and peak.
// Three stylised phases: submarine → subaerial shield-build → summit cone.
const ERUPTIONS = [
  // Submarine — builds a mound on the sea floor
  { t: 1.6, cx: 2.42, top:  -22, width: 0.40 },
  { t: 2.3, cx: 2.38, top:  -10, width: 0.55 },
  { t: 3.0, cx: 2.43, top:    2, width: 0.70 }, // pierces sea level
  // Surtseyan / early subaerial
  { t: 3.8, cx: 2.40, top:   30, width: 0.85 },
  { t: 4.6, cx: 2.45, top:   65, width: 1.05 },
  // Shield-building — flows spread far
  { t: 5.4, cx: 2.32, top:   95, width: 1.35 },
  { t: 6.2, cx: 2.50, top:  130, width: 1.65 },
  { t: 7.0, cx: 2.30, top:  160, width: 1.90 },
  { t: 7.8, cx: 2.45, top:  185, width: 2.05 },
  // Final phase — broad convex roundings; caldera then carved from the top.
  { t: 8.6, cx: 2.40, top:  275, width: 1.95 },
  { t: 9.4, cx: 2.42, top:  298, width: 1.70 },
  { t: 10.2, cx: 2.40, top: 312, width: 1.50 },
];

const FINAL_T = 10.2;
const SETTLE = 0.55;            // seconds each lobe takes to settle in
const END = 13.0;              // playhead end — everything settled + a beat

// ── caldera ─────────────────────────────────────────────────────────────────
// After the final lobe settles, a central crater is carved into the top.
const CALDERA = {
  start: FINAL_T + SETTLE + 0.15,
  settle: 1.1,
  depth: 52,    // metres of depression at centre
  width: 0.48,  // half-width in km
};

function calderaCarveAt(xKm, t) {
  if (CALDERA.depth <= 0) return 0;
  const prog = clamp((t - CALDERA.start) / CALDERA.settle, 0, 1);
  if (prog <= 0) return 0;
  const eased = easeOutCubic(prog);
  const d = (xKm - VENT_KM) / CALDERA.width;
  if (Math.abs(d) > 1.25) return 0;
  const bell = Math.max(0, Math.exp(-d * d * 2.6) - 0.030);
  return CALDERA.depth * eased * bell;
}

// height contributed by a single eruption at the given x and time
function lobeHeight(xKm, e, t) {
  if (t < e.t) return -Infinity;
  const age = clamp((t - e.t) / SETTLE, 0, 1);
  const eased = easeOutCubic(age);
  const d = (xKm - e.cx) / e.width;
  if (Math.abs(d) > 1.15) return -Infinity;
  const bell = Math.max(0, Math.exp(-d * d * 3.0) - 0.022);
  const sf = seafloorAt(xKm);
  const target = e.top - sf;
  return sf + target * bell * eased;
}

// cumulative cone surface at (x, t)
function coneHeightAt(xKm, t) {
  let h = -Infinity;
  for (const e of ERUPTIONS) {
    if (e.t > t) break;
    const lh = lobeHeight(xKm, e, t);
    if (lh > h) h = lh;
  }
  if (h !== -Infinity) {
    const carve = calderaCarveAt(xKm, t);
    if (carve > 0) h = Math.max(seafloorAt(xKm), h - carve);
  }
  return h;
}

// filled-cone path — bottom follows the seafloor exactly. Null until raised.
function conePath(t) {
  const samples = 140, xLeft = 0.20, xRight = 4.70;
  const points = [];
  let any = false;
  for (let i = 0; i <= samples; i++) {
    const x = xLeft + (i / samples) * (xRight - xLeft);
    const h = coneHeightAt(x, t);
    const sf = seafloorAt(x);
    const y = (h !== -Infinity && h > sf) ? h : sf;
    points.push({ x, y });
    if (y > sf + 0.05) any = true;
  }
  if (!any) return null;
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    d += (i === 0 ? 'M ' : 'L ') + xPx(p.x).toFixed(2) + ' ' + yPx(p.y).toFixed(2) + ' ';
  }
  for (let i = points.length - 1; i >= 0; i--) {
    d += 'L ' + xPx(points[i].x).toFixed(2) + ' ' + yPx(seafloorAt(points[i].x)).toFixed(2) + ' ';
  }
  return d + 'Z';
}

// just the top line at a given moment (for the onion-skin past surfaces)
function coneTopLine(atTime) {
  const samples = 100, xLeft = 0.20, xRight = 4.70;
  let d = '', started = false;
  for (let i = 0; i <= samples; i++) {
    const x = xLeft + (i / samples) * (xRight - xLeft);
    const h = coneHeightAt(x, atTime);
    const sf = seafloorAt(x);
    const y = (h !== -Infinity && h > sf) ? h : sf;
    d += (started ? 'L ' : 'M ') + xPx(x).toFixed(2) + ' ' + yPx(y).toFixed(2) + ' ';
    started = true;
  }
  return d;
}

// Onion-skin lines are snapshots taken just after each lobe settles. No lobe
// settles after the caldera begins to carve, so each line is constant once
// born — precompute them all up front.
const ONION = ERUPTIONS.map((e) => ({
  settledAt: e.t + SETTLE,
  d: coneTopLine(e.t + SETTLE),
}));

// ── milestone callouts ──────────────────────────────────────────────────────
const MILESTONES = [
  { appearAt: 1.6, fadeStart: 4.0, label: 'Vent opens on the sea floor',
    targetKm: VENT_KM, targetM: -28, offX: -64, offY: 78, color: LIGHT },
  { appearAt: 3.0, fadeStart: 8.5, label: 'Cone reaches the surface',
    targetKm: VENT_KM, targetM: 4, offX: 195, offY: -195 },
  { appearAt: 10.3, fadeStart: 999, label: 'Crater rim · 260 m',
    targetKm: 2.83, targetM: 250, offX: 90, offY: -85 },
];

// ── ash inset geometry (upper-right of the plot, above Motutapu) ─────────────
const ASH = {
  ix: xPx(4.85), iy: yPx(280),
  iw: xPx(6.95) - xPx(4.85), ih: yPx(140) - yPx(280),
  padTop: 32, padBot: 14, padSide: 12,
};
ASH.groundY = ASH.ih - ASH.padBot;
ASH.skyTop = ASH.padTop;
const BAND_INDICES = [0, 2, 4, 6, 8, 10];   // one visible layer per other eruption
const BAND_THICK = 8;
const FOOT_BAND_IDX = 4;

// ── string helpers ──────────────────────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'Fraunces', serif";
const f2 = (n) => n.toFixed(2);

// Label sizes — tuned so the figure reads at column width (≈840 px, like the
// other charts) given the 1400-wide viewBox.
const FS = {
  over: 18, axis: 20, sea: 19, place: 20, floor: 17, rail: 17,
  milestone: 26, ashHead: 16, footLab: 14, footSub: 11, title: 36,
};

// Eruption rail geometry. Rather than an even cadence, the pulses cluster into
// the two real build phases — an early phase (~1400 CE) and the larger
// shield-and-summit phase (~1450 CE) — with a gap between, so the rail reads
// as two episodes rather than a regular metronome.
const RAIL = { y: PLOT.y1 + 64, x0: xPx(0.2), x1: xPx(6.8) };
const PHASE_SPLIT = 5;  // ERUPTIONS[0..4] = phase one; [5..] = phase two
function railX(i) {
  const span = RAIL.x1 - RAIL.x0;
  if (i < PHASE_SPLIT) return RAIL.x0 + (0.02 + (i / (PHASE_SPLIT - 1)) * 0.30) * span;
  const k = (i - PHASE_SPLIT) / (ERUPTIONS.length - 1 - PHASE_SPLIT);
  return RAIL.x0 + (0.56 + k * 0.42) * span;
}

// ── static layers (built once) ──────────────────────────────────────────────
function buildStatic() {
  let s = '';

  // figure title — mono subtitle over a Fraunces headline, like the other charts
  s += `<text class="map-label" x="${PLOT.x0 - 14}" y="32" font-size="${FS.over}">AUCKLAND VOLCANIC FIELD · HAURAKI GULF</text>`;
  s += `<text x="${PLOT.x0 - 16}" y="76" font-family="${SERIF}" font-style="italic" font-weight="400" font-size="${FS.title}" fill="${INK}">Rangitoto rises</text>`;

  // ----- axes, grid, sea wash -----
  const ticks = [];
  for (let m = -100; m <= 300; m += 50) ticks.push(m);

  s += `<rect x="${PLOT.x0}" y="${f2(yPx(0))}" width="${PLOT_W}" height="${f2(yPx(-100) - yPx(0))}" fill="${OCEAN}" opacity="0.05"/>`;
  for (const m of ticks) {
    if (m === 0) continue;
    s += `<line x1="${PLOT.x0}" y1="${f2(yPx(m))}" x2="${PLOT.x1}" y2="${f2(yPx(m))}" stroke="${RULE}" stroke-width="0.5" stroke-dasharray="2 5"/>`;
  }
  // chunky sea-level rule
  s += `<line x1="${PLOT.x0 - 14}" y1="${f2(yPx(0))}" x2="${PLOT.x1 + 14}" y2="${f2(yPx(0))}" stroke="${INK}" stroke-width="2"/>`;
  for (const m of ticks) {
    const lab = m === 0 ? '0 m' : (m > 0 ? `+${m} m` : `${m} m`);
    s += `<line x1="${PLOT.x0 - 8}" y1="${f2(yPx(m))}" x2="${PLOT.x0 - 2}" y2="${f2(yPx(m))}" stroke="${INK}" stroke-width="${m === 0 ? 1.4 : 0.7}"/>`;
    s += `<text x="${PLOT.x0 - 14}" y="${f2(yPx(m) + 4)}" text-anchor="end" font-family="${MONO}" font-size="${FS.axis}" fill="${m === 0 ? INK : INK_FAINT}" font-weight="${m === 0 ? 500 : 400}">${lab}</text>`;
  }
  s += `<text x="${PLOT.x1 + 18}" y="${f2(yPx(0) - 6)}" font-family="${MONO}" font-size="${FS.sea}" fill="${INK}" letter-spacing="2.5">SEA LEVEL</text>`;
  // Section base line. The horizontal (distance) axis is intentionally omitted —
  // there are no ticks or axis title: the across-section scale isn't the point.
  s += `<line x1="${PLOT.x0}" y1="${PLOT.y1}" x2="${PLOT.x1}" y2="${PLOT.y1}" stroke="${INK}" stroke-width="0.8"/>`;

  // ----- bedrock + Motutapu -----
  const pts = smoothLandPoints(220);
  const xL = pts[0][0], xR = pts[pts.length - 1][0];
  let dFill = `M ${f2(xPx(xL))} ${f2(yPx(-100))}`;
  for (const [x, y] of pts) dFill += ` L ${f2(xPx(x))} ${f2(yPx(y))}`;
  dFill += ` L ${f2(xPx(xR))} ${f2(yPx(-100))} Z`;
  let dLine = '';
  pts.forEach(([x, y], i) => { dLine += (i === 0 ? 'M ' : 'L ') + f2(xPx(x)) + ' ' + f2(yPx(y)) + ' '; });

  s += `<defs><clipPath id="rt-above-sea"><rect x="${PLOT.x0}" y="${PLOT.y0}" width="${PLOT_W}" height="${f2(yPx(0) - PLOT.y0)}"/></clipPath></defs>`;
  s += `<path d="${dFill}" fill="${BEDROCK}"/>`;
  s += `<path d="${dFill}" fill="${LAND_TAN}" clip-path="url(#rt-above-sea)"/>`;
  s += `<path d="${dLine}" fill="none" stroke="${LIGHT}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
  s += `<text x="${f2(xPx(5.95))}" y="${f2(yPx(115) - 12)}" text-anchor="middle" font-family="${MONO}" font-size="${FS.place}" fill="${INK}" letter-spacing="2.5">MOTUTAPU</text>`;
  s += `<text x="${f2(xPx(1.0))}" y="${f2(yPx(-34) + 16)}" font-family="${MONO}" font-size="${FS.floor}" fill="${RULE}" letter-spacing="2.4">GULF SEA FLOOR · BEDROCK</text>`;

  // ----- eruption-event rail: two build phases (~1400, ~1450), spikes dynamic -----
  const c1 = railX(2), c2 = railX(8), gap = (railX(PHASE_SPLIT - 1) + railX(PHASE_SPLIT)) / 2;
  s += `<line x1="${f2(RAIL.x0)}" y1="${RAIL.y}" x2="${f2(RAIL.x1)}" y2="${RAIL.y}" stroke="${RULE}" stroke-width="0.6"/>`;
  s += `<text x="${f2(c1)}" y="${RAIL.y + 24}" text-anchor="middle" font-family="${MONO}" font-size="${FS.rail}" fill="${INK_FAINT}" letter-spacing="1.5">c. 1400</text>`;
  s += `<text x="${f2(gap)}" y="${RAIL.y + 24}" text-anchor="middle" font-family="${MONO}" font-size="${FS.rail}" fill="${INK_FAINT}" letter-spacing="1.5">ERUPTIVE PULSES</text>`;
  s += `<text x="${f2(c2)}" y="${RAIL.y + 24}" text-anchor="middle" font-family="${MONO}" font-size="${FS.rail}" fill="${INK_FAINT}" letter-spacing="1.5">c. 1450</text>`;

  // ----- ash inset chrome (panel, header, soil, grass; bands are dynamic) -----
  const { ix, iy, iw, ih, padSide, skyTop, groundY } = ASH;
  s += `<line x1="${f2(xPx(5.95))}" y1="${f2(yPx(115) - 22)}" x2="${f2(xPx(5.95))}" y2="${f2(iy + ih + 2)}" stroke="${RULE}" stroke-width="0.6" stroke-dasharray="2 3"/>`;
  s += `<rect x="${f2(ix)}" y="${f2(iy)}" width="${f2(iw)}" height="${f2(ih)}" fill="${LIGHT}" stroke="${RULE}" stroke-width="0.8"/>`;
  s += `<text x="${f2(ix + padSide)}" y="${f2(iy + 16)}" font-family="${MONO}" font-size="${FS.ashHead}" fill="${INK_FAINT}" letter-spacing="2.4">ASH ON MOTUTAPU</text>`;
  s += `<g transform="translate(${f2(ix)},${f2(iy)})">`;
  s += `<defs><clipPath id="rt-ash-clip"><rect x="${padSide}" y="${skyTop + 8}" width="${f2(iw - padSide * 2)}" height="${f2(ih - skyTop - 8 - 2)}"/></clipPath></defs>`;
  s += `<g clip-path="url(#rt-ash-clip)">`;
  s += `<rect x="0" y="${f2(groundY + 4)}" width="${f2(iw)}" height="${f2(ih - groundY - 4)}" fill="${SOIL}"/>`;
  s += `<rect x="0" y="${f2(groundY - 4)}" width="${f2(iw)}" height="8" fill="${TOPSOIL}"/>`;
  for (const m of [0.12, 0.28, 0.46, 0.66, 0.82]) {
    s += `<line x1="${f2(m * iw)}" y1="${f2(groundY - 4)}" x2="${f2(m * iw + 1.2)}" y2="${f2(groundY - 8)}" stroke="#3a4a20" stroke-width="0.6"/>`;
  }
  s += `</g></g>`;

  return s;
}

// ── dynamic layer (rebuilt each frame) ──────────────────────────────────────
function buildDynamic(t) {
  let s = '';

  // ----- cone: fill + onion-skin (clipped) + outline -----
  const live = conePath(t);
  if (live) {
    s += `<defs><clipPath id="rt-cone-shape"><path d="${live}"/></clipPath></defs>`;
    s += `<path d="${live}" fill="${FIRE}"/>`;
    s += `<g clip-path="url(#rt-cone-shape)">`;
    for (const o of ONION) {
      if (o.settledAt > t - 0.05) break;
      s += `<path d="${o.d}" fill="none" stroke="${LIGHT}" stroke-width="0.7" opacity="0.32"/>`;
    }
    s += `</g>`;
    s += `<path d="${live}" fill="none" stroke="${LIGHT}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`;
  }

  // ----- milestone callouts -----
  for (const m of MILESTONES) {
    const oIn = animate({ start: m.appearAt, end: m.appearAt + 0.45 })(t);
    const oOut = animate({ start: m.fadeStart, end: m.fadeStart + 0.6 })(t);
    const opacity = oIn * (1 - oOut);
    if (opacity < 0.01) continue;
    const tx = xPx(m.targetKm), ty = yPx(m.targetM);
    const lx = tx + m.offX, ly = ty + m.offY;
    const anchor = m.offX < 0 ? 'end' : 'start';
    const textX = lx + (anchor === 'end' ? -8 : 8);
    const col = m.color || INK;
    s += `<g opacity="${opacity.toFixed(3)}">`;
    s += `<line x1="${f2(tx)}" y1="${f2(ty)}" x2="${f2(lx)}" y2="${f2(ly)}" stroke="${col}" stroke-width="0.7"/>`;
    s += `<circle cx="${f2(tx)}" cy="${f2(ty)}" r="3" fill="${FIRE}" stroke="${col}" stroke-width="0.8"/>`;
    s += `<text x="${f2(textX)}" y="${f2(ly + 4)}" text-anchor="${anchor}" font-family="${SERIF}" font-style="italic" font-size="${FS.milestone}" fill="${col}">${m.label}</text>`;
    s += `</g>`;
  }

  // ----- eruption-event spikes (clustered into the two phases via railX) -----
  ERUPTIONS.forEach((e, i) => {
    if (t < e.t) return;
    const x = railX(i);
    const elapsed = Math.max(0, t - e.t);
    const opacity = Math.min(1, elapsed / 0.25);
    const spike = Math.max(0, 1 - elapsed / 0.55);
    s += `<line x1="${f2(x)}" y1="${f2(RAIL.y - 10 - spike * 14)}" x2="${f2(x)}" y2="${RAIL.y + 8}" stroke="${FIRE}" stroke-width="${(1.8 + spike * 1.4).toFixed(2)}" opacity="${opacity.toFixed(3)}"/>`;
  });

  // ----- ash inset: bands + footprint + callout -----
  const { ix, iy, iw, padSide, groundY } = ASH;
  const bands = [];
  let cum = 0;
  for (const idx of BAND_INDICES) {
    const settledAt = ERUPTIONS[idx].t + SETTLE;
    const grow = clamp((t - settledAt) / 0.45, 0, 1);
    if (grow <= 0) continue;
    const thisH = BAND_THICK * grow;
    bands.push({
      idx, top: groundY - cum - thisH, bottom: groundY - cum,
      shade: idx % 4 === 0 ? '#c9bda0' : '#a59679',
    });
    cum += thisH;
  }
  const footBand = bands.find((b) => b.idx === FOOT_BAND_IDX);
  const footAppearAt = ERUPTIONS[FOOT_BAND_IDX].t + SETTLE + 0.2;
  const footO = animate({ start: footAppearAt, end: footAppearAt + 0.35 })(t);
  const labelO = animate({ start: footAppearAt + 0.15, end: footAppearAt + 0.7 })(t);

  s += `<g transform="translate(${f2(ix)},${f2(iy)})">`;
  s += `<g clip-path="url(#rt-ash-clip)">`;
  for (const b of bands) {
    s += `<rect x="0" y="${f2(b.top)}" width="${f2(iw)}" height="${f2(b.bottom - b.top)}" fill="${b.shade}"/>`;
  }
  if (footBand && footO > 0.01) {
    s += `<rect x="${f2(iw * 0.42)}" y="${f2(footBand.top)}" width="${f2(iw * 0.18)}" height="${f2(footBand.bottom - footBand.top)}" fill="${INK}" opacity="${footO.toFixed(3)}"/>`;
  }
  s += `</g>`;
  if (footBand && labelO > 0.01) {
    const slabRight = iw * 0.42 + iw * 0.18;
    const slabMidY = (footBand.top + footBand.bottom) / 2;
    const labelX = slabRight + 6;
    s += `<g opacity="${labelO.toFixed(3)}">`;
    s += `<rect x="${f2(labelX - 4)}" y="${f2(slabMidY - 15)}" width="110" height="30" fill="${LIGHT}" opacity="0.88" rx="2"/>`;
    s += `<line x1="${f2(slabRight - 1)}" y1="${f2(slabMidY)}" x2="${f2(labelX - 2)}" y2="${f2(slabMidY)}" stroke="${FIRE}" stroke-width="0.8"/>`;
    s += `<text x="${f2(labelX)}" y="${f2(slabMidY - 1)}" font-family="${MONO}" font-size="${FS.footLab}" font-weight="500" fill="${FIRE}" letter-spacing="1.6">FOOTPRINT</text>`;
    s += `<text x="${f2(labelX)}" y="${f2(slabMidY + 11)}" font-family="${MONO}" font-size="${FS.footSub}" fill="${FIRE}" letter-spacing="1.2">sealed in ash</text>`;
    s += `</g>`;
  }
  s += `</g>`;

  return s;
}

// ── render + play-once harness ──────────────────────────────────────────────
export function render() {
  const fig = document.querySelector('.rangitoto-fig');
  if (!fig) return;
  const svg = fig.querySelector('svg');
  if (!svg) return;

  // Build the static layers once; the dynamic layer fills in per frame.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const staticG = document.createElementNS(SVGNS, 'g');
  staticG.innerHTML = buildStatic();
  const dynG = document.createElementNS(SVGNS, 'g');
  svg.append(staticG, dynG);

  const frame = (t) => { dynG.innerHTML = buildDynamic(t); };
  frame(0);   // pre-eruption cross-section, shown until the figure scrolls in

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let played = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting || played) return;
      played = true;
      io.disconnect();
      if (reduce) { frame(END); return; }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(END, (now - start) / 1000);
        frame(t);
        if (t < END) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.35 });
  io.observe(fig);
}
