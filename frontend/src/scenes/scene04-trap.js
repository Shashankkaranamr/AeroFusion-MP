import { gsap } from 'gsap';
import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { idle } from '../core/idle.js';
import { createCaption } from '../components/caption.js';
import { createScaleBar } from '../components/scaleBar.js';
import { createReveal } from '../components/reveal.js';
import { story, trap, nightAt } from '../data/story.js';

const { color } = tokens;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Scroll is time: 6 PM at CLOCK[0], 2 AM at CLOCK[1], then everything holds. */
const CLOCK = [0.05, 0.82];
const HOURS = (story.night.length - 1) * 60;

/** A round step for the altitude ruler, so it shows about five ticks. */
function niceStep(range) {
  const raw = range / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw);
}
const metres = (m) => `${Math.round(m).toLocaleString('en-IN')} m`;

/**
 * SCENE 04 — THE TRAP
 *
 * The signature scene, kept whole. Same side-on frame as step 1.4, now over Delhi: India Gate,
 * apartment blocks, a flyover, Qutub Minar. Scrolling is time, 6 PM to 2 AM. The particle count
 * never changes; only the room does. A live Three.js world (./trap/world.js).
 *
 *   3.1  we drop out of the dome into the side view; ceiling at [1,500] m; particles spread
 *        loosely beneath it; the PM2.5 counter appears beside the altitude ruler.
 *        "Remember the ceiling? At sunset, it starts to fall."                          1 km
 *   3.2  sky darkens; the ceiling drops to [800] m, then [300] m; particles crowd; counter climbs.
 *        "The ground cools. The air goes still. The ceiling keeps dropping."           1 km
 *   3.3  ceiling at [150] m; particles a dense glowing smear pressed against the rooftops.
 *        "[2 AM]. The ceiling is [150] metres up. Barely twice the height of Qutub Minar."
 *                                                                                      100 m
 *   3.4  everything holds still; the counter freezes at its peak.
 *        "Nothing left. Nothing added. Just less room."                                100 m
 *
 * Values: story.night (hourly pblh, pm25, wind) in src/data/story.js. The ceiling label, ruler
 * and counter read the same interpolated hour, so the numbers on screen are the data.
 */
