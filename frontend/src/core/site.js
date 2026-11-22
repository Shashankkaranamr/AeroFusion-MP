import { el } from './dom.js';
import { bridge } from './bridge.js';

/**
 * ONE SITE: the story, and under it the live dashboard.
 *
 *   index.html   #story   the scroll-driven story (six scenes)
 *                #bridge  one screen of black, grid and particles (core/bridge.js, fixed behind)
 *                #app     the dashboard (React, src/app), loaded while the story plays
 *
 * Scrolling past the story, the dashboard rises over the particles; when its top reaches the top
 * of the screen it LOCKS: the story steps out of the page (html.mode-dash), the scroll position is
 * moved so nothing visibly jumps, smooth scrolling and every scene stop, and the address becomes
 * the dashboard's (#/now). Scrolling up past the dashboard's top (wheel, a pull on touch, or the
 * keyboard) unlocks it again at the same spot, so the reader rises back into the closing hero.
 * "Back to the story" (the dashboard's header, or its logo) unlocks and starts from the top.
 *
 * Arriving on a dashboard address (#/map, #/city/delhi … or the old app.html) opens straight into
 * the dashboard; the story is only built if the reader asks for it.
 */
const DASH = /^#\/(now|map|city|why|what-if|history|data)(\/|\?|$)/;
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createSite() {
  const root = document.documentElement;
  const app = document.getElementById('app');
  const veil = el('div', 'site-veil', { 'aria-hidden': 'true' });
  document.body.append(veil);
  bridge.mount(document.body);

  let startStory = null;
  let story = null;
  let dash = false;
  let lastHash = '#/now';
  let loading = null;
  let busy = false;
  const storyTitle = document.title;

  const loadDashboard = () => (loading ??= import('../app/main.tsx').then((m) => m.mountDashboard(app)));

  function setMode(d) {
    dash = d;
    root.classList.toggle('mode-dash', d);
    window.dispatchEvent(new CustomEvent('aerofusion:mode', { detail: { dash: d } }));
  }

  /** Into the dashboard. `scrollTo`: where the page should be once the story is gone. */
  function lock(scrollTo) {
    if (dash) return;
    story?.pause();
    bridge.set(0);
    setMode(true);
    window.scrollTo(0, Math.max(0, scrollTo));
    if (!DASH.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + lastHash);
  }

  // The lock: the dashboard's top meets the top of the screen.
  const check = () => {
    if (dash || busy || !app.firstElementChild) return;
    const top = app.getBoundingClientRect().top;
    if (top <= 0.5) lock(-top);
  };
  window.addEventListener('scroll', check, { passive: true });
  // Smooth scrolling (Lenis) can move the page without a scroll event reaching us in time, so
  // also look once a frame while the story has the page.
  const poll = () => {
    if (!dash) check();
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  /** Skip, or a dashboard link while the story is on: straight in. */
  async function toDashboard() {
    if (dash) return;
    busy = true;
    await loadDashboard();
    await frame();
    lock(0);
    busy = false;
  }

  /** Up out of the dashboard, into the story's closing hero (only once the story has been built). */
  async function toHero() {
    if (!dash || busy || !story) return;
    busy = true;
    if (DASH.test(location.hash)) lastHash = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
    setMode(false);
    document.title = storyTitle;
    await frame();
    // Exactly where it locked, a hair above the lock line, so nothing moves and it doesn't relock.
    story.resumeAt(Math.max(0, app.offsetTop - 2));
    await frame();
    await frame();
    busy = false;
  }

  // Intent to go up at the dashboard's top. Not when the gesture belongs to something inside the
  // page that scrolls or zooms itself (the map, a drawer, a scrolled list).
  const ownsGesture = (t) => {
    for (let n = t instanceof Element ? t : null; n && n !== document.body; n = n.parentElement) {
      if (n.matches('.maplibregl-map, [role="dialog"]')) return true;
      if (n.scrollTop > 0) return true;
    }
    return false;
  };
  const atTop = () => dash && !busy && window.scrollY <= 0;
  let pull = 0;
  let pullAt = 0;
  window.addEventListener('wheel', (e) => {
    if (!atTop() || e.deltaY >= 0 || ownsGesture(e.target)) {
      pull = 0;
      return;
    }
    const now = performance.now();
    if (now - pullAt > 400) pull = 0; // one continuous gesture
    pullAt = now;
    pull += -e.deltaY * (e.deltaMode === 1 ? 40 : 1);
    if (pull > 220) {
      pull = 0;
      toHero();
    }
  }, { passive: true });
  let touchY = null;
  window.addEventListener('touchstart', (e) => {
    touchY = atTop() && !ownsGesture(e.target) ? e.touches[0].clientY : null;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY === null || !atTop()) return;
    if (e.touches[0].clientY - touchY > 90) {
      touchY = null;
      toHero();
    }
  }, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (!atTop() || !['ArrowUp', 'PageUp'].includes(e.key)) return;
    if (e.target !== document.body && e.target !== document.getElementById('main')) return;
    toHero();
  });

  /** Back to the story, from the top. */
  async function toStory() {
    if (!dash || busy) return;
    busy = true;
    veil.classList.add('is-on');
    await wait(460);
    if (DASH.test(location.hash)) lastHash = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
    setMode(false);
    document.title = storyTitle;
    window.scrollTo(0, 0);
    story ??= startStory();
    story.resume();
    await frame();
    await frame();
    busy = false;
    veil.classList.remove('is-on');
  }

  window.addEventListener('aerofusion:story', toStory);
  window.addEventListener('aerofusion:dashboard', toDashboard);
  // A dashboard address typed or linked while the story is on.
  window.addEventListener('hashchange', () => {
    if (!dash && DASH.test(location.hash)) toDashboard();
  });

  return {
    /** Starts the site in the right mode. start() builds the story and returns its controls. */
    init(start) {
      startStory = start;
      // The story always opens at its beginning; a reload never lands halfway through a scene.
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      if (DASH.test(location.hash)) {
        setMode(true);
        loadDashboard();
        return;
      }
      story = startStory();
      // The dashboard loads while the opening plays, so its data (and the API's ~1 min wake-up)
      // is ready by the end of the story.
      const later = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200));
      setTimeout(() => later(() => loadDashboard()), 2500);
    },
    toDashboard,
    toStory,
    loadDashboard,
    get dash() {
      return dash;
    },
  };
}
