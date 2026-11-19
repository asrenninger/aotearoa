/**
 * Entry point (climate atlas).
 * Static figures render once; first scrolly steps are seeded; the Mapbox
 * lazy-init observer arms; scroll-driven UI starts and routes step actions
 * through the chapter dispatcher.
 */

import { setupScroll, markFirstStepsActive } from './core/scroll.js';
import { renderStaticFigures, setupLazyMapInit, dispatchAction } from './chapters/index.js?v=36';
import { mountSurveyFacts }  from './core/survey-facts.js?v=1';
import { mountSurveyCharts } from './core/survey-charts.js?v=7';

renderStaticFigures();
markFirstStepsActive();
setupLazyMapInit();
setupScroll(dispatchAction);

// Survey-driven prose + charts. Both calls are no-ops on pages that
// carry no `[data-fact-item]` / `[data-survey-chart]` mount points
// (i.e. the live index.html), so adding them here is safe.
mountSurveyFacts();
mountSurveyCharts();
