import { el } from './dom.js';
import { createClock } from '../components/clock.js';
import { brand } from './brand.js';

/**
 * Fixed UI over every scene, laid out like the dashboard's header so the two read as one site:
 *
 *   [logo place]  THE AIR · A STORY IN SIX SCENES                 [Autoplay] [Sound] [Live dashboard ↗]
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
  const title = el('span', 'story-bar__title s-tag', {}, el('b', '', {}, 'The air'), ' · a story in six scenes');
  row.append(title);
  inner.append(row);
  bar.append(inner);
  const clock = createClock();
  root.append(bar, clock.el);
  parent.append(root);
  brand.mount(root, row);

  let shownFinale = -1;

  return {
    root,
    clock,
    /** The bar's top row: the controls mount here, after the logo. */
    row,
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
