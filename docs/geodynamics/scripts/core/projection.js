/**
 * Log-azimuthal projection (Fil, @fil/log-azimuthal).
 *
 * Used by the two D3-rendered figures that share an Auckland-centred
 * radial geometry — ch1's ancestry surfaces and ch12's two-tides flow
 * pair. The helpers below (azimuthalRaw / azimuthalInvert) live inside
 * d3-geo as private functions; d3's CDN bundle doesn't expose them, so
 * they're inlined here once and shared.
 *
 * Each consumer wraps `logAzimuthalRaw` with its own scale knobs and any
 * chapter-specific parameters (gamma, topN, etc.).
 */

const { sin, cos, asin, atan2, sqrt, acos, log, exp, PI } = Math;

/** Auckland coordinates — every Aotearoa-centred projection rotates around this. */
export const AKL = [174.762, -36.848];

function azimuthalRaw(scale) {
  return function (x, y) {
    const cx = cos(x), cy = cos(y);
    const k = scale(cx * cy);
    return [k * cy * sin(x), k * sin(y)];
  };
}

function azimuthalInvert(angle) {
  return function (x, y) {
    const z = sqrt(x * x + y * y);
    const c = angle(z);
    const sc = sin(c), cc = cos(c);
    return [atan2(x * sc, z * cc), asin(z && (y * sc) / z)];
  };
}

/** Log-azimuthal projection. `S` is the log-compression strength (higher
 *  pulls distant points inward more strongly); `B` is the clip angle in
 *  degrees from the projection centre. */
export function logAzimuthalRaw(S, B) {
  const b = B * PI / 180;
  const s = S * S;
  const factor = log(1 + s * b);
  const s_1 = s ? 1 / s : 0;
  const raw = azimuthalRaw(function (r) {
    const z = acos(r);
    return z ? log(1 + s * z) / factor / sin(z) : 1;
  });
  raw.invert = azimuthalInvert(function (a) {
    if (s === 0) return a;
    return (exp(a * factor) - 1) * s_1;
  });
  return raw;
}
