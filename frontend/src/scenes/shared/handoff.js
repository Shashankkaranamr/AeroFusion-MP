/**
 * What Scene 1 hands to Scene 2 at the cut — both scenes build their last/first frame from
 * these, so the cut is invisible.
 *
 * The rendered video's ball sits dead centre of a 16:9 frame. We frame that video (scale +
 * offset) so its spark lands exactly where our particle is waiting — on the left. The spark
 * never travels to the middle.
 *
 * Scene 1 does the blast with our own particle and fades the video in underneath only once the
 * video's ball has shrunk to a spark (HANDOFF.first); it ends on HANDOFF.last, Scene 2's first
 * frame. The video's own burst (flat disc + flat brown shock ring, frames 0–12) is never shown.
 */
import { isMobile } from '../../core/motion.js';
import { diameterFor } from '../../components/particle.js';

/** Where the particle waits while the headline reads. Desktop: left. Phones: above the text. */
export const ASIDE = () => (isMobile() ? { x: 0.5, y: 0.3 } : { x: 0.3, y: 0.5 });

/**
 * The render (assets/scene2, 360 frames, 16:9): ember → burst → spark falls → field fire →
 * drone view. 1920-wide frames; phones and small screens get the 1280-wide set.
 */
export const SEQUENCE = () => (window.innerWidth < 900 ? 'scene2/webp-1280' : 'scene2/webp');
export const FRAMES = 360;

/**
 * Frames where Scene 1 picks the video up / ends. The render's own burst (a flat brown shock
 * disc, ~frames 44–58) is never shown; by 68 its ball is small enough to sit inside our
 * shrinking core, and from 72 its spark sits still at frame centre.
 */
export const HANDOFF = { first: 68, last: 78 };

/** The video's spark at HANDOFF.last: white-hot core width as a fraction of frame width
 *  (measured: ~28px of 1920, plus the glow's bright shoulder). */
const VIDEO_SPARK = 0.0155;
const VIDEO_ASPECT = 16 / 9;

/**
 * Transform that puts the video frame's centre on ASIDE while still covering the screen:
 * translate by the offset, scale up just enough that no edge shows.
 */
export function framing() {
  const a = ASIDE();
  const tx = a.x - 0.5;
  const ty = a.y - 0.5;
  const scale = 1 + 2 * Math.max(Math.abs(tx), Math.abs(ty));
  return { xPercent: tx * 100, yPercent: ty * 100, scale };
}

/** Particle scale at which our burning core matches the framed video's spark on this screen. */
export function SPARK_SCALE() {
  // The box the sequence actually fills: the page width WITHOUT the scrollbar, the full height.
  const w = document.documentElement.clientWidth;
  const h = window.innerHeight;
  const coverWidth = Math.max(w, h * VIDEO_ASPECT); // drawn cover-fit, centred (frameSequence)
  return (VIDEO_SPARK * coverWidth * framing().scale) / diameterFor();
}

/** The video's background colour (sampled from its dark frames). */
export const VIDEO_BG = '#0a0311';

/**
 * The 10 µm scale bar, true to the particle at rest: it is 2.5 µm across, so 10 µm is four of
 * it. Both scenes show it across the cut, so it is defined once here.
 */
export const TEN_MICRONS = { label: '10 µm', length: () => 4 * diameterFor() };
