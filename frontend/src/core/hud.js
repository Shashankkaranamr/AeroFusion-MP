import { el } from './dom.js';
import { createClock } from '../components/clock.js';
import { brand } from './brand.js';

/**
 * Fixed UI over every scene, laid out like the dashboard's header so the two read as one site:
 *
 *   [logo place]  THE AIR · A STORY IN SIX SCENES                 [Autoplay] [Sound] [Live dashboard ↗]
 *   ─────────────────────────────────────────────────────────────────────────────────────────────
 *   01 THE PARTICLE   02 THE SPARK   03 THE RIDE   04 THE TRAP   05 THE BREATH   06 NOT ALONE
 *
 * The logo's place stays empty until the story's ember flies into it (core/brand.js). At the end
 * of the story everything but the logo fades (finale), leaving the logo where the dashboard's is.
 * The clock sits under the bar, on the right.
 */
export function createHud(parent = document.body) {
  const root = el('div', 'hud');
  const bar = el('header', 'story-bar');
  const inner = el('div', 'story-bar__inner');
  const row = el('div', 'story-bar__row');
  const title = el('span', 'story-bar__title s-tag', {}, el('b', '', {}, 'The air'), ' · a story in six scenes');
  const railNav = el('nav', 'story-bar__rail', { 'aria-label': 'Scenes' });
  const rail = el('ol', 'rail');
  railNav.append(rail);
  row.append(title);
  inner.append(row, railNav);
  bar.append(inner);
  const clock = createClock();
  root.append(bar, clock.el);
  parent.append(root);
  brand.mount(root, row);

  let items = [];
  let current = -1;
  let shownFinale = -1;

  return {
    root,
    clock,
    /** The bar's top row: the controls mount here, after the logo. */
    row,
    /** The scenes, as the rail. onPick(i) jumps to scene i. */
    setRail(scenes, onPick) {
      rail.replaceChildren();
      items = scenes.map((s, i) => {
        const b = el('button', 'rail__item', { type: 'button' },
          el('span', 'rail__num', {}, String(s.number).padStart(2, '0')),
          el('span', 'rail__label', {}, s.title));
        b.addEventListener('click', () => onPick(i));
        rail.append(el('li', '', {}, b));
        return b;
      });
    },
    /** Underline the scene on screen. */
    setActive(i) {
      if (i === current) return;
      items[current]?.removeAttribute('aria-current');
      items[i]?.setAttribute('aria-current', 'step');
      // Keep it in view on a narrow rail (by hand: scrollIntoView could move the page too).
      const b = items[i];
      if (b && railNav.scrollWidth > railNav.clientWidth) {
        const x = b.offsetLeft - railNav.clientWidth / 2 + b.offsetWidth / 2;
        railNav.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
      }
      current = i;
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
