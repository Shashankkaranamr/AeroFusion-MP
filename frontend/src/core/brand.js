import { gsap } from 'gsap';
import { el } from './dom.js';
import { createParticle, diameterFor } from '../components/particle.js';

/**
 * THE BRAND — the orange blob is the logo.
 *
 * Top-left of the bar, exactly where the dashboard's logo sits: the blob, then the spaced
 * wordmark "AEROFUSION" over a mono sub-line. The blob is a live particle (the same component as
 * the story's ember, so it keeps its slow dusty surface), flying in a full-screen layer above the
 * page so it can travel from anywhere to its place in the corner:
 *   - at the end of the story, scrubbed by scroll: Scene 6's gathered blob → the corner, with the
 *     word "AEROFUSION" flying beside it into the wordmark (the scene flies the word);
 *   - on Skip: from wherever the ember is right now → the corner, in one move.
 *
 * Positions are fractions of the viewport; `scale` is the particle's own scale (1 = the ember's
 * size at rest).
 */
const MARK = 24; // px: the blob's size in the logo (components/brand/logo.tsx: <Ember size={24}>)
export const BRAND_EASE = gsap.parseEase('power3.inOut');
/** The arc's lift at mid-flight, as a fraction of the viewport height. */
export const BRAND_LIFT = 0.06;

function createBrand() {
  const layer = el('div', 'brand-fly', { 'aria-hidden': 'true' });
  const bar = el('a', 'brand', { href: '#top', 'aria-label': 'AeroFusion — back to the beginning' });
  const mark = el('span', 'brand__mark', { 'aria-hidden': 'true' });
  const word = el('span', 'brand__word', {}, 'AeroFusion');
  const sub = el('span', 'brand__sub', {}, 'Air · 33 cities · live');
  bar.append(mark, el('span', 'brand__text', {}, word, sub));
  const flyer = createParticle();
  Object.assign(flyer.state, { float: 0, opacity: 0, glow: 1 });
  layer.append(flyer.el);

  const now = { t: 0, reveal: 0, from: { x: 0.5, y: 0.5, scale: 1 } };
  let owner = 'scroll';

  /** The corner, in viewport fractions and particle scale. */
  function dock() {
    const r = mark.getBoundingClientRect();
    return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight, scale: MARK / diameterFor() };
  }

  function apply() {
    const t = now.t;
    const d = dock();
    const e = BRAND_EASE(Math.min(1, Math.max(0, t)));
    // An arc: a little lift on the way, so it flies rather than slides.
    const lift = Math.sin(Math.PI * e) * BRAND_LIFT;
    flyer.state.x = now.from.x + (d.x - now.from.x) * e;
    flyer.state.y = now.from.y + (d.y - now.from.y) * e - lift;
    flyer.state.scale = now.from.scale * (d.scale / now.from.scale) ** e;
    flyer.state.opacity = t > 0.0005 ? 1 : 0;
    // The word lands as the flying one arrives in its place, so the swap can't be seen.
    const landed = t >= 0.999;
    word.style.opacity = landed ? '1' : '0';
    sub.style.opacity = landed ? String(now.reveal) : '0';
    bar.classList.toggle('is-on', landed);
  }

  gsap.ticker.add((time) => {
    if (now.t > 0.0005) flyer.render(time);
    else if (flyer.state.opacity) {
      flyer.state.opacity = 0;
      flyer.render(time);
    }
  });
  window.addEventListener('resize', () => {
    flyer.resize();
    apply();
  });

  bar.addEventListener('click', (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('aerofusion:home'));
  });

  return {
    /** layerParent: the full-screen hud; slot: the bar's top row, where the logo sits. */
    mount(layerParent, slot) {
      layerParent.append(layer);
      slot.prepend(bar);
      flyer.resize();
      apply();
      flyer.el.style.opacity = '0'; // hidden (glow included) until it first flies
      flyer.render(0);
    },
    /**
     * Scroll-driven (Scene 6): t 0 = at `from`, 1 = in the corner; reveal 0..1 brings in the
     * sub-line once landed. Ignored during a Skip flight.
     */
    drive(t, from, reveal = 1) {
      if (owner !== 'scroll') return;
      now.t = t;
      now.reveal = reveal;
      if (from) Object.assign(now.from, from);
      apply();
    },
    /** One move from `from` to the corner (Skip). Resolves when it lands. */
    flyFrom(from, duration = 1.5) {
      owner = 'skip';
      Object.assign(now.from, from);
      now.t = 0.0006;
      now.reveal = 1;
      apply();
      return new Promise((resolve) => {
        gsap.to(now, {
          t: 1,
          duration,
          ease: 'none', // the path itself is eased (power3.inOut)
          onUpdate: apply,
          onComplete: () => {
            owner = 'scroll';
            resolve();
          },
        });
      });
    },
    /** Back out of the corner (the story starts again). */
    reset() {
      owner = 'scroll';
      now.t = 0;
      now.reveal = 0;
      apply();
      flyer.render(0); // clear its last frame (the ticker only draws while it flies)
    },
    /** Where the wordmark sits, for the flying word to land on. */
    wordRect() {
      return word.getBoundingClientRect();
    },
    get docked() {
      return now.t >= 0.999;
    },
    /** Where the story's ember is right now, if it is on screen: () => {x, y, scale} | null. */
    source: null,
    setSource(fn) {
      this.source = fn;
    },
  };
}

export const brand = createBrand();