export default {
  id: 'trap',
  number: 4,
  title: 'The Trap',
  length: 15,
  joinPrevious: true,
  clock: { from: trap.startTime, to: trap.endTime, visible: 1 },
  atmosphere: { bg: color.sky.dusk, horizon: 0, followClock: 0 },

  build({ viewport: v, tl, atmo, clock, motion, onTick, whenNear }) {
    const P = motion.parallax;

    const canvas = el('canvas', 'ride-canvas', { 'aria-hidden': 'true' });
    // The inside of the dome we dived into at the end of Scene 3: we fall out of it.
    const haze = el('div', 'dome-haze', { 'aria-hidden': 'true' });
    // Night gives way to a grey morning: the haze Scene 5 opens in.
    const dawn = el('div', 'dawn-haze', { 'aria-hidden': 'true' });

    /* ------------------------------------------------------------- the words -- */
    const remember = createCaption([
      { text: 'Remember the ceiling?', big: true },
      'At sunset, it starts to fall.',
    ], 'upper');
    const cooling = createCaption(['The ground cools.', 'The air goes still.', 'The ceiling keeps dropping.'], 'upper');
    const late = createCaption([
      { text: `${trap.endTime}.`, big: true },
      `The ceiling is ${trap.ceilingEnd} metres up.`,
      trap.qutubLine,
    ], 'upper');
    const room = createCaption([
      { text: 'Nothing left.', big: true },
      { text: 'Nothing added.', big: true },
      { text: 'Just less room.', big: true },
    ], 'upper');

    /* -------------------------------------------- ruler, counter, ceiling -- */
    const ruler = el('div', 'trap-ruler', { 'aria-hidden': 'true' });
    const rulerLine = el('span', 'trap-ruler__line');
    const ticks = Array.from({ length: 14 }, () => {
      const t = el('span', 'trap-ruler__tick s-tag');
      ruler.append(t);
      return t;
    });
    ruler.prepend(rulerLine);
    const ceilingLabel = el('div', 'trap-ceiling s-tag', { 'aria-hidden': 'true' }, el('span', '', {}, 'The ceiling'), el('span', 'trap-ceiling__value', {}, ''));
    const counter = el('div', 'trap-counter', { role: 'status' },
      el('span', 'trap-counter__label s-tag', {}, 'PM2.5 · Delhi'),
      el('span', 'trap-counter__value', {}, el('span', 'trap-counter__digits', {}, '—'), el('span', 'trap-counter__unit', {}, 'µg/m³')),
      el('span', 'trap-counter__peak s-tag', {}, 'Peak · holding'),
    );
    const digits = counter.querySelector('.trap-counter__digits');
    const peakTag = counter.querySelector('.trap-counter__peak');
    const qutub = el('div', 'trap-landmark s-tag', { 'aria-hidden': 'true' }, `Qutub Minar · ${story.qutubMetres} m`);
    const scale = createScaleBar([{ label: '1 km' }, { label: '100 m' }]);

    v.append(canvas, haze, dawn, remember.el, cooling.el, late.el, room.el, ruler, ceilingLabel, counter, qutub, scale.el);

    const lines = [...remember.lines, ...cooling.lines, ...late.lines, ...room.lines];
    gsap.set([...lines, ruler, ceilingLabel, counter, peakTag, qutub], { autoAlpha: 0 });
    gsap.set(haze, { autoAlpha: 1 });
    gsap.set(dawn, { autoAlpha: 0 });
    gsap.set(scale.steps[0], { autoAlpha: 1 });

    const { lineIn, linesOut } = createReveal(tl, motion);

    /* -------------------------------------------------------------- timeline -- */
    const state = { q: 0 };
    tl.fromTo(state, { q: 0 }, { q: 1, duration: 1, ease: 'none' }, 0);
    tl.fromTo(haze, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.08, ease: 'sine.out' }, 0.012);
    tl.to(atmo, { bg: color.sky.night, duration: 0.3 }, 0.1);

    // 3.1
    tl.fromTo([ruler, counter, ceilingLabel], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, 0.07);
    lineIn(remember.lines[0], 0.08);
    lineIn(remember.lines[1], 0.12);
    linesOut(remember.lines, 0.2);
    // 3.2
    lineIn(cooling.lines[0], 0.26);
    lineIn(cooling.lines[1], 0.33);
    lineIn(cooling.lines[2], 0.4);
    linesOut(cooling.lines, 0.56);
    // 3.3
    tl.to(scale.steps[0], { autoAlpha: 0, duration: 0.015 }, 0.62);
    tl.to(scale.steps[1], { autoAlpha: 1, duration: 0.02 }, 0.63);
    lineIn(late.lines[0], 0.76);
    lineIn(late.lines[1], 0.79);
    lineIn(late.lines[2], 0.82);
    tl.fromTo(qutub, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.82);
    linesOut(late.lines, 0.885);
    tl.to(qutub, { autoAlpha: 0, duration: 0.02 }, 0.885);
    // 3.4
    tl.fromTo(peakTag, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.86);
    lineIn(room.lines[0], 0.9);
    lineIn(room.lines[1], 0.925);
    lineIn(room.lines[2], 0.95);
    tl.to([...room.lines, ruler, ceilingLabel, counter, peakTag, scale.steps[1]], { autoAlpha: 0, duration: 0.012 }, 0.982);
    tl.fromTo(dawn, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.018, ease: 'sine.in' }, 0.982);

    /* ------------------------------------------------------------- the world -- */
    let world = null;
    const size = () => world?.resize(v.clientWidth, v.clientHeight);
    // Built and compiled ahead of time, in the background (core/idle.js).
    const job = idle.add(async () => {
      const { createTrapWorld } = await import('./trap/world.js');
      const w = createTrapWorld({ canvas });
      w.resize(v.clientWidth, v.clientHeight);
      const first = story.night[0];
      await w.prepare(() => w.render({ q: 0, time: 0, night: 0, pblh: first[1], wind: first[3], still: 0 }));
      world = w;
    });
    whenNear(() => job.now());
    window.addEventListener('resize', size);

    let living = 0;
    let last = null;
    let shownPm = -1;
    // Write to the DOM only when a value actually changes (a style write per frame per element
    // is invisible work that still costs style recalcs while the reader scrolls).
    const put = (node, prop, value) => {
      if (node.__last?.[prop] === value) return;
      (node.__last ??= {})[prop] = value;
      node.style[prop] = value;
    };
    const text = (node, value) => {
      if (node.__text === value) return;
      node.__text = value;
      node.textContent = value;
    };
    onTick((t) => {
      const q = state.q;
      const hours = clamp01((q - CLOCK[0]) / (CLOCK[1] - CLOCK[0]));
      clock.progress = hours;
      const now = nightAt(hours * HOURS);
      // 3.4: everything holds still.
      const still = smooth(CLOCK[1], CLOCK[1] + 0.05, q);
      living += last === null ? 0 : Math.min(0.1, t - last) * motion.timeScale;
      last = t;
      if (!world) return;
      const f = world.render({ q, time: living, night: smooth(0, 0.4, hours), pblh: now.pblh, wind: now.wind, still });

      // Ruler: ground to the top of the frame, round ticks.
      // Start below the clock (and, on phones, below the centred words).
      const top = Math.max(v.clientHeight * (v.clientWidth < 640 ? 0.32 : 0.16), f.top);
      const step = niceStep(f.metresPerPx * (f.ground - top));
      put(ruler, 'transform', `translateY(${top.toFixed(1)}px)`);
      put(rulerLine, 'transform', `scaleY(${(f.ground - top).toFixed(1)})`);
      ticks.forEach((tick, i) => {
        const h = i * step;
        const y = f.ground - h / f.metresPerPx;
        if (y < top + 8) {
          put(tick, 'visibility', 'hidden');
          return;
        }
        put(tick, 'visibility', 'visible');
        put(tick, 'transform', `translateY(${(y - top).toFixed(1)}px)`);
        text(tick, i === 0 ? '0' : metres(h));
      });
      // Ceiling label rides the line.
      put(ceilingLabel, 'transform', `translateY(${f.ceiling.toFixed(1)}px)`);
      text(ceilingLabel.lastChild, metres(Math.round(now.pblh / 10) * 10));
      // Counter: the hour's PM2.5; it stops when time does.
      const pmNow = Math.round(now.pm25);
      if (pmNow !== shownPm) {
        digits.textContent = String(pmNow);
        shownPm = pmNow;
      }
      put(qutub, 'transform', `translate(${f.qutubX.toFixed(1)}px, ${f.qutubY.toFixed(1)}px) translate(-50%, -140%)`);
    });
  },
};
