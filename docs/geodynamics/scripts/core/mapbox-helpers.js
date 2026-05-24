/**
 * Geographic and geometric helpers used by the map chapters.
 *
 * We intentionally do NOT depend on turf.js — these tiny implementations
 * cover everything the project needed (great-circle, perpendicular offset,
 * polygon smoothing, antimeridian-aware funnel polygons) at a fraction of
 * the bundle size.
 */

// ---------------------------------------------------------------------------
// GeoJSON wrappers
// ---------------------------------------------------------------------------

/** Wrap an array of `{ name, coords }` into a Point FeatureCollection. */
export function pointFC(features) {
  return {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      properties: { name: f.name },
      geometry: { type: 'Point', coordinates: f.coords }
    }))
  };
}

/** Wrap an array of `{ from, to, id }` into a LineString FeatureCollection of great-circles. */
export function arcFC(arcs, npoints = 100) {
  return {
    type: 'FeatureCollection',
    features: arcs.map(a => ({
      type: 'Feature',
      properties: { id: a.id },
      geometry: { type: 'LineString', coordinates: greatCirclePoints(a.from, a.to, npoints) }
    }))
  };
}

// ---------------------------------------------------------------------------
// Spherical geometry
// ---------------------------------------------------------------------------

/**
 * Great-circle interpolation between two lng/lat points, returning a
 * continuous run of [lng, lat] coords. Longitudes are unwrapped so that
 * adjacent points differ by ≤180° — the resulting array can extend past
 * ±180 if the path crosses the antimeridian. (Mapbox's globe projection
 * handles that natively; the antimeridian funnel splitter below also
 * relies on it.)
 *
 * Replaces turf.greatCircle, which split antimeridian-crossing paths into
 * a MultiLineString and broke our funnel polygon construction.
 */
export function greatCirclePoints(start, end, n = 100) {
  let [lon1, lat1] = start;
  let [lon2, lat2] = end;
  // Walk the shortest longitudinal direction
  const dLonRaw = lon2 - lon1;
  if (dLonRaw >  180) lon2 -= 360;
  if (dLonRaw < -180) lon2 += 360;

  const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
  const lam1 = lon1 * Math.PI / 180, lam2 = lon2 * Math.PI / 180;

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((phi2 - phi1) / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin((lam2 - lam1) / 2) ** 2
  ));
  if (!isFinite(d) || d === 0) return [[lon1, lat1], [lon2, lat2]];

  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d)       / Math.sin(d);
    const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
    const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
    const z = A * Math.sin(phi1)                  + B * Math.sin(phi2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    const lon = Math.atan2(y, x) * 180 / Math.PI;
    out.push([lon, lat]);
  }

  // atan2 clamps output to [-180, 180]; unwrap so consecutive points stay
  // continuous. Without this, antimeridian crossings produce a 360° jump
  // that makes downstream polygon construction render the long way.
  for (let i = 1; i < out.length; i++) {
    const dLon = out[i][0] - out[i - 1][0];
    if      (dLon >  180) out[i][0] -= 360;
    else if (dLon < -180) out[i][0] += 360;
  }
  return out;
}

/** Initial bearing from p1 to p2 in degrees (0 = N, 90 = E). */
export function bearingDeg(p1, p2) {
  const phi1 = p1[1] * Math.PI / 180, phi2 = p2[1] * Math.PI / 180;
  const dLam = (p2[0] - p1[0]) * Math.PI / 180;
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Move from a [lng, lat] point in a given bearing for a given distance (km). */
export function destinationPoint(p, distanceKm, bearingDegrees) {
  const R = 6371;                      // earth radius km
  const d = distanceKm / R;
  const br = bearingDegrees * Math.PI / 180;
  const phi1 = p[1] * Math.PI / 180;
  const lam1 = p[0] * Math.PI / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(d) +
                         Math.cos(phi1) * Math.sin(d) * Math.cos(br));
  const lam2 = lam1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(phi1),
                                 Math.cos(d) - Math.sin(phi1) * Math.sin(phi2));
  return [lam2 * 180 / Math.PI, phi2 * 180 / Math.PI];
}

// ---------------------------------------------------------------------------
// Polygon smoothing
// ---------------------------------------------------------------------------

/**
 * Catmull–Rom interpolation through a closed polygon ring, returning a
 * denser ring whose corners are smoothed into bezier-like curves.
 *
 * Used to render hand-drawn confiscation/raupatu zones as indicative
 * blobs rather than fake-precise jagged polygons.
 */
export function smoothRing(ring, samples = 12) {
  const closed = ring.length > 1 &&
                 ring[0][0] === ring[ring.length - 1][0] &&
                 ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
                       (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
                       (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  out.push(out[0]);
  return out;
}

/** Apply smoothRing to every ring in a Polygon Feature. */
export function smoothPolygonFeature(feature, samples = 12) {
  return {
    type: 'Feature',
    properties: feature.properties,
    geometry: {
      type: 'Polygon',
      coordinates: feature.geometry.coordinates.map(ring => smoothRing(ring, samples))
    }
  };
}

/**
 * Centroid-pull inward offset on a polygon ring.
 *
 * For each vertex, move it a fraction `factor` of the way toward the
 * centroid (factor=0 ⇒ unchanged; factor=1 ⇒ collapsed to centroid).
 * This is a fast, dependency-free approximation of a true geometric
 * inward buffer — it works well for smooth convex/lightly-concave blobs
 * like the chapter's confiscation and Māori-held polygons. For sharply
 * concave or peanut-shaped polygons it produces a similarly-shaped
 * smaller polygon rather than a true negative buffer, which is the
 * behaviour we want when stacking these to produce a soft KDE-like
 * falloff.
 */
export function inwardOffsetRing(ring, factor) {
  // Skip a duplicated closing point if present so the centroid isn't biased.
  const closed = ring.length > 1 &&
                 ring[0][0] === ring[ring.length - 1][0] &&
                 ring[0][1] === ring[ring.length - 1][1];
  const n = closed ? ring.length - 1 : ring.length;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1]; }
  cx /= n; cy /= n;
  return ring.map(([x, y]) => [
    x + (cx - x) * factor,
    y + (cy - y) * factor
  ]);
}

/** Inward-offset every ring of a Polygon Feature. */
export function offsetPolygonFeature(feature, factor) {
  return {
    type: 'Feature',
    properties: feature.properties,
    geometry: {
      type: 'Polygon',
      coordinates: feature.geometry.coordinates.map(ring => inwardOffsetRing(ring, factor))
    }
  };
}

// ---------------------------------------------------------------------------
// Antimeridian handling (used by ch1's voyaging visuals in earlier drafts)
// ---------------------------------------------------------------------------

/** Shift a ring (with potentially continuous lngs past ±180) into a single
 *  canonical longitude band by ±360°. Picks the shift via a non-edge vertex
 *  to avoid the ±180° boundary case. */
export function shiftRingToCanonical(ring) {
  if (!ring.length) return ring;
  const ref = ring[Math.floor(ring.length / 2)][0];
  const shift = -360 * Math.floor((ref + 180) / 360);
  return shift === 0 ? ring.slice() : ring.map(p => [p[0] + shift, p[1]]);
}
