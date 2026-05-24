/**
 * Entry point (climate atlas).
 * Static figures render once; first scrolly steps are seeded; the Mapbox
 * lazy-init observer arms; scroll-driven UI starts and routes step actions
 * through the chapter dispatcher.
 */

import { setupScroll, markFirstStepsActive } from './core/scroll.js';
import { renderStaticFigures, setupLazyMapInit, dispatchAction } from './chapters/index.js?v=30';

renderStaticFigures();
markFirstStepsActive();
setupLazyMapInit();
setupScroll(dispatchAction);
