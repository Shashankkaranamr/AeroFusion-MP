import { gsap } from 'gsap';
import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { idle } from '../core/idle.js';
import { createCaption } from '../components/caption.js';
import { createScaleBar } from '../components/scaleBar.js';
import { createReveal } from '../components/reveal.js';
import { createFrameSequence } from '../components/frameSequence.js';
import { clockAt } from '../core/timeOfDay.js';
import { story, ride, SAFE_LIMIT } from '../data/story.js';
import { pathAt, STEP, PRE, TV, rideP, sceneP, tvAt } from './ride/timing.js';

const { color } = tokens;

/** Ride p at which the particle reaches path position s (pathAt is monotone). */
function pAt(s) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (pathAt(mid) < s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * SCENE 03 — THE RIDE
 *
 * The journey and the arrival are one scene; the live number is the reward at the end.
 * A live Three.js world (./ride/world.js), styled like the Scene 2 render, scrubbed by scroll.
 *
 *   0    the farm-to-orbit transition (references/new transition from farm), as frames: it opens
 *        on Scene 2's last frame - rendered in Scene 2's own world, which carries on burning while
 *        the camera climbs up through the smoke over a plain full of fires into a cloud deck -
 *        then the transition's own orbit: the satellite finds the fire. Its dive wipe falls, and
 *        the live ride arrives under it at full cover, descending onto the particle.
 *                                                              10 m -> 1 km -> 1,000 km -> 10 km
 *   2.1  the chase cam behind and above the particle; dark terrain map, faint wind streamlines;
 *        the glowing trail starts.
 *        "A [northwest] wind. [3] metres per second. Walking pace."                 10 km
 *   2.2  city names slide past underneath; other fires' trails join ours until a thin stream
 *        is a river of light; the corner clock runs; the light turns to dusk.
 *        "[Patiala]. You pass overhead. Nobody looks up."  + "path estimated from today's winds"
 *                                                                                     10 km
 *   2.3  the camera lifts and slows; a hazy glow rises ahead; the city domes merge into one.
 *        "[26] hours later, a glow ahead."                                          100 km
 *   2.4  high oblique over the city; the trail plunges into a brown dome; the number, big.
 *        "[Delhi], [9:40 PM]. You're one of billions arriving tonight.
 *         [184] µg/m³. [Three] times India's safe limit."                           10 km
 *
 * [bracketed] values: src/data/story.js (travel time = path ÷ wind; arrival = fire time + travel
 * time; times = pm25 ÷ 60). Both cuts in the opening are hidden at a wipe's full cover, where
 * both sides draw the same pixels (see scenes/ride/diveWipe.js and assets/scene3/README.md).
 * Ends by diving into the dome: its brown haze fills the screen, and Scene 4 falls out of it.
 */
export default {
  id: 'ride',
  number: 3,
  title: 'The Ride',
  length: 20.5,
  joinPrevious: true,
  // At a steady wind, time is distance: the clock runs with the particle (see onTick).
  clock: { from: story.fireTime, to: ride.arrival, days: ride.days, visible: 1 },
  atmosphere: { bg: color.sky.dusk, horizon: 0, followClock: 0 },

  build({ viewport: v, tl, atmo, clock, motion, onTick, whenNear }) {
    const P = motion.parallax;

    /* ------------------------------------------------------------- the world -- */
    const canvas = el('canvas', 'ride-canvas', { 'aria-hidden': 'true' });
    const labels = el('div', 'ride-labels', { 'aria-hidden': 'true' });
    // The transition, as frames (1920x1080; phones get the 1280 set). Cover-fit, centred.
    const seq = createFrameSequence({ dir: window.innerWidth < 900 ? 'scene3/rise-1280' : 'scene3/rise' });
    seq.el.classList.add('ride-seq');
    const dive = el('div', 'dome-haze', { 'aria-hidden': 'true' });

    /* ------------------------------------------------------------- the words -- */
    const wind = createCaption([
      { text: `A ${story.windFrom} wind.`, big: true },
      `${story.windMs} metres per second.`,
      'Walking pace.',
    ], 'upper');
    const pass = createCaption([
      { text: `${story.passCity}.`, big: true },
      'You pass overhead.',
      'Nobody looks up.',
    ], 'upper');
    const later = createCaption([{ text: `${ride.hours} hours later, a glow ahead.`, big: true }], 'upper');
    const arrive = createCaption([
      { text: `${ride.destination}, ${ride.arrival}.`, big: true },
      "You're one of billions arriving tonight.",
    ], 'upper');
    const estimate = el('div', 'ride-note s-tag', {}, "Path estimated from today's winds");

    // The live number.
    const number = el('div', 'ride-number', { role: 'status' });
    const value = el('div', 'ride-number__value', {}, el('span', 'ride-number__digits', {}, String(story.pm25)), el('span', 'ride-number__unit', {}, 'µg/m³'));
    const category = el('div', 'ride-number__category s-tag', {}, `${ride.category} · PM2.5 now`);
    const times = el('p', 's-lead ride-number__times', {}, `${ride.timesWord} times India's safe limit.`);
    const limit = el('div', 'ride-number__limit s-tag', {}, `Safe limit: ${SAFE_LIMIT} µg/m³ (24-hour)`);
    number.append(category, value, times, limit);

    const scale = createScaleBar([{ label: '10 m' }, { label: '10 km' }, { label: '100 km' }, { label: '1 km' }, { label: '1,000 km' }]);

    v.append(canvas, seq.el, labels, wind.el, pass.el, later.el, arrive.el, estimate, number, scale.el, dive);

    const lines = [...wind.lines, ...pass.lines, ...later.lines, ...arrive.lines];
    gsap.set([...lines, estimate, category, value, times, limit], { autoAlpha: 0 });
    gsap.set(scale.steps[0], { autoAlpha: 1 }); // Scene 2 hands over with it showing
    gsap.set(dive, { autoAlpha: 0 });

    const { lineIn, linesOut } = createReveal(tl, motion, { inDur: 0.02, outDur: 0.018, stagger: 0.004 });
    const swapScale = (from, to, at) => {
      tl.to(scale.steps[from], { autoAlpha: 0, duration: 0.012 }, at);
      tl.to(scale.steps[to], { autoAlpha: 1, duration: 0.018 }, at + 0.01);
    };

    /* -------------------------------------------------------------- timeline -- */
    const state = { p: 0 };
    tl.fromTo(state, { p: 0 }, { p: 1, duration: 1, ease: 'none' }, 0);

    // The transition: frames, on the transition's own clock. At PRE.seq both sides of the cut are
    // under the dive wipe's full cover, so the frames simply step aside for the live ride.
    tl.fromTo(seq.state, { progress: 0 }, { progress: 1, duration: PRE.seq, ease: 'none', immediateRender: false }, 0);
    tl.set(seq.el, { autoAlpha: 0 }, PRE.seq + 0.0005);
    // The live world's city labels belong to the live world: hidden while the frames play.
    // (and until the dive wipe has cleared off them).
    gsap.set(labels, { autoAlpha: 0 });
    const clear = PRE.seq + ((11.15 - TV.cut) / (TV.settle - TV.cut)) * (PRE.desc - PRE.seq);
    tl.fromTo(labels, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, clear);
    const atTV = (t) => (t / TV.cut) * PRE.seq; // a moment of the transition, on this timeline
    swapScale(0, 3, atTV(2.6)); // climbing: 1 km
    swapScale(3, 4, atTV(5.2)); // in orbit: 1,000 km
    swapScale(4, 1, PRE.desc - 0.02); // down on the particle: 10 km
    tl.to(atmo, { bg: color.sky.night, duration: 0.3 }, sceneP(0.36));

    // 2.1 — the wind, as the camera settles in behind the particle.
    lineIn(wind.lines[0], PRE.desc - 0.03);
    lineIn(wind.lines[1], PRE.desc - 0.012);
    lineIn(wind.lines[2], PRE.desc + 0.006);
    linesOut(wind.lines, sceneP(STEP.s21[1]) - 0.02);

    // 2.2 — over the first city.
    const at = sceneP(pAt(ride.passS));
    lineIn(pass.lines[0], at - 0.045);
    lineIn(pass.lines[1], at - 0.02);
    lineIn(pass.lines[2], at + 0.005);
    linesOut(pass.lines, at + 0.05);
    tl.fromTo(estimate, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, sceneP(STEP.s22[0]));
    tl.to(estimate, { autoAlpha: 0, duration: 0.02 }, sceneP(STEP.s22[1]) - 0.02);

    // 2.3 — a glow ahead.
    swapScale(1, 2, sceneP(STEP.s23[0]));
    lineIn(later.lines[0], sceneP(STEP.s23[0] + 0.04));
    linesOut(later.lines, sceneP(STEP.s23[1] - 0.03));

    // 2.4 — arrival, and the number.
    swapScale(2, 1, sceneP(STEP.s24[0]));
    lineIn(arrive.lines[0], sceneP(STEP.s24[0] + 0.03));
    lineIn(arrive.lines[1], sceneP(STEP.s24[0] + 0.06));
    tl.fromTo(category, { autoAlpha: 0, y: 10 * P }, { autoAlpha: 1, y: 0, duration: 0.02 }, sceneP(0.86));
    tl.fromTo(value, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.03, ease: 'power2.out' }, sceneP(0.865));
    tl.fromTo(times, { autoAlpha: 0, y: 10 * P }, { autoAlpha: 1, y: 0, duration: 0.02 }, sceneP(0.89));
    tl.fromTo(limit, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.015 }, sceneP(0.905));

    // Then down into the dome: the words clear, the camera dives, and its haze fills the screen.
    tl.to([category, value, times, limit, ...arrive.lines], { autoAlpha: 0, duration: 0.012, ease: 'sine.in' }, sceneP(0.95));
    tl.to(scale.steps[1], { autoAlpha: 0, duration: 0.012 }, sceneP(0.95));
    tl.fromTo(dive, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.025, ease: 'sine.in' }, sceneP(0.965));

    /* ------------------------------------------------------------- the world -- */
    let world = null;
    const size = () => world?.resize(v.clientWidth, v.clientHeight);
    // Three.js and the world are only fetched when the scene comes near.
    // The visible fraction of a 16:9 frame drawn cover-fit on this screen (for the dive wipe).
    const crop = [1, 1];
    const measureCrop = () => {
      const w = v.clientWidth;
      const h = v.clientHeight;
      const k = Math.max(w / 1920, h / 1080);
      crop[0] = w / k / 1920;
      crop[1] = h / k / 1080;
    };
    measureCrop();
    window.addEventListener('resize', measureCrop);
    // Built and compiled ahead of time, in the background (core/idle.js); the world only goes
    // live once its first frame costs no more than any other.
    const job = idle.add(async () => {
      seq.load();
      const { createWorld } = await import('./ride/world.js');
      const w = createWorld({ canvas, labels });
      w.resize(v.clientWidth, v.clientHeight);
      await w.prepare(() => w.render(rideP(PRE.seq), 0, clockAt(clock.from, clock.to, 0, clock.days), { desc: 0, tv: TV.cut, crop }));
      world = w;
    });
    whenNear(() => job.now());
    window.addEventListener('resize', size);

    let clockTime = 0;
    let last = null;
    const arrival = { desc: 0, tv: 0, crop };

    onTick((t) => {
      const p = state.p;
      const r = rideP(p);
      // The clock runs with the particle: at a steady wind, time is distance.
      clock.progress = pathAt(r);
      // Living motion (wind, flowing light, flicker) on its own clock, slowed for reduced motion.
      clockTime += last === null ? 0 : Math.min(0.1, t - last) * motion.timeScale;
      last = t;
      seq.render();
      // The live world only once it can be seen (from just before the cut).
      if (p < PRE.seq - 0.004) return;
      arrival.tv = tvAt(p);
      arrival.desc = Math.min(1, Math.max(0, (p - PRE.seq) / (PRE.desc - PRE.seq)));
      const minutes = clockAt(clock.from, clock.to, clock.progress, clock.days);
      world?.render(r, clockTime, minutes, arrival.desc < 1 || arrival.tv < 11.2 ? arrival : null);
    });
  },
};
