import { el } from '../core/dom.js';

/**
 * THE HERO — the story's opening frame (new frontend proposal/).
 *
 *   AEROFUSION.                      a wordmark across the whole page, BEHIND the particle
 *        ( the particle, large )     the ball sits over the wordmark's lower half
 *   ● 33 cities                                        Story      /01
 *     PM2.5, live                                      Live map   /02
 *                                                      Forecast   /03
 *   The air over North India,                               ( ▸ Begin )
 *   scene by scene, then live.
 *   ·························
 *
 * Scene 1 places it under the particle (DOM order), fades it on the first scroll and shrinks the
 * ball back to its story size. `fit()` sizes the wordmark to the column; `ball()` says where the
 * ball should sit so it overlaps the wordmark the way the proposal does.
 */
export function createHero({ cities = 33 } = {}) {
  const root = el('div', 'hero');
  const word = el('p', 'hero__word', { 'aria-hidden': 'true' }, 'AEROFUSION', el('span', 'hero__stop', {}, '.'));
  const stat = el('div', 'hero__stat',
    {},
    el('span', 'hero__live', { 'aria-hidden': 'true' }),
    el('span', 'hero__num s-display', {}, String(cities)),
    el('span', 'hero__unit s-tag', {}, 'cities · PM2.5, live'));
  const list = el('ol', 'hero__list s-tag', { 'aria-label': 'What is here' },
    ...[['Story', '01'], ['Live map', '02'], ['Forecast', '03']].map(([k, n]) => el('li', '', {}, k, el('span', 'hero__idx', {}, ` /${n}`))));
  const lede = el('p', 'hero__lede s-lead', {}, 'The air over North India, scene by scene, then live.');
  const begin = el('button', 'hero__begin', { type: 'button' },
    el('span', 'hero__play', { 'aria-hidden': 'true' }),
    el('span', '', {}, 'Begin'));
  begin.addEventListener('click', () => window.dispatchEvent(new CustomEvent('aerofusion:begin')));
  root.append(word, stat, list, lede, begin);

  /** Make the wordmark exactly as wide as the column (Inter's widths differ by platform). */
  function fit() {
    word.style.fontSize = '100px';
    const w = word.scrollWidth;
    const cs = getComputedStyle(root);
    const avail = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (w > 0 && avail > 0) word.style.fontSize = `${(100 * avail) / w}px`;
  }
  // Refit once Inter is in (the first measure may be in a fallback face) and on every resize.
  document.fonts?.ready.then(fit);
  window.addEventListener('resize', fit);

  /**
   * Where the ball goes, as fractions of the viewport, and its diameter in CSS px: centred under
   * the wordmark, its top about halfway up the letters.
   */
  function ball() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Layout position (offsetTop ignores the exit tween's transform), in the full-screen hero box.
    const top = word.offsetTop;
    // Cap height of Inter ≈ 0.73 em; the box is set to line-height 0.8.
    const fs = parseFloat(word.style.fontSize) || 100;
    const capTop = top + fs * 0.06;
    const capBottom = capTop + fs * 0.73;
    const d = Math.min(vh * 0.5, vw * 0.62, 460);
    const cy = capBottom - (capBottom - capTop) * 0.48 + d / 2;
    return { x: 0.5, y: Math.min(0.62, cy / vh), d };
  }

  return { el: root, word, parts: [word, stat, list, lede, begin], fit, ball };
}
