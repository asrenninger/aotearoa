/**
 * Scroll-driven UI subsystems.
 *
 * Three observers live here, all keyed to the natural reading position:
 *
 *  - Reading-progress bar  · scroll listener, sets width on #progressBar
 *  - Chapter-nav highlight · IO over the chapter sections, toggles `.active`
 *  - Reveal-on-scroll      · IO over `.reveal` figures, adds `.in-view`
 *  - Scrolly step engine   · IO over `.step` / `.step-card`, dispatches
 *                            the active step's action to the chapter
 *                            dispatcher injected at setup time
 *
 * All four are passive: nothing here mutates content. Action dispatch is
 * decoupled — `setupScroll(dispatch)` takes the chapter-dispatch function
 * as an argument so this module doesn't import from `chapters/`.
 */

const SECTION_IDS = ['hero','ch1','ch2','ch3','ch4','ch5','ch6','ch7','ch8','ch9','ch10','ch11','ch12','ch13'];

/** Reading-progress bar + chapter-nav dot highlight. */
function setupProgressBar() {
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    const updateProgress = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = (window.scrollY / total) * 100 + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  const navLinks = document.querySelectorAll('.chapter-nav a');
  if (!navLinks.length) return;

  const sections = SECTION_IDS.map(id => document.getElementById(id)).filter(Boolean);
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      navLinks.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    });
  }, { threshold: 0.4 });
  sections.forEach(s => navObserver.observe(s));
}

/** Reveal-on-scroll for `.reveal` figures (used for the chart annotations
 *  in chapters that aren't full scrolly-maps). */
function setupReveal() {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in-view');
      e.target.querySelectorAll('.route').forEach(r => r.classList.add('draw'));
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

/**
 * Scrolly step engine.
 *
 * One IntersectionObserver watches every `.step` and `.step-card`. With
 * rootMargin: 0 + the step-card spacing chosen in CSS, adjacent steps'
 * active windows *overlap* — there is no scroll position inside a chapter
 * where every step is inactive (and the map left in a stale post-
 * transition state). On any threshold crossing we update is-active
 * classes, then for each affected chapter pick the step whose top has
 * crossed the upper-quarter line of the viewport and fire its action.
 * That maps cleanly to the natural reading position in both scroll
 * directions, including across overlap zones.
 */
function setupScrolly(dispatch) {
  const observer = new IntersectionObserver((entries) => {
    // 1. Update is-active classes for everyone
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('is-active');
      else                  e.target.classList.remove('is-active');
    });

    // 2. For each affected chapter, pick the deepest-into-the-chapter
    //    active step whose top has scrolled into the upper quarter of
    //    the viewport (the natural reading zone). Fall back to the
    //    first active step if none has been "reached" yet — that way
    //    a user just entering the chapter still gets step 1's view.
    const chapters = new Set();
    entries.forEach(e => {
      const c = e.target.closest('.scrolly-map, .scrolly');
      if (c) chapters.add(c);
    });

    const enterY = window.innerHeight * 0.25;
    chapters.forEach(container => {
      const active = Array.from(
        container.querySelectorAll('.step.is-active, .step-card.is-active')
      );
      if (active.length === 0) return;

      let chosen = null;
      for (const el of active) {
        if (el.getBoundingClientRect().top <= enterY) chosen = el;
        else break;
      }
      if (!chosen) chosen = active[0];

      const action = chosen.dataset.action;
      if (action) dispatch(action);
    });
  }, { threshold: 0.55, rootMargin: '0px' });

  document.querySelectorAll('.step, .step-card').forEach(el => observer.observe(el));
}

/** Mark each scrolly's first step is-active on first paint, but DON'T
 *  fire its action — we let the lazy map-init observer + scroll-driven
 *  step observer do that, which avoids kicking off four Mapbox inits
 *  simultaneously at page load. */
export function markFirstStepsActive() {
  document.querySelectorAll('.scrolly, .scrolly-map').forEach(scrolly => {
    const firstStep = scrolly.querySelector('.step, .step-card');
    if (firstStep) firstStep.classList.add('is-active');
  });
}

/** Wire up all scroll-driven UI. `dispatch(actionId)` is the chapter
 *  dispatcher — injected so this module doesn't import from chapters/. */
export function setupScroll(dispatch) {
  setupProgressBar();
  setupReveal();
  setupScrolly(dispatch);
}
