/**
 * Chapter 2 — the Ring of Fire, static overview map.
 *
 * A creative-projection companion to the Mapbox scrolly: the world drawn on
 * the log-azimuthal projection centred on Aotearoa (the same projection as the
 * migration atlas's ancestry + two-tides figures), so the Pacific rim wraps
 * the country as a literal ring. Over it, a KDE-style density surface of every
 * recorded eruption (Smithsonian GVP, via TidyTuesday), built offline by
 * data/build/build-volcano-kde.py.
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { AKL, logAzimuthalRaw } from '../core/projection.js';

const PARAMS = { S: 1.2, B: 165 };
const THRESHOLDS = [0.04, 0.10, 0.20, 0.34, 0.52, 0.74];
const FIRE = "#c0431f";

function withAlpha(hex, a) {
  const c = d3.color(hex).rgb();
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a.toFixed(3)})`;
}

export async function render() {
  const mount = document.getElementById("ringfire-map");
  if (!mount) return;

  let world, data;
  try {
    [world, data] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"),
      d3.json("./data/volcano-kde.json"),
    ]);
  } catch (err) {
    console.warn("ch2-ringfire-static: failed to load data", err);
    return;
  }
  const land = topojson.feature(world, world.objects.land);

  const meta = data.grid_meta;
  const lonStep = (meta.lon_max - meta.lon_min) / (meta.n_lon - 1);
  const latStep = (meta.lat_max - meta.lat_min) / (meta.n_lat - 1);
  const toLonLat = ([x, y]) => [meta.lon_min + x * lonStep, meta.lat_min + y * latStep];

  const W = 820, H = 880, mapTop = 12, mapBot = 760, mapL = 12, mapR = W - 12;

  const svg = d3.select(mount).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("xmlns", "http://www.w3.org/2000/svg");

  const raw = logAzimuthalRaw(PARAMS.S, PARAMS.B);
  const projection = d3.geoProjection(raw)
    .rotate([-AKL[0], -AKL[1]])
    .clipAngle(PARAMS.B - 0.001);
  const cap = d3.geoCircle().center(AKL).radius(Math.min(PARAMS.B - 0.5, 179.5))();
  projection.fitExtent([[mapL, mapTop], [mapR, mapBot]], cap);
  const path = d3.geoPath(projection);

  svg.append("path").attr("d", path({ type: "Sphere" }))
    .attr("fill", "#f3ecdd").attr("stroke", "#1d1610").attr("stroke-width", 0.6);
  svg.append("path").attr("d", path(d3.geoGraticule10()))
    .attr("fill", "none").attr("stroke", "#cdbf9c").attr("stroke-width", 0.4).attr("stroke-opacity", 0.55);
  svg.append("path").attr("d", path(land))
    .attr("fill", "#d9c79e").attr("stroke", "#b69e6c").attr("stroke-width", 0.35);

  // KDE density surface
  const tMax = THRESHOLDS[THRESHOLDS.length - 1] - THRESHOLDS[0];
  const contours = d3.contours().size([meta.n_lon, meta.n_lat]).thresholds(THRESHOLDS)(data.values);
  const proj = contours.map(c => ({
    ...c,
    coordinates: c.coordinates.map(poly => poly.map(ring => ring.map(toLonLat)))
  }));
  svg.append("g").selectAll("path").data(proj).join("path")
    .attr("d", d => path(d))
    .attr("fill", d => withAlpha(FIRE, 0.10 + 0.62 * ((d.value - THRESHOLDS[0]) / tMax)))
    .attr("stroke", "none");

  // Coastline above the wash
  svg.append("path").attr("d", path(land))
    .attr("fill", "none").attr("stroke", "#b69e6c").attr("stroke-width", 0.35).attr("stroke-opacity", 0.7);

  // Volcano points
  const gV = svg.append("g");
  data.volcanoes.forEach(([lon, lat]) => {
    const xy = projection([lon, lat]);
    if (!xy) return;
    gV.append("circle").attr("cx", xy[0]).attr("cy", xy[1]).attr("r", 1.1)
      .attr("fill", FIRE).attr("fill-opacity", 0.55);
  });

  // Orientation labels around the rim
  const PLACES = [
    { ll: [-70, -24],  t: "Andes" },
    { ll: [-122, 45],  t: "Cascades" },
    { ll: [-152, 61],  t: "Alaska" },
    { ll: [140, 38],   t: "Japan" },
    { ll: [160, 56],   t: "Kamchatka" },
    { ll: [115, -7],   t: "Indonesia" },
    { ll: [-175, -20], t: "Tonga–Kermadec" },
  ];
  const gL = svg.append("g");
  PLACES.forEach(p => {
    const xy = projection(p.ll);
    if (!xy) return;
    gL.append("text").attr("x", xy[0]).attr("y", xy[1]).attr("text-anchor", "middle")
      .attr("font-family", "IBM Plex Mono").attr("font-size", 10).attr("letter-spacing", 0.5)
      .attr("fill", "#1d1610").attr("stroke", "#f3ecdd").attr("stroke-width", 2.6)
      .attr("paint-order", "stroke fill").text(p.t.toUpperCase());
  });

  // Aotearoa marker, at the centre
  const akl = projection(AKL);
  const gA = svg.append("g");
  gA.append("circle").attr("cx", akl[0]).attr("cy", akl[1]).attr("r", 3.6)
    .attr("fill", "#1d1610").attr("stroke", "#f3ecdd").attr("stroke-width", 1.2);
  gA.append("text").attr("x", akl[0] + 7).attr("y", akl[1] - 7)
    .attr("font-family", "IBM Plex Mono").attr("font-size", 11).attr("font-weight", 500)
    .attr("fill", "#1d1610").attr("stroke", "#f3ecdd").attr("stroke-width", 3)
    .attr("paint-order", "stroke fill").text("AOTEAROA");

  // Legend
  const legend = svg.append("g").attr("transform", `translate(${mapL + 8}, ${mapBot + 30})`);
  legend.append("text").attr("x", 0).attr("y", 0)
    .attr("font-family", "IBM Plex Mono").attr("font-size", 10).attr("letter-spacing", 0.8)
    .attr("fill", "#8a7659").text("DENSER = MORE ERUPTIONS RECORDED");
  [0.12, 0.30, 0.50, 0.72].forEach((a, k) => {
    legend.append("rect").attr("x", k * 30).attr("y", 12).attr("width", 30).attr("height", 12)
      .attr("fill", withAlpha(FIRE, a));
  });
  legend.append("text").attr("x", 0).attr("y", 44)
    .attr("font-family", "IBM Plex Mono").attr("font-size", 9.5).attr("fill", "#8a7659")
    .text(`${data.n_eruptions.toLocaleString()} eruptions · ${data.volcanoes.length} volcanoes`);
}
