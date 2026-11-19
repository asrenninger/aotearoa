/**
 * Chapter dispatcher (climate atlas).
 *
 * Same contract as the migration atlas: each chapter module exports a subset
 * of init(state) / actions{} / render(). This module wires them into
 * renderStaticFigures(), setupLazyMapInit(), and dispatchAction(id).
 */

import { MAPBOX_TOKEN } from '../core/mapbox-style.js';

import * as ch1Zealandia    from './ch1-zealandia.js?v=12';
import * as ch2RingOfFire   from './ch2-ring-of-fire.js?v=6';
import * as ch2RingFireStatic from './ch2-ringfire-static.js';
import * as ch3Rangitoto    from './ch3-rangitoto.js?v=6';
import * as ch4Tvz          from './ch4-tvz.js?v=17';
import * as ch6Eruptions    from './ch6-eruptions.js?v=9';
import * as ch8Co2          from './ch8-co2.js?v=2';
import * as ch9Ozone        from './ch9-ozone.js?v=10';
import * as ch11Warming     from './ch11-warming.js?v=7';
import * as ch12Futures     from './ch12-futures.js?v=8';

mapboxgl.accessToken = MAPBOX_TOKEN;

const chapterModules = {
  'ch1-zea':  ch1Zealandia,      // static — Zealandia bathymetry
  ch2:        ch2RingOfFire,     // sticky-scrolly Mapbox (the Ring of Fire)
  'ch2-stat': ch2RingFireStatic, // static log-azimuthal KDE overview
  ch3:        ch3Rangitoto,      // bespoke eruption animation
  'ch4-tvz':  ch4Tvz,            // static — TVZ fire-route map
  'ch6-eru':  ch6Eruptions,      // static — NZ eruptions by VEI
  ch8:        ch8Co2,            // chart-scrolly (CO₂)
  ch9:        ch9Ozone,          // scrolly — south-polar ozone hole
  ch11:       ch11Warming,       // static — warming stripes + temperature line
  ch12:       ch12Futures        // static — scenario fan
};

const chapterState = Object.create(null);

function ensureChapter(chId) {
  if (chapterState[chId]) return chapterState[chId];
  const mod = chapterModules[chId];
  if (!mod || typeof mod.init !== 'function') return null;
  const state = { ready: false, pending: [], actions: mod.actions || {} };
  chapterState[chId] = state;
  try { mod.init(state); }
  catch (err) { console.error('chapter init failed:', chId, err); }
  return state;
}

export function renderStaticFigures() {
  for (const [chId, mod] of Object.entries(chapterModules)) {
    if (typeof mod.render !== 'function') continue;
    try { mod.render(); }
    catch (err) { console.error('chapter render failed:', chId, err); }
  }
}

export function dispatchAction(action) {
  const m = action.match(/^(ch\d+)-/);
  if (!m) return false;
  const chId = m[1];
  if (!chapterModules[chId]) return false;
  const state = ensureChapter(chId);
  if (!state) return false;
  const fn = state.actions[action];
  if (!fn) return true;
  if (state.ready) fn(state);
  else state.pending.push(() => fn(state));
  return true;
}

export function setupLazyMapInit() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const chId = e.target.id.replace('map-', '');
      if (chapterModules[chId]) ensureChapter(chId);
    });
  }, { rootMargin: '600px' });
  document.querySelectorAll('.map-pane').forEach(el => observer.observe(el));
}
