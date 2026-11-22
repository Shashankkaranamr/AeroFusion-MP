import { gsap } from 'gsap';
import { el } from '../core/dom.js';
import { createCaption } from '../components/caption.js';
import { createReveal } from '../components/reveal.js';
import { createParticle } from '../components/particle.js';
import { story, LIMITS } from '../data/story.js';
import { firesUpwind } from '../data/india.js';
import { tokens } from '../tokens.js';
import { createHero } from '../components/hero.js';
import { diameterFor } from '../components/particle.js';
import { createField } from './alone/field.js';
import { isMobile } from '../core/motion.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const fmt = (n) => Math.round(n).toLocaleString('en-IN');

/**
 * SCENE 06 — NOT ALONE
 *
 * A hard cut from the most detailed frame (inside a lung) to the most abstract: black, and one
 * orange dot — the same ember, in the same spot, with the same pulse as step 1.1. Then dots, one
 * per 0.1 µg/m³ (0.2 on phones), strictly in proportion: the WHO's safe day, India's limit, the
 * destination's worst day, until you can't find yourself any more. Then every dot is pulled back
 * in, spiralling, to where the ember was: they warm to its orange and pack into one blob — and the
 * blob grows into the closing hero's ball, the AEROFUSION wordmark rising behind it
 * (components/hero.js). Below the hero the page scrolls on into the dashboard.
 *
 *   5.1  black; the orange dot, centred, pulsing. "Weeks. Maybe years. / But you are not alone."
 *   5.2  sparse dots drift in from the edges; counter and thin bar on the left; a one-time
 *        legend "1 dot = 0.1 µg/m³". "15 µg/m³. What the World Health Organization calls safe
 *        for a day."
 *   5.3  four times as many. "60 µg/m³. India's limit. Four times looser."
 *   5.4  a surge to nearly solid grey; the ember gets a faint ring, then is gone; a beat.
 *        "[487] µg/m³. [Delhi]'s worst day of [2024]. [32] times the WHO limit." /
 *        "You can't find yourself any more."
 *   5.5  the dots freeze, then gather into one orange blob where the ember was.
 *        "Yesterday, NASA counted [2,314] fires. [380] were upwind of [Delhi]."
 *        "Every particle came from somewhere."
 *   5.6  the hero: the blob grows and settles over the wordmark, the black lifts to charcoal, and
 *        the hero's furniture comes in (33 cities live, the dashboard's views, Go live). Then it
 *        holds; scrolling on, the dashboard rises under it as a normal page and locks
 *        (core/site.js), the story bar fading as it comes.
 *
 * The pointer pulls the dots like gravity throughout (references/scene 6/gravity_stars.md).
 */
