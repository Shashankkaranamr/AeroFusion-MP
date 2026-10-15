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
 * the dashboard's (#/now). From then on the page is only the dashboard; scrolling up stays in it.
 * "Back to the story" (the dashboard's header, or its logo) unlocks: the story comes back and starts
 * from the top, and the blob flies again at the end.
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

  /** Skip, or a dashboard link while the story is on: straight in. */
  async function toDashboard() {
    if (dash) return;
    busy = true;
    await loadDashboard();
    await frame();
    lock(0);
    busy = false;
  }

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
