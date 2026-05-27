/**
 * Entry point.
 *
 * The script tag in index.html is `<script type="module" defer ...>`, so
 * this runs after the HTML has parsed. We only wire subsystems together:
 *   1. Each chapter module's `render()` runs once for static figures.
 *   2. First-step `is-active` classes are seeded so CSS-only effects
 *      have something to render before the user scrolls.
 *   3. The Mapbox lazy-init observer arms.
 *   4. Scroll-driven UI (progress, reveal, scrolly) starts — the scrolly
 *      engine routes step actions through the chapter dispatcher.
 */

import { setupScroll, markFirstStepsActive } from './core/scroll.js';
import { renderStaticFigures, setupLazyMapInit, dispatchAction } from './chapters/index.js';
import { mountSurveyFacts } from './core/survey-facts.js';
import { mountSurveyCharts } from './core/survey-charts.js';

renderStaticFigures();
markFirstStepsActive();
setupLazyMapInit();
setupScroll(dispatchAction);

// NZAVS data sprinkles. Both no-op when the page has no mount points,
// so the original index.html is unaffected.
mountSurveyFacts();
mountSurveyCharts();
