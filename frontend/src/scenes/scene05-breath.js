import { gsap } from 'gsap';
import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { idle } from '../core/idle.js';
import { createCaption } from '../components/caption.js';
import { createScaleBar } from '../components/scaleBar.js';
import { createReveal } from '../components/reveal.js';
import { story } from '../data/story.js';

const { color } = tokens;

/**
 * SCENE 05 — THE BREATH
 *
 * One continuous dive, not three stages. Clinical and quiet; the restraint is what lands.
 * A live Three.js world (./breath/world.js): street → face → nose → windpipe → bronchi → one air
 * sac, ten metres to ten micrometres in a single camera move.
 *
 *   4.1  grey dawn, street level, first person; a chai stall, an auto-rickshaw, haze; a small
 *        reading in the corner — the forecast for this hour.
 *        "[6:10 AM]. Someone steps out for chai."                                       10 m
 *   4.2  a slow push into a face, into the nose, down the windpipe and branching bronchi; the
 *        bigger PM10 dots snag and peel away; ours keeps going.
 *        "Bigger dust gets caught in the nose. You don't."               1 cm → 1 mm → 200 µm
 *   4.3  one translucent air sac; the particle settles on its wall beside a red blood cell
 *        drifting past; motion stops.
 *        "You slip past every defence the body has, into an air sac thinner than a soap bubble.
 *         Here, you stay."                                                               10 µm
 */
export default {
  id: 'breath',
  number: 5,
  title: 'The Breath',
  length: 16,
  joinPrevious: true,
  clock: { from: story.morning.time, to: story.morning.time, visible: 1 },
  atmosphere: { bg: color.sky.dawn, horizon: 0, followClock: 0 },

  build({ viewport: v, tl, clock, motion, onTick, whenNear }) {
    const P = motion.parallax;
    const canvas = el('canvas', 'ride-canvas', { 'aria-hidden': 'true' });
    const dawn = el('div', 'dawn-haze', { 'aria-hidden': 'true' });
    const dark = el('div', 'breath-dark', { 'aria-hidden': 'true' });

    const chai = createCaption([{ text: `${story.morning.time}.`, big: true }, 'Someone steps out for chai.'], 'upper');
    const nose = createCaption(['Bigger dust gets caught in the nose.', { text: "You don't.", big: true }], 'upper');
    const stay = createCaption([
      'You slip past every defence the body has,',
      'into an air sac thinner than a soap bubble.',
      { text: 'Here, you stay.', big: true },
    ], 'upper');
    const reading = el('div', 'breath-reading s-tag', {},
      el('span', 'breath-reading__k', {}, `${story.morning.kind} · ${story.morning.time.replace(/:\d\d/, '')}`),
      el('span', 'breath-reading__v', {}, `PM2.5 ${story.morning.pm25} µg/m³`),
    );
    const scale = createScaleBar([{ label: '10 m' }, { label: '1 cm' }, { label: '1 mm' }, { label: '200 µm' }, { label: '10 µm' }]);

    v.append(canvas, dark, chai.el, nose.el, stay.el, reading, scale.el, dawn);

    const lines = [...chai.lines, ...nose.lines, ...stay.lines];
    gsap.set([...lines, reading, dark], { autoAlpha: 0 });
    gsap.set(dawn, { autoAlpha: 1 });
    gsap.set(scale.steps[0], { autoAlpha: 1 });

    const { lineIn, linesOut } = createReveal(tl, motion);
    const swap = (from, to, at) => {
      tl.to(scale.steps[from], { autoAlpha: 0, duration: 0.01 }, at);
      tl.to(scale.steps[to], { autoAlpha: 1, duration: 0.015 }, at + 0.008);
    };

    const state = { p: 0 };
    tl.fromTo(state, { p: 0 }, { p: 1, duration: 1, ease: 'none' }, 0);

    // Grey dawn clears onto the street.
    tl.fromTo(dawn, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.06, ease: 'sine.out' }, 0.005);
    // 4.1
    tl.fromTo(reading, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.05);
    lineIn(chai.lines[0], 0.07);
    lineIn(chai.lines[1], 0.1);
    linesOut(chai.lines, 0.2);
    tl.to(reading, { autoAlpha: 0, duration: 0.02 }, 0.27);
    // 4.2 — into the nose: a breath of darkness at the nostril, the corner clock goes quiet.
    swap(0, 1, 0.25);
    tl.to(clock, { visible: 0, duration: 0.03 }, 0.29);
    tl.fromTo(dark, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.014, ease: 'sine.in' }, 0.322);
    tl.to(dark, { autoAlpha: 0, duration: 0.02, ease: 'sine.out' }, 0.338);
    lineIn(nose.lines[0], 0.38);
    lineIn(nose.lines[1], 0.43);
    linesOut(nose.lines, 0.55);
    swap(1, 2, 0.47);
    swap(2, 3, 0.68);
    // 4.3
    swap(3, 4, 0.8);
    lineIn(stay.lines[0], 0.84);
    lineIn(stay.lines[1], 0.875);
    lineIn(stay.lines[2], 0.93, 0.03);

    /* ------------------------------------------------------------- the world -- */
    let world = null;
    const size = () => world?.resize(v.clientWidth, v.clientHeight);
    // Built and compiled ahead of time, in the background (core/idle.js).
    const job = idle.add(async () => {
      const { createBreathWorld } = await import('./breath/world.js');
      const w = createBreathWorld({ canvas });
      w.resize(v.clientWidth, v.clientHeight);
      await w.prepare(() => w.render(0, 0));
      world = w;
    });
    whenNear(() => job.now());
    window.addEventListener('resize', size);

    let living = 0;
    let last = null;
    onTick((t) => {
      living += last === null ? 0 : Math.min(0.1, t - last) * motion.timeScale;
      last = t;
      world?.render(state.p, living);
    });
  },
};
