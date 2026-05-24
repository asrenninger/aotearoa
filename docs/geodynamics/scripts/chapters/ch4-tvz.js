/**
 * Chapter 4 — "A legend that maps a rift" (Taupō Volcanic Zone).
 *
 * A clean real map: the North Island with the actual locations of the volcanoes
 * named in Ngātoroirangi's fire tradition, the legendary fire-route drawn
 * through them, and the TVZ rift axis shaded — showing the legend's path follows
 * the real line of fire. Framed wide enough to the north-east to show Hawaiki,
 * the homeland the fire was called from. The zone label runs along the rift.
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

const FIRE = "#c0431f";

// Real coordinates [lon, lat], in the order the tradition's fire travels.
const ROUTE = [
  { name: "Whakaari", ll: [177.18, -37.52], dx: 10, anchor: "start" },
  { name: "Rotorua",                 ll: [176.25, -38.14], dx: -10, anchor: "end" },
  { name: "Tarawera",                ll: [176.51, -38.23], dx: 10, anchor: "start" },
  { name: "Taupō",                   ll: [175.98, -38.79], dx: -10, anchor: "end" },
  { name: "Tongariro",               ll: [175.65, -39.13], dx: -10, anchor: "end" },
];
const HAWAIKI = [180.6, -34.5];   // notional homeland to the north-east, on-screen

export async function render() {
  const mount = document.getElementById("tvz-map");
  if (!mount) return;

  let world;
  try { world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json"); }
  catch (e) { console.warn("ch4-tvz: land load failed", e); return; }
  const land = topojson.feature(world, world.objects.land);

  const W = 840, pad = 14;
  const LON0 = 172.6, LON1 = 182.0, LAT0 = -42.0, LAT1 = -34.0;
  // Framing: the whole North Island and a little of the South for context, plus
  // open sea to the north-east as far as Hawaiki. Clockwise winding (see
  // ch1-zealandia) so the interior is clipped.
  const bbox = { type: "Polygon", coordinates: [[
    [LON0, LAT0], [LON0, LAT1], [LON1, LAT1], [LON1, LAT0], [LON0, LAT0]
  ]] };

  // Size the canvas to the bbox's Mercator aspect so the map fills the frame
  // edge-to-edge (no wasted sea margins) — wider than tall here.
  const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const aspect = ((LON1 - LON0) * Math.PI / 180) / (mercY(LAT1) - mercY(LAT0));
  const H = Math.round((W - 2 * pad) / aspect + 2 * pad);

  // Centre the projection on 180° so the frame can extend past the antimeridian
  // (Hawaiki, ~180.6°E) without d3's spherical clip splitting the geometry.
  const projection = d3.geoMercator().rotate([-180, 0]).fitExtent([[pad, pad], [W - pad, H - pad]], bbox);
  const path = d3.geoPath(projection);

  const svg = d3.select(mount).append("svg")
    .attr("viewBox", `0 0 ${W} ${H + 36}`).attr("xmlns", "http://www.w3.org/2000/svg");

  // sea + clip
  const clipId = "tvz-clip";
  svg.append("clipPath").attr("id", clipId).append("path").attr("d", path(bbox));
  const g = svg.append("g").attr("clip-path", `url(#${clipId})`);
  g.append("path").attr("d", path(bbox)).attr("fill", "#7c9d9d").attr("fill-opacity", 0.10);
  g.append("path").attr("d", path(land)).attr("fill", "#d9c79e").attr("stroke", "#b69e6c").attr("stroke-width", 0.6);

  // TVZ rift axis — a shaded band from Whakaari (NE) to Ruapehu (SW)
  const axisLL = [[175.55, -39.28], [176.0, -38.6], [177.18, -37.52]]; // SW → NE
  const axis = axisLL.map(p => projection(p));
  const bandPath = d3.line().curve(d3.curveCatmullRom.alpha(0.5))(axis);
  g.append("path").attr("d", bandPath).attr("fill", "none")
    .attr("stroke", FIRE).attr("stroke-width", 44).attr("stroke-linecap", "round")
    .attr("stroke-opacity", 0.10);

  // Zone label runs ALONG the rift, undulating with it: an invisible offset path
  // (east of the band, clear of the volcano labels) carries a textPath.
  const v = [axis[2][0] - axis[0][0], axis[2][1] - axis[0][1]];
  const vlen = Math.hypot(v[0], v[1]);
  const perpE = [-v[1] / vlen, v[0] / vlen];   // unit perpendicular, points east
  const OFF = 48;
  // Text path is extended a little to the SW so the label can sit lower on the
  // rift, clear of the Tarawera label, offset east of the band.
  const axisText = [[175.2, -39.8], ...axisLL].map(p => projection(p));
  const offPts = axisText.map(p => [p[0] + perpE[0] * OFF, p[1] + perpE[1] * OFF]);
  const offPath = d3.line().curve(d3.curveCatmullRom.alpha(0.5))(offPts);
  svg.append("defs").append("path").attr("id", "tvz-axis").attr("d", offPath).attr("fill", "none");
  svg.append("text")
    .attr("font-family", "IBM Plex Mono").attr("font-size", 11).attr("letter-spacing", 2.5)
    .attr("fill", FIRE).attr("fill-opacity", 0.7)
    .append("textPath").attr("href", "#tvz-axis").attr("startOffset", "30%").attr("text-anchor", "middle")
    .text("TAUPŌ VOLCANIC ZONE");

  // Hawaiki inflow — the fire, called from the homeland across the sea
  const inflow = [HAWAIKI, ROUTE[0].ll].map(p => projection(p));
  g.append("path").attr("d", d3.line().curve(d3.curveBasis)(inflow)).attr("fill", "none")
    .attr("stroke", FIRE).attr("stroke-width", 2).attr("stroke-dasharray", "6 4").attr("stroke-opacity", 0.7);

  // Hawaiki mark + label, on-screen in the north-east
  const [hx, hy] = projection(HAWAIKI);
  svg.append("path").attr("d", `M ${hx} ${hy - 7} L ${hx + 7} ${hy} L ${hx} ${hy + 7} L ${hx - 7} ${hy} Z`)
    .attr("fill", "#f3ecdd").attr("stroke", FIRE).attr("stroke-width", 1.4);
  svg.append("text").attr("x", hx + 13).attr("y", hy + 4).attr("text-anchor", "start")
    .attr("font-family", "IBM Plex Mono").attr("font-size", 11).attr("letter-spacing", 2).attr("fill", FIRE)
    .text("HAWAIKI");

  // legendary fire-route through the real volcano locations
  const pts = ROUTE.map(r => projection(r.ll));
  const routePath = d3.line().curve(d3.curveCatmullRom.alpha(0.5))(pts);
  svg.append("path").attr("d", routePath).attr("fill", "none")
    .attr("stroke", FIRE).attr("stroke-width", 2.4).attr("stroke-dasharray", "2 3").attr("stroke-linecap", "round");

  // volcano marks + labels
  ROUTE.forEach(r => {
    const [x, y] = projection(r.ll);
    svg.append("path").attr("d", `M ${x} ${y - 7} l 7 12 l -14 0 z`).attr("fill", FIRE).attr("stroke", "#f3ecdd").attr("stroke-width", 0.8);
    svg.append("text").attr("x", x + r.dx).attr("y", y + 3).attr("text-anchor", r.anchor)
      .attr("font-family", "Source Serif 4, Georgia, serif").attr("font-size", 13).attr("font-weight", 600)
      .attr("fill", "#1d1610").attr("stroke", "#f3ecdd").attr("stroke-width", 2.6).attr("paint-order", "stroke fill")
      .text(r.name);
  });

  // caption
  svg.append("line").attr("x1", pad).attr("y1", H + 12).attr("x2", W - pad).attr("y2", H + 12).attr("stroke", "#c9b894").attr("stroke-width", 0.5);
  svg.append("text").attr("x", pad).attr("y", H + 28).attr("font-family", "IBM Plex Mono").attr("font-size", 10)
    .attr("letter-spacing", 0.6).attr("fill", "#8a7659")
    .text("Source: Smithsonian GVP");
}