export default {
  id: 'alone',
  number: 6,
  title: 'Not Alone',
  length: 16,
  joinPrevious: true,
  clock: { from: '12:00 AM', visible: 0 },
  atmosphere: { bg: '#050507', horizon: 0, followClock: 0 },

  build({ viewport: v, tl, atmo, motion, hud, onTick, whenNear }) {
    const P = motion.parallax;
    const worst = story.worstDay;
    const timesWho = Math.round(worst.pm25 / LIMITS.who);
    const destination = worst.city;

    let field = null; // the dot field, created when the scene comes near
    let living = 0;

    /* --------------------------------------------------------------- layers -- */
    const canvas = el('canvas', 'alone-canvas', { 'aria-hidden': 'true' });
    const particle = createParticle();
    const ring = el('div', 'alone-ring', { 'aria-hidden': 'true' });
    // The closing hero sits under the particle, so the gathered ball covers its wordmark.
    const hero = createHero();
    v.append(canvas, hero.el, particle.el, ring);
    Object.assign(particle.state, { x: 0.5, y: 0.5, float: 0 });
    /** The hero's ball (as large as the proposal's, over the wordmark), re-read on every refresh. */
    const heroBall = () => {
      hero.fit();
      const b = hero.ball();
      return { y: b.y, scale: Math.max(1.25, Math.min(4.4, b.d / diameterFor())) };
    };

    /* ------------------------------------------------- counter and its bar -- */
    const meter = el('div', 'alone-meter', { role: 'status', 'aria-live': 'off' });
    const digits = el('span', 'alone-meter__digits s-display', {}, '0');
    const fill = el('span', 'alone-meter__fill');
    const bar = el('span', 'alone-meter__bar', {}, fill,
      el('span', 'alone-meter__tick s-tag', { style: `--at:${LIMITS.who / 500}` }, `WHO ${LIMITS.who}`),
      el('span', 'alone-meter__tick s-tag', { style: `--at:${LIMITS.india / 500}` }, `India ${LIMITS.india}`));
    const perDotLabel = isMobile() ? '0.2' : '0.1';
    const legend = el('span', 'alone-meter__legend s-tag', {}, `1 dot = ${perDotLabel} µg/m³`);
    meter.append(el('span', 'alone-meter__value', {}, digits, el('span', 'alone-meter__unit', {}, 'µg/m³')), bar, legend);

    /* -------------------------------------------------------------- words -- */
    const w51 = createCaption(['Weeks. Maybe years.', { text: 'But you are not alone.', big: true }], 'center');
    const w52 = createCaption([{ text: `${LIMITS.who} µg/m³.`, big: true }, 'What the World Health Organization calls safe for a day.'], 'center');
    const w53 = createCaption([{ text: `${LIMITS.india} µg/m³.`, big: true }, "India's limit. Four times looser."], 'center');
    const w54 = createCaption([
      { text: `${fmt(worst.pm25)} µg/m³.`, big: true },
      `${destination}'s worst day of ${worst.year}.`,
      `${timesWho} times the WHO limit.`,
    ], 'center');
    const w54b = createCaption([{ text: "You can't find yourself any more.", big: true }], 'center');
    const w55 = createCaption([
      `Yesterday, NASA counted ${fmt(story.fires.total)} fires.`,
      `${fmt(firesUpwind(destination))} were upwind of ${destination}.`,
    ], 'center');
    const w55b = createCaption([{ text: 'Every particle came from somewhere.', big: true }], 'center');

    v.append(meter, w51.el, w52.el, w53.el, w54.el, w54b.el, w55.el, w55b.el);

    /* -------------------------------------------------------------- timeline -- */
    const { lineIn, linesOut } = createReveal(tl, motion, { inDur: 0.018, outDur: 0.015, stagger: 0.004 });
    const all = [...w51.lines, ...w52.lines, ...w53.lines, ...w54.lines, ...w54b.lines, ...w55.lines, ...w55b.lines];
    gsap.set([...all, ...hero.parts, meter, legend, ring], { autoAlpha: 0 });

    const state = { p: 0, value: 0, drift: 1, gather: 0, warm: 0, fade: 0, ember: 0, site: 0 };
    tl.fromTo(state, { p: 0 }, { p: 1, duration: 1, ease: 'none' }, 0);
    // The concentration: the WHO's day, India's limit, then the surge.
    tl.fromTo(state, { value: 0 }, { value: LIMITS.who, duration: 0.13, ease: 'sine.inOut', immediateRender: false }, 0.1);
    tl.to(state, { value: LIMITS.india, duration: 0.12, ease: 'sine.inOut' }, 0.3);
    tl.to(state, { value: worst.pm25, duration: 0.13, ease: 'power2.in' }, 0.47);
    // Freeze, then every dot is pulled back in to where the ember was, warming to its orange; the
    // ember itself returns out of them; then it grows into the hero's ball.
    tl.to(state, { drift: 0, duration: 0.04, ease: 'sine.out' }, 0.74);
    tl.fromTo(state, { gather: 0 }, { gather: 1, duration: 0.13, ease: 'none', immediateRender: false }, 0.78);
    // While they gather, the bar turns into the site's: Autoplay and Sound fade off, Live dashboard
    // becomes Ask the data (hud.toSite).
    tl.fromTo(state, { site: 0 }, { site: 1, duration: 0.1, ease: 'sine.inOut', immediateRender: false }, 0.8);
    tl.fromTo(state, { warm: 0 }, { warm: 1, duration: 0.07, ease: 'sine.in', immediateRender: false }, 0.84);
    tl.fromTo(state, { fade: 0 }, { fade: 1, duration: 0.03, ease: 'sine.inOut', immediateRender: false }, 0.9);
    tl.fromTo(state, { ember: 0 }, { ember: 1, duration: 0.03, ease: 'sine.out', immediateRender: false }, 0.895);
    tl.fromTo(particle.state, { scale: 1.6 }, { scale: 1.25, duration: 0.03, ease: 'sine.out', immediateRender: false }, 0.895);
    // The hero (5.6): the blob grows and settles over the wordmark as the black lifts to charcoal;
    // the wordmark rises in behind it, then the furniture; then it holds.
    tl.to(atmo, { bg: tokens.color.sky.canvas, duration: 0.04, ease: 'sine.inOut' }, 0.905);
    tl.to(particle.state, { y: () => heroBall().y, scale: () => heroBall().scale, duration: 0.045, ease: 'power2.inOut' }, 0.91);
    tl.fromTo(hero.word, { autoAlpha: 0, y: 60 * P }, { autoAlpha: 1, y: 0, duration: 0.03, ease: 'power2.out', immediateRender: false }, 0.925);
    hero.parts.slice(1).forEach((part, i) => {
      tl.fromTo(part, { autoAlpha: 0, y: 18 * P }, { autoAlpha: 1, y: 0, duration: 0.02, ease: 'sine.out', immediateRender: false }, 0.945 + i * 0.006);
    });

    // 5.1
    lineIn(w51.lines[0], 0.02);
    lineIn(w51.lines[1], 0.05);
    linesOut(w51.lines, 0.09);
    // 5.2
    tl.fromTo(meter, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.1);
    tl.fromTo(legend, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.12);
    tl.to(legend, { autoAlpha: 0, duration: 0.02 }, 0.3); // one time only
    lineIn(w52.lines[0], 0.19);
    lineIn(w52.lines[1], 0.21);
    linesOut(w52.lines, 0.28);
    // 5.3
    lineIn(w53.lines[0], 0.38);
    lineIn(w53.lines[1], 0.4);
    linesOut(w53.lines, 0.46);
    // 5.4 — the ember gets a faint ring, then is gone; a beat.
    tl.fromTo(ring, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.03 }, 0.55);
    tl.to(ring, { autoAlpha: 0, scale: 1.25, duration: 0.03 }, 0.59);
    tl.to(particle.state, { opacity: 0, duration: 0.04, ease: 'sine.in' }, 0.6);
    lineIn(w54.lines[0], 0.6);
    lineIn(w54.lines[1], 0.615);
    lineIn(w54.lines[2], 0.63);
    linesOut(w54.lines, 0.67);
    lineIn(w54b.lines[0], 0.685);
    linesOut(w54b.lines, 0.755);
    tl.to(meter, { autoAlpha: 0, duration: 0.02 }, 0.77);
    // 5.5
    lineIn(w55.lines[0], 0.785);
    lineIn(w55.lines[1], 0.81);
    linesOut(w55.lines, 0.845);
    lineIn(w55b.lines[0], 0.86);
    linesOut(w55b.lines, 0.9);

    /* ------------------------------------------------------------- the field -- */
    const size = () => field?.resize(v.clientWidth, v.clientHeight);
    whenNear(() => {
      field = createField({ canvas, mobile: isMobile() });
      size();
    });
    window.addEventListener('resize', size);
    v.addEventListener('pointermove', (e) => {
      const r = v.getBoundingClientRect();
      field?.setPointer(e.clientX - r.left, e.clientY - r.top, true);
    }, { passive: true });
    for (const t of ['pointerleave', 'pointercancel']) v.addEventListener(t, () => field?.setPointer(0, 0, false));

    let last = null;
    let shown = -1;
    onTick((t) => {
      const dt = last === null ? 0 : Math.min(0.05, t - last);
      last = t;
      living += dt;
      // The ember comes back out of the gathered dots and stays: it is the hero's ball.
      if (state.p >= 0.88) particle.state.opacity = state.ember;
      // The bar becomes the site's; it stays through the hero, and the dashboard's header rises
      // under it into the same place (its Ask the data exactly under ours) and takes over on lock.
      hud.toSite(state.site);
      particle.render(t);
      if (!field) return;
      // The blob's radius: where the ember will be, a little larger (so the ember forms inside it).
      const blob = diameterFor() * 0.5 * 1.25;
      field.render({ value: state.value, drift: state.drift, gather: state.gather, warm: state.warm, fade: state.fade, blob, reduced: motion.reduced, time: living, dt });
      // Counter and bar.
      const val = Math.round(state.value);
      if (val !== shown) {
        digits.textContent = fmt(val);
        shown = val;
      }
      fill.style.transform = `scaleY(${clamp01(state.value / 500).toFixed(4)})`;
    });
  },
};
