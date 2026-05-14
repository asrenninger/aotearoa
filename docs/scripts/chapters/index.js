/**
 * Chapter dispatcher.
 *
 * Each chapter module exports some subset of:
 *   - `init(state)`   — lazy Mapbox initialisation; fired when the chapter's
 *                       `.map-pane` approaches the viewport
 *   - `actions{}`     — scrolly step responders keyed by action id (e.g.
 *                       `ch4-step2`), called by core/scroll.js
 *   - `render()`      — one-shot static figure render; called at page load
 *
 * This module reads each chapter's exports and wires them into three
 * public functions:
 *   - `renderStaticFigures()` — iterates render() across every chapter
 *   - `setupLazyMapInit()`    — IntersectionObserver for chapters with init()
 *   - `dispatchAction(id)`    — routes `chN-stepM` to the right `actions{}`
 *
 * State is per-chapter and lazy: `ensureChapter` instantiates a fresh
 * state on first request, fires `init()` (which mounts the Mapbox map),
 * and from then on dispatches step actions either synchronously (if
 * `state.ready`) or via a pending queue that flushes when init resolves.
 */

import { MAPBOX_TOKEN } from '../core/mapbox-style.js';

import * as ch1Polynesia    from './ch1-polynesia.js';
import * as ch1Lineages     from './ch1-lineages.js';
import * as ch3TreatyLand   from './ch3-treaty-land.js';
import * as ch4Pacific      from './ch4-pacific-circuit.js';
import * as ch5Exclusion    from './ch5-exclusion.js';
import * as ch7Exports      from './ch7-exports-chart.js';
import * as ch8Urbanisation from './ch8-urbanisation.js';
import * as ch9Pasifika     from './ch9-pasifika.js';
import * as ch12TwoTides    from './ch12-twotides.js';

mapboxgl.accessToken = MAPBOX_TOKEN;

// Registry: chapter id → module. Order is arbitrary for dispatch but kept
// chapter-sequential for legibility.
const chapterModules = {
  ch1:        ch1Polynesia,    // sticky-scrolly globe
  'ch1-lin':  ch1Lineages,     // separate render — ancestry surfaces
  ch3:        ch3TreatyLand,
  ch4:        ch4Pacific,
  ch5:        ch5Exclusion,
  ch7:        ch7Exports,
  ch8:        ch8Urbanisation,
  ch9:        ch9Pasifika,
  ch12:       ch12TwoTides
};

// State store for chapters that have `init()` — keyed by the chapter id
// that scrolly actions resolve to (i.e. `chN`, not `chN-lin`).
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

/** Run every chapter module's `render()` once at page load. Used for
 *  static figures that don't depend on viewport intersection (dot grids,
 *  gender waffle, pop bars, ancestry surfaces, two-tides maps). */
export function renderStaticFigures() {
  for (const [chId, mod] of Object.entries(chapterModules)) {
    if (typeof mod.render !== 'function') continue;
    try { mod.render(); }
    catch (err) { console.error('chapter render failed:', chId, err); }
  }
}

/** Dispatch a `chN-stepM` action to the right chapter. */
export function dispatchAction(action) {
  const m = action.match(/^(ch\d+)-/);
  if (!m) return false;
  const chId = m[1];
  if (!chapterModules[chId]) return false;

  const state = ensureChapter(chId);
  if (!state) return false;

  const fn = state.actions[action];
  if (!fn) return true;          // recognised chapter, unknown step — swallow

  if (state.ready) fn(state);
  else state.pending.push(() => fn(state));
  return true;
}

/** Lazy-init each Mapbox chapter when its pane approaches the viewport.
 *  Avoids spinning up four Mapbox instances at page load (which saturates
 *  the tile worker). */
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
