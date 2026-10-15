import { el } from '../core/dom.js';

/**
 * A block of story lines, revealed one line at a time by the scene's timeline.
 *
 *   const c = createCaption([{ text: 'This is you.', big: true }, '2.5 micrometres wide.'], 'aside');
 *   c.lines → one element per line, to tween in and out.
 *
 * big lines are display headlines (h2); the rest are reading lines (.lead).
 * place: 'aside' — right half, vertically centred (beside a particle waiting on the left);
 *        'upper' — top-left, under the scene marker, clear of the fire and smoke below.
 * On phones both sit centred in the lower half.
 */
export function createCaption(lines, place = 'aside') {
  const root = el('div', `caption caption--${place}`);
  const nodes = lines.map((line) => {
    const { text, big } = typeof line === 'string' ? { text: line } : line;
    return el(big ? 'h2' : 'p', big ? 'caption__big' : 's-lead caption__line', {}, text);
  });
  root.append(...nodes);
  return { el: root, lines: nodes };
}
