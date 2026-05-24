/**
 * Chapter 1 — Zealandia, a real bathymetric map.
 *
 * Depth bands (translucent blue) from real GMRT bathymetry over the Zealandia
 * region, with the continental block reading as the shallow shelf and the NZ
 * archipelago popping out in land colour. Data: data/zealandia-bathy.json
 * (built from GMRT by data/build/build-bathymetry.py).
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

// Depth thresholds (m) → colour. Deeper = darker, more opaque blue.
const BANDS = [
  [-6000, "rgba(20,46,61,0.92)"],
  [-5000, "rgba(28,62,80,0.90)"],
  [-4000, "rgba(38,82,100,0.88)"],
  [-3000, "rgba(52,104,120,0.84)"],
  [-2000, "rgba(74,128,140,0.78)"],   // continental edge
  [-1000, "rgba(108,156,162,0.72)"],
  [-500,  "rgba(140,178,180,0.66)"],
  [-200,  "rgba(170,196,194,0.60)"]
];

export async function render() {
  const mount = document.getElementById("zealandia-map");
  if (!mount) return;

  let world, data, plates;
  try {
    [world, data, plates] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json"),
      d3.json("./data/zealandia-bathy.json"),
      d3.json("./data/plate-boundaries.json"),
    ]);
  } catch (err) { console.warn("ch1-zealandia: load failed", err); return; }
  const land = topojson.feature(world, world.objects.land);

  const m = data.grid_meta;
  const lonStep = (m.lon_max - m.lon_min) / (m.n_lon - 1);
  const latStep = (m.lat_max - m.lat_min) / (m.n_lat - 1);
  const toLonLat = ([x, y]) => [m.lon_min + x * lonStep, m.lat_min + y * latStep];

  // Clockwise winding so d3's spherical geometry treats the box interior
  // (not its complement) as the region to fit.
  const bbox = { type: "Polygon", coordinates: [[
    [m.lon_min, m.lat_min], [m.lon_min, m.lat_max],
    [m.lon_max, m.lat_max], [m.lon_max, m.lat_min], [m.lon_min, m.lat_min]
  ]] };
  const projection = d3.geoMercator().fitExtent([[0, 0], [1000, 700]], bbox);
  const path = d3.geoPath(projection);

  // Square-off crop: viewBox = the screen rectangle of the lon/lat box corners
  // (in Mercator these are straight edges), so the figure is a clean wide
  // rectangle with no geodesic curvature at top/bottom.
  const tl = projection([m.lon_min, m.lat_max]);   // NW → top-left
  const br = projection([m.lon_max, m.lat_min]);    // SE → bottom-right
  const rx = tl[0], ry = tl[1], rw = br[0] - tl[0], rh = br[1] - tl[1];

  const svg = d3.select(mount).append("svg")
    .attr("viewBox", `${rx.toFixed(1)} ${ry.toFixed(1)} ${rw.toFixed(1)} ${rh.toFixed(1)}`)
    .attr("xmlns", "http://www.w3.org/2000/svg");

  const clipId = "zealandia-clip";
  svg.append("clipPath").attr("id", clipId).append("rect").attr("x", rx).attr("y", ry).attr("width", rw).attr("height", rh);
  const g = svg.append("g").attr("clip-path", `url(#${clipId})`);

  // deep-ocean base
  g.append("rect").attr("x", rx).attr("y", ry).attr("width", rw).attr("height", rh).attr("fill", "#163240");

  // bathymetry bands
  const thresholds = BANDS.map(b => b[0]);
  const contours = d3.contours().size([m.n_lon, m.n_lat]).thresholds(thresholds)(data.values);
  const colourFor = v => (BANDS.find(b => b[0] === v) || BANDS[BANDS.length - 1])[1];
  contours.forEach(c => {
    const proj = { ...c, coordinates: c.coordinates.map(p => p.map(r => r.map(toLonLat))) };
    g.append("path").attr("d", path(proj)).attr("fill", colourFor(c.value)).attr("stroke", "none");
  });

  // continental-edge outline (~2000 m)
  const edge = contours.find(c => c.value === -2000);
  if (edge) {
    const proj = { ...edge, coordinates: edge.coordinates.map(p => p.map(r => r.map(toLonLat))) };
    g.append("path").attr("d", path(proj)).attr("fill", "none")
      .attr("stroke", "#f3ecdd").attr("stroke-width", 1).attr("stroke-dasharray", "5 4").attr("stroke-opacity", 0.4);
  }

  // land — the archipelago popping out
  g.append("path").attr("d", path(land)).attr("fill", "#c9a26b").attr("stroke", "#5a4530").attr("stroke-width", 0.6);

  // place labels
  const lab = (lonlat, text, opts = {}) => {
    const xy = projection(lonlat); if (!xy) return;
    svg.append("text").attr("x", xy[0] + (opts.dx || 0)).attr("y", xy[1] + (opts.dy || 0))
      .attr("text-anchor", opts.anchor || "middle")
      .attr("font-family", opts.serif ? "Source Serif 4, Georgia, serif" : "IBM Plex Mono")
      .attr("font-size", opts.size || 15).attr("letter-spacing", opts.serif ? 0 : 1.6)
      .attr("font-style", opts.italic ? "italic" : "normal").attr("font-weight", opts.serif ? 600 : 400)
      .attr("fill", opts.fill || "#f3ecdd")
      .attr("stroke", opts.halo || "rgba(16,40,52,0.85)").attr("stroke-width", opts.haloW || 3.4)
      .attr("paint-order", "stroke fill").text(text);
  };
  lab([149, -40], "AUSTRALIA", { fill: "#8a6a3b", halo: "#e6d8b8", haloW: 3, size: 14, anchor: "middle" });
  lab([153, -38], "Tasman Sea", { italic: true, serif: true, size: 15 });
  lab([172, -43], "AOTEAROA", { fill: "#1d1610", halo: "#f3ecdd", haloW: 4, size: 16 });
  lab([179.5, -45], "Chatham Rise", { italic: true, serif: true, size: 15, anchor: "end" });
  lab([169, -52.5], "Campbell Plateau", { italic: true, serif: true, size: 15 });
  lab([164, -37.5], "Challenger Plateau", { italic: true, serif: true, size: 15 });
  lab([163, -30], "Lord Howe Rise", { italic: true, serif: true, size: 15 });
  lab([167.5, -22.5], "New Caledonia", { italic: true, serif: true, size: 14 });

  // corner labels
  svg.append("text").attr("x", rx + 16).attr("y", ry + 30)
    .attr("font-family", "IBM Plex Mono").attr("font-size", 15).attr("letter-spacing", 2).attr("fill", "#f3ecdd")
    .attr("stroke", "rgba(16,40,52,0.85)").attr("stroke-width", 3.4).attr("paint-order", "stroke fill").text("ZEALANDIA · TE RIU-A-MĀUI");
  svg.append("text").attr("x", rx + rw - 16).attr("y", ry + 50).attr("text-anchor", "end")
    .attr("font-family", "Fraunces").attr("font-weight", 600).attr("font-size", 52).attr("fill", "#f3ecdd")
    .attr("stroke", "rgba(16,40,52,0.7)").attr("stroke-width", 4).attr("paint-order", "stroke fill").text("94%");
  svg.append("text").attr("x", rx + rw - 16).attr("y", ry + 70).attr("text-anchor", "end")
    .attr("font-family", "IBM Plex Mono").attr("font-size", 13).attr("letter-spacing", 1).attr("fill", "#f3ecdd")
    .attr("stroke", "rgba(16,40,52,0.6)").attr("stroke-width", 2.6).attr("paint-order", "stroke fill").text("OF THE CONTINENT IS UNDERWATER");

  // depth legend + source, bottom-LEFT, with the tectonic inset stacked above
  const order = [...BANDS].reverse(), sw = 28, LW = order.length * sw;  // 224 wide
  const legendY = ry + rh - 64;
  const lg = svg.append("g").attr("transform", `translate(${rx + 16}, ${legendY})`);
  const lgTxt = (x, y, t, anchor) => lg.append("text").attr("x", x).attr("y", y).attr("text-anchor", anchor || "start")
    .attr("font-family", "IBM Plex Mono").attr("font-size", 11).attr("letter-spacing", 0.6)
    .attr("fill", "#f3ecdd").attr("stroke", "rgba(16,40,52,0.7)").attr("stroke-width", 2.4).attr("paint-order", "stroke fill").text(t);
  lgTxt(0, 0, "DEPTH BELOW SEA LEVEL");
  order.forEach((b, i) => lg.append("rect").attr("x", i * sw).attr("y", 8).attr("width", sw).attr("height", 12).attr("fill", b[1]));
  lgTxt(0, 34, "200 m"); lgTxt(LW, 34, "6,000 m", "end");
  lgTxt(0, 52, "Source: GMRT; GEBCO; Bird 2003");

  // ---- Tectonic-plates inset, bottom-LEFT, ABOVE the legend ----
  // White wireframe of Earth's plate boundaries on a Robinson world (handles
  // the poles far better than equirectangular), framed in a white box, with a
  // red locator box over the region this map zooms into.
  let geoRobinson = null;
  try { ({ geoRobinson } = await import("https://cdn.jsdelivr.net/npm/d3-geo-projection@4/+esm")); }
  catch (e) { /* fall back to equirectangular */ }

  const insetW = LW, insetH = 116;
  const insetY = legendY - 34 - insetH;
  const ins = svg.append("g").attr("transform", `translate(${rx + 16}, ${insetY})`);
  ins.append("rect").attr("x", -10).attr("y", -26).attr("width", insetW + 20).attr("height", insetH + 36)
    .attr("rx", 2).attr("fill", "rgba(16,40,52,0.38)").attr("stroke", "#f3ecdd").attr("stroke-width", 1.2);
  ins.append("text").attr("x", 0).attr("y", -8).attr("font-family", "IBM Plex Mono").attr("font-size", 11)
    .attr("letter-spacing", 1.4).attr("fill", "#f3ecdd").attr("stroke", "rgba(16,40,52,0.8)").attr("stroke-width", 2.6).attr("paint-order", "stroke fill").text("EARTH'S TECTONIC PLATES");

  const insetProj = (geoRobinson ? geoRobinson() : d3.geoEquirectangular())
    .fitExtent([[2, 2], [insetW - 2, insetH - 2]], { type: "Sphere" });
  const insetPath = d3.geoPath(insetProj);
  ins.append("path").attr("d", insetPath({ type: "Sphere" })).attr("fill", "none").attr("stroke", "#f3ecdd").attr("stroke-width", 0.5).attr("stroke-opacity", 0.35);
  ins.append("path").attr("d", insetPath(d3.geoGraticule10())).attr("fill", "none").attr("stroke", "#f3ecdd").attr("stroke-width", 0.3).attr("stroke-opacity", 0.16);
  ins.append("path").datum(plates).attr("d", insetPath).attr("fill", "none").attr("stroke", "#f3ecdd").attr("stroke-width", 0.6).attr("stroke-opacity", 0.9);
  // red locator box — densified lon/lat rectangle, projected (curves slightly in Robinson)
  const ring = [], st = 14;
  for (let i = 0; i <= st; i++) ring.push([m.lon_min + (m.lon_max - m.lon_min) * i / st, m.lat_max]);
  for (let i = 1; i <= st; i++) ring.push([m.lon_max, m.lat_max + (m.lat_min - m.lat_max) * i / st]);
  for (let i = 1; i <= st; i++) ring.push([m.lon_max + (m.lon_min - m.lon_max) * i / st, m.lat_min]);
  for (let i = 1; i <= st; i++) ring.push([m.lon_min, m.lat_min + (m.lat_max - m.lat_min) * i / st]);
  ins.append("path").attr("d", insetPath({ type: "Polygon", coordinates: [ring] }))
    .attr("fill", "#c0431f").attr("fill-opacity", 0.22).attr("stroke", "#c0431f").attr("stroke-width", 1.6);
}
