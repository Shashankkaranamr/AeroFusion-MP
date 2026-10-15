import { el } from '../core/dom.js';

/**
 * Scale bar, bottom-right: a thin rule with end ticks and its length in the mono tag face.
 *
 * One element per step, stacked in the same spot, so a scrubbed timeline crossfades between
 * them and plays back just as well in reverse:
 *
 *   const bar = createScaleBar([{ label: '10 µm', length: () => 4 * d }, { label: '100 km' }]);
 *   tl.to(bar.steps[0], { autoAlpha: 0 }, t); tl.to(bar.steps[1], { autoAlpha: 1 }, t);
 *
 * length(): the rule's length in CSS px, re-read on resize. Give it when the bar can be true to
 * the picture (Scene 1: the particle is drawn to scale); otherwise a standard length is used.
 */
const STANDARD = 96;

export function createScaleBar(steps) {
  const root = el('div', 'scale-bar', { 'aria-hidden': 'true' });
  const nodes = steps.map(() => {
    const step = el('div', 'scale-bar__step');
    step.append(el('span', 'scale-bar__rule'), el('span', 'scale-bar__label s-tag'));
    return step;
  });
  root.append(...nodes);

  function measure() {
    steps.forEach(({ label, length }, i) => {
      nodes[i].lastChild.textContent = label;
      nodes[i].style.setProperty('--len', `${Math.round(length?.() ?? STANDARD)}px`);
    });
  }
  measure();
  window.addEventListener('resize', measure);

  return { el: root, steps: nodes, measure };
}
