import { el } from '../core/dom.js';
import { createLayer } from './layers.js';

/**
 * The mixing-layer ceiling (for Scene 5 — not used yet).
 *
 * A crisp, softly glowing horizontal line drawn in code, with a trapped-haze glow just below
 * it. Lowering state.y (viewport fraction from the top) squeezes the haze into a thinner,
 * denser band — smoke getting trapped. The haze is coded by default; if the scene has a
 * "<scene>/haze-trapped" light layer, that artwork is used under the line instead.
 *
 *   const ceiling = createCeiling({ hazeKey: 'scene5/haze-trapped' });
 *   tl.fromTo(ceiling.state, { y: 0.25 }, { y: 0.55 }, 0.2);
 *   onTick(() => ceiling.render());
 */
export function createCeiling({ hazeKey } = {}) {
  const root = el('div', 'ceiling', { 'aria-hidden': 'true' });
  const haze = el('div', 'ceiling__haze');
  const art = hazeKey ? createLayer({ key: hazeKey, kind: 'light', note: 'Trapped haze under the ceiling' }) : null;
  const line = el('div', 'ceiling__line');
  if (art?.hasAsset) haze.append(art.el);
  root.append(haze, line);

  /** y: line position (0 top … 1 bottom). glow: line glow 0..1. density: haze 0..1. */
  const state = { y: 0.3, glow: 1, density: 0.6, opacity: 1 };

  function render() {
    root.style.opacity = String(state.opacity);
    root.style.setProperty('--ceiling-y', `${(state.y * 100).toFixed(2)}%`);
    root.style.setProperty('--ceiling-glow', state.glow.toFixed(3));
    // Lower ceiling → the same smoke in less air → denser band.
    const squeeze = 1 + (state.y - 0.3) * 1.6;
    root.style.setProperty('--ceiling-density', (state.density * squeeze).toFixed(3));
  }

  return { el: root, state, render };
}
