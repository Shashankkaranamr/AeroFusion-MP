import { gsap } from 'gsap';
import { tokens } from '../tokens.js';
import { createParticle } from '../components/particle.js';
import { brand } from '../core/brand.js';
import { createFrameSequence } from '../components/frameSequence.js';
import { createCaption } from '../components/caption.js';
import { createScaleBar } from '../components/scaleBar.js';
import { ASIDE, VIDEO_BG, SPARK_SCALE, HANDOFF, SEQUENCE, TEN_MICRONS, framing } from './shared/handoff.js';

const { color } = tokens;

/**
 * SCENE 01 — THE PARTICLE
 *
 * Script step 1.1. The particle alone, dead centre → it steps left as "This is you. 2.5
 * micrometres wide. Thirty times thinner than a human hair." reveals on the right, line by line,
 * with a 10 µm scale bar drawn to the particle's true scale → it ignites, bursts into embers and collapses to a white-hot spark → the rendered
 * video fades in underneath, framed so its spark sits exactly under ours, and takes over.
 *
 * The video's own burst (a flat disc and a flat brown shock ring) is never
 * shown — it doesn't look like our particle. Our particle does the blast; the video joins once
 * only embers and the spark are left (HANDOFF.first), and this scene ends on HANDOFF.last,
 * which is exactly Scene 2's first frame.
 *
 * Timeline (fractions of the scene):
 *   0.00–0.05  opening: only the particle, dead centre
 *   0.05–0.24  particle moves left; the three lines reveal on the right; marker + scale bar in
 *   0.30–0.46  hold to read
 *   0.44–0.56  ignition: the ball heats white-hot, its haze becomes light; the lines leave
 *   0.55–0.82  blast: embers fly out; the ball collapses to the spark; sky → video black
 *   0.60–0.80  video fades in underneath, already past its own burst
 *   0.82–0.95  our spark hands over to the video's and fades
 *   0.60–1.00  video runs on to the hand-off frame
 */
export default {
  id: 'particle',
  number: 1,
  title: 'The Particle',
  length: 4,
  clock: { from: '5:48 PM', to: '5:48 PM' },
  atmosphere: { bg: color.sky.night, horizon: 0, followClock: 0 },

  build({ viewport: v, section, tl, atmo, motion, onTick, whenNear }) {
    const P = motion.parallax;
    const seq = createFrameSequence({ dir: SEQUENCE(), range: [HANDOFF.first, HANDOFF.last] });
    seq.el.classList.add('s1-sequence');
    const particle = createParticle();
    const words = createCaption([
      { text: 'This is you.', big: true },
      '2.5 micrometres wide.',
      'Thirty times thinner than a human hair.',
    ]);
    const scale = createScaleBar([TEN_MICRONS]);
    v.append(seq.el, particle.el, words.el, scale.el);
    whenNear(() => seq.load());

    // Dead centre, perfectly still apart from its own slow surface.
    Object.assign(particle.state, { x: 0.5, y: 0.5, float: 0 });
    // Skip flies the ember from wherever it is now into the logo (core/brand.js).
    brand.setSource(() => (window.scrollY < section.offsetTop + section.offsetHeight - window.innerHeight && particle.state.opacity > 0.3
      ? { x: particle.state.x, y: particle.state.y, scale: particle.state.scale }
      : null));
    // Start states are set directly, not as tl.set at 0 — rewinding a timeline to 0 undoes those.
    gsap.set([...words.lines, seq.el], { autoAlpha: 0 });

    /* ---------------------------------------------------------- step aside, read -- */
    // Function values re-read on every ScrollTrigger refresh (resize / rotate).
    tl.to(particle.state, { x: () => ASIDE().x, y: () => ASIDE().y, duration: 0.19, ease: 'sine.inOut' }, 0.05);
    [0.11, 0.17, 0.22].forEach((at, i) => {
      tl.fromTo(words.lines[i], { autoAlpha: 0, x: (36 - i * 6) * P }, { autoAlpha: 1, x: 0, duration: 0.1, ease: 'sine.out' }, at);
    });
    // Stays through the blast: Scene 2 opens with it and swaps it as the scale changes.
    tl.fromTo(scale.steps[0], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.18);

    /* --------------------------------------------------------------- ignition -- */
    tl.to(particle.state, { heat: 1, duration: 0.12, ease: 'power2.in' }, 0.44);
    tl.to(particle.state, { scale: 1.12, duration: 0.1, ease: 'sine.inOut' }, 0.45);
    words.lines.forEach((line, i) => {
      tl.to(line, { autoAlpha: 0, y: -(14 + i * 4) * P, duration: 0.06, ease: 'sine.in' }, 0.47 + i * 0.01);
    });

    /* ------------------------------------------------------------------ blast -- */
    tl.set(particle.state, { keepCore: 1 }, 0.55);
    tl.to(particle.state, { burst: 1.5, duration: 0.25, ease: 'power3.out' }, 0.55);
    // Shrinks at the video's pace, so the video's ball is always inside ours while it fades in.
    tl.to(particle.state, { scale: () => SPARK_SCALE(), duration: 0.27, ease: 'sine.inOut' }, 0.55);
    tl.to(atmo, { bg: VIDEO_BG, duration: 0.15 }, 0.55);

    // The video, framed exactly as Scene 2 opens: its spark under ours, on the left.
    const framed = () => ({ xPercent: () => framing().xPercent, yPercent: () => framing().yPercent, scale: () => framing().scale });
    tl.fromTo(seq.el, { autoAlpha: 0, ...framed() }, { autoAlpha: 1, ...framed(), duration: 0.2, ease: 'power1.in' }, 0.6);
    seq.state.progress = 0;
    tl.fromTo(seq.state, { progress: 0 }, { progress: 1, duration: 0.4, ease: 'none', immediateRender: false }, 0.6);

    // Hand over: ours fades into the video's spark.
    tl.to(particle.state, { opacity: 0, duration: 0.13, ease: 'sine.in' }, 0.82);

    onTick((t) => {
      seq.render();
      particle.render(t);
    });
  },
};
