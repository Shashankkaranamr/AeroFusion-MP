import { tokens } from '../tokens.js';

const query = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Live motion preferences. Components read these every frame, so toggling the OS setting
 * takes effect without a reload (except scrub smoothing, which is set when scenes mount).
 */
export const motion = {
  reduced: query.matches,
  /** Multiply parallax distances by this. */
  get parallax() {
    return this.reduced ? tokens.motion.reducedParallax : 1;
  },
  /** Multiply internal animation clocks (particle swirl, dust drift) by this. */
  get timeScale() {
    return this.reduced ? tokens.motion.reducedTimeScale : 1;
  },
};

query.addEventListener('change', (e) => {
  motion.reduced = e.matches;
  document.documentElement.classList.toggle('reduced-motion', e.matches);
});
document.documentElement.classList.toggle('reduced-motion', motion.reduced);

export const isMobile = () => window.innerWidth < tokens.breakpoints.mobile;
