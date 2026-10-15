/**
 * Scene template — copy to sceneNN-name.js and register it in ./index.js.
 *
 * ctx (from src/core/sceneRunner.js):
 *   viewport   sticky full-screen box; sky + horizon glow are already its first children
 *   tl         GSAP timeline scrubbed by scroll over this scene; positions are 0..1
 *   atmo       { bg, horizon, followClock } — tween these to change the sky
 *   clock      { progress, visible } — tween progress 0→1 to run the clock from → to
 *   motion     { reduced, parallax, timeScale }
 *   onTick(fn) per-frame callback while on screen, fn(timeSeconds)
 *   addVideo(v) play/pause a light-layer <video> with the scene
 *   whenNear(fn) run once when the scene first approaches (lazy loads)
 *
 * Start states: use gsap.set() or tl.fromTo(), never tl.set(..., 0) — the runner rewinds the
 * timeline to 0 once at mount, and rewinding undoes anything set AT 0.
 */
import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { createLayer } from '../components/layers.js';

export default {
  id: 'template',
  number: 0,
  title: 'Untitled',
  length: 5,
  clock: { from: '1:00 PM', to: '2:00 PM' },
  atmosphere: { bg: tokens.color.sky.afternoon, horizon: 1, followClock: 1 },

  build({ viewport: v, tl, clock, motion }) {
    const far = createLayer({ key: 'sceneN/far', note: 'Farthest silhouette', band: { top: 0.5, height: 0.5 } });
    const line = el('p', 's-lead', {}, 'A story line.');
    v.append(far.el, line);

    tl.to(clock, { visible: 1, duration: 0.05 }, 0);
    tl.to(clock, { progress: 1, duration: 1 }, 0);
    tl.from(far.el, { yPercent: 30 * motion.parallax, duration: 0.4 }, 0.1);
  },
};
