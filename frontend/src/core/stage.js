import { el } from './dom.js';
import { createGrain } from '../components/grain.js';

/**
 * The global stage: film grain and vignette over everything, and the two live atmosphere
 * values every scene paints with — the background colour (--sky) and the horizon-glow
 * strength (--horizon).
 *
 * The sky itself is drawn INSIDE each scene viewport (see atmosphereLayers) rather than once
 * behind the page. Light layers use mix-blend-mode: screen, and a blend only reaches what is
 * painted inside its own stacking context; a sticky viewport is one. Sky inside → the black
 * of a fire video vanishes into the sky colour instead of showing as a black box.
 */
export function createStage(parent = document.body) {
  const root = document.documentElement;
  const vignette = el('div', 'vignette', { 'aria-hidden': 'true' });
  const grain = createGrain();
  parent.append(vignette, grain.el);

  let lastSky = '';
  let lastHorizon = -1;

  return {
    /** Called every frame by the scene runner with the active scene's resolved atmosphere. */
    set(sky, horizon) {
      if (sky !== lastSky) {
        root.style.setProperty('--sky', sky);
        lastSky = sky;
      }
      const h = Math.round(horizon * 1000) / 1000;
      if (h !== lastHorizon) {
        root.style.setProperty('--horizon', String(h));
        lastHorizon = h;
      }
    },
  };
}

/** Sky colour + coded horizon glow, first children of a scene viewport. */
export function atmosphereLayers() {
  const frag = document.createDocumentFragment();
  frag.append(
    el('div', 'sky', { 'aria-hidden': 'true' }),
    el('div', 'horizon', { 'aria-hidden': 'true' }),
  );
  return frag;
}
