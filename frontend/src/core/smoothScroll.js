import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tokens } from '../tokens.js';
import { motion } from './motion.js';

/**
 * Smooth, inertial scrolling (Lenis), driven by GSAP's ticker so the scroll position and every
 * scrubbed timeline are updated in the SAME frame — no one-frame lag between them, which is
 * what reads as jitter.
 *
 * Only for the story: once the page locks into the dashboard, stop() hands scrolling back to the
 * browser (maps, drawers and charts expect native scroll), and start() takes it again on the way
 * back. Off under prefers-reduced-motion (native scroll). Touch devices keep native scrolling too
 * (Lenis default): their own momentum already feels right, and hijacking it feels worse.
 */
export function createSmoothScroll() {
  let lenis = null;
  if (!motion.reduced) {
    // First in the ticker: the scroll position (and with it every scrubbed timeline) is settled
    // before any scene draws, so canvases and DOM always show the same frame.
    gsap.ticker.add((time) => lenis?.raf(time * 1000), false, true);
    // Lenis needs every frame's real delta; lag smoothing would make it jump after a stall.
    gsap.ticker.lagSmoothing(0);
  }

  return {
    get lenis() {
      return lenis;
    },
    start() {
      if (lenis || motion.reduced) return;
      lenis = new Lenis({
        lerp: tokens.timing.smoothScroll.lerp,
        wheelMultiplier: tokens.timing.smoothScroll.wheelMultiplier,
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
    },
    stop() {
      lenis?.destroy();
      lenis = null;
    },
  };
}
