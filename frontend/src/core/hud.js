import { el } from './dom.js';
import { createClock } from '../components/clock.js';
import { brand } from './brand.js';

/**
 * Fixed UI over every scene, laid out like the dashboard's header so the two read as one site:
 *
 *   [logo place]                                                  [Autoplay] [Sound] [Live dashboard ↗]
 *
 * (No scene rail: the story is read, not navigated.)
 *
 * The logo's place stays empty unless Skip flies the ember into it (core/brand.js). As the
 * dashboard rises under the closing hero, the bar fades (finale).
 * The clock sits under the bar, on the right.
 */
export function createHud(parent = document.body) {
  const root = el('div', 'hud');
  const bar = el('header', 'story-bar');
  const inner = el('div', 'story-bar__inner');
  const row = el('div', 'story-bar__row');
  inner.append(row);
  bar.append(inner);
  const clock = createClock();
  root.append(bar, clock.el);
  parent.append(root);
  brand.mount(root, row);

  let shownFinale = -1;
  let shownSite = -1;
  let shownPast = -1;
  const html = document.documentElement;

  return {
    root,
    clock,
    /** The bar's top row: the controls mount here, after the logo. */
    row,
    /**
     * 0 = the story's controls; 1 = the site's: Autoplay and Sound gone, Live dashboard turned
     * into Ask the data (components/controls.js). Scene 6 drives it as the dots gather.
     */
    toSite(v) {
      const r = Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
      if (r === shownSite) return;
      shownSite = r;
      // On <html>: the dashboard's header (fixed over the hero) and the vignette read it too.
      html.style.setProperty('--to-site', String(r));
      html.classList.toggle('to-site-on', r > 0);
      html.classList.toggle('to-site-done', r >= 0.99);
      const on = r > 0.5;
      if (bar.classList.contains('is-site') !== on) {
        bar.classList.toggle('is-site', on);
        bar.querySelector('.control--skip')?.setAttribute('aria-label', on ? 'Ask the data' : 'Live dashboard');
      }
      bar.classList.toggle('is-site-done', r >= 0.99);
    },
    /** 0 = on the hero; 1 = scrolled a good way past it: the header's logo and the rest come in. */
    pastHero(v) {
      const r = Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
      if (r === shownPast) return;
      shownPast = r;
      html.style.setProperty('--past-hero', String(r));
      html.classList.toggle('past-hero', r > 0.3);
    },
    /** 0 = the full bar; 1 = only the logo is left (the end of the story). */
    finale(v) {
      const r = Math.round(v * 100) / 100;
      if (r === shownFinale) return;
      shownFinale = r;
      bar.style.setProperty('--chrome', String(1 - r));
      bar.classList.toggle('is-finale', r > 0.5);
    },
  };
}
