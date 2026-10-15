import { gsap } from 'gsap';
import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { createFrameSequence } from '../components/frameSequence.js';
import { createCaption } from '../components/caption.js';
import { createScaleBar } from '../components/scaleBar.js';
import { createReveal } from '../components/reveal.js';
import { VIDEO_BG, HANDOFF, SEQUENCE, FRAMES, TEN_MICRONS, framing } from './shared/handoff.js';
import { story, formatLat, formatLon } from '../data/story.js';

const { color } = tokens;

const at = (frame) => frame / (FRAMES - 1);
/** Scene 1 ends on this frame; this scene opens on it. */
const OPEN = HANDOFF.last;
const PLAY = 0.97; // the video runs 0 → 0.97, then the drone view holds
/** Fraction of this scene at which the video reaches `frame` (it plays at an even pace). */
const when = (frame) => ((frame - OPEN) / (FRAMES - 1 - OPEN)) * PLAY;

/**
 * SCENE 02 — THE SPARK
 *
 * Opens on Scene 1's last frame (joinPrevious): the render's white-hot spark on the left, the
 * last embers of the blast around it. Scroll scrubs the render: the spark drifts down into the
 * stubble, the straw catches, the fire spreads, smoke rises and the camera pulls back to the
 * drone view of the farm at dusk. (The blast itself is Scene 1's.)
 *
 * Render frames (assets/scene2/timeline.json) and where they land on this scene's scroll:
 *   78        spark + fading embers (= Scene 1's last frame)    0.00
 *   79–171    fall: the spark drifts down, stubble appears        → when(171)
 *   172–214   landing, catch: first flames and smoke              → when(214)
 *   215–344   pull back: fire spreads, the dusk world fades in    → when(344)
 *   345–359   drone view, held                                    → 1.00
 *   framing   eases from "spark on the left" to full frame during the fall
 *
 * Script, on those beats (story lines top-left, scale bar bottom-right):
 *   1.2  fall       "Yesterday, you didn't exist."                       scale 100 km
 *   1.3  landing    "[1:42 PM]. A field near [Sangrur]."                 scale 10 m
 *        pull back  "A farmer has two weeks between rice and wheat. / Fire is the fastest way
 *                   to clear the field."  + evidence tag bottom-left (coordinates, time, sensor)
 * [bracketed] values come from src/data/story.js.
 */
export default {
  id: 'spark',
  number: 2,
  title: 'The Spark',
  length: 9,
  joinPrevious: true,
  // The clock shows the fire's own time, the same one the words give.
  clock: { from: story.fireTime, to: story.fireTime },
  atmosphere: { bg: VIDEO_BG, horizon: 0, followClock: 0 },

  build({ viewport: v, tl, atmo, clock, motion, onTick }) {
    const P = motion.parallax;

    const seq = createFrameSequence({
      dir: SEQUENCE(),
      note: 'Expected: assets/scene2/webp/frame_0000.webp … (and webp-1280/ for phones)',
    });
    seq.el.classList.add('s2-sequence');

    const yesterday = createCaption([{ text: "Yesterday, you didn't exist.", big: true }], 'upper');
    const field = createCaption([
      `${story.fireTime}. A field near ${story.firePlace}.`,
      'A farmer has two weeks between rice and wheat.',
      'Fire is the fastest way to clear the field.',
    ], 'upper');
    const scale = createScaleBar([TEN_MICRONS, { label: '100 km' }, { label: '10 m' }]);
    const evidence = el('div', 's2-evidence s-tag', {},
      el('span', 's2-evidence__place', {}, 'Punjab, India'),
      el('span', '', {}, `${formatLat(story.fireLat)} ${formatLon(story.fireLon)} · ${story.fireTime}`),
      el('span', '', {}, `Detected by ${story.fireSensor}`),
    );
    v.append(seq.el, yesterday.el, field.el, scale.el, evidence);

    // Frames are what the whole scene is; start fetching as soon as the page is idle, not when
    // the scene scrolls near (the cut into it is instant).
    (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200)))(() => seq.load());
    gsap.set([...yesterday.lines, ...field.lines, evidence], { autoAlpha: 0 });
    // Scene 1 hands over with the 10 µm bar showing.
    gsap.set(scale.steps[0], { autoAlpha: 1 });

    // The video, framed so its spark sits where Scene 1 left it; widens to full frame while the
    // camera follows the spark down.
    tl.fromTo(seq.el,
      { xPercent: () => framing().xPercent, yPercent: () => framing().yPercent, scale: () => framing().scale },
      { xPercent: 0, yPercent: 0, scale: 1, duration: when(160) - when(95), ease: 'sine.inOut' }, when(95));

    // The render is one continuous camera move with its own easing: play it at an even pace.
    seq.state.progress = at(OPEN);
    tl.fromTo(seq.state, { progress: at(OPEN) }, { progress: 1, duration: PLAY, ease: 'none', immediateRender: false }, 0);

    // The clock appears as the spark lands; the vignette/grain tint drifts toward dusk as the
    // world fades in on the pull-back.
    tl.to(clock, { visible: 1, duration: 0.04 }, when(172));
    tl.to(atmo, { bg: color.sky.dusk, duration: when(344) - when(215) }, when(215));

    /* ------------------------------------------------------------- the words -- */
    // Positions here are render frames.
    const { lineIn, linesOut } = createReveal(tl, motion, { inDur: 0.035, outDur: 0.03, stagger: 0.006, at: when });
    const swapScale = (from, to, frame) => {
      tl.to(scale.steps[from], { autoAlpha: 0, duration: 0.02 }, when(frame));
      tl.fromTo(scale.steps[to], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, when(frame) + 0.015);
    };

    // 1.2 — the fall.
    swapScale(0, 1, 92);
    lineIn(yesterday.lines[0], 96);
    linesOut(yesterday.lines, 160);

    // 1.3 — landing, then the pull-back.
    swapScale(1, 2, 174);
    lineIn(field.lines[0], 178);
    lineIn(field.lines[1], 222);
    lineIn(field.lines[2], 248);
    tl.fromTo(evidence, { autoAlpha: 0, y: 8 * P }, { autoAlpha: 1, y: 0, duration: 0.04, ease: 'sine.out' }, when(232));
    linesOut(field.lines, 322);
    // Clear the corner before Scene 3 takes over from the drone view.
    tl.to(evidence, { autoAlpha: 0, duration: 0.02, ease: 'sine.in' }, 0.975);

    onTick(() => seq.render());
  },
};
