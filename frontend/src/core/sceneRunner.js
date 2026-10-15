import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tokens } from '../tokens.js';
import { el } from './dom.js';
import { motion } from './motion.js';
import { atmosphereLayers } from './stage.js';
import { parseClock, clockAt, skyAt, horizonAt } from './timeOfDay.js';
import { mixHex, lerp } from './color.js';

/**
 * Mounts every scene as a tall <section> with a sticky full-screen viewport inside, and
 * gives each one a GSAP timeline scrubbed by scroll across that section.
 *
 * A scene module (src/scenes/*.js) exports:
 *   {
 *     id, number, title,
 *     length,                      // section height in screens (100vh units)
 *     clock: { from, to, days }, // e.g. '5:48 PM' → '6:36 PM'; days adds whole days to the run
 *     atmosphere: { bg, horizon, followClock },   // starting values
 *     joinPrevious: true,          // optional; cut straight in from the previous scene's last
 *                                  // frame (no scroll-away). Its first frame must match it.
 *     build(ctx),                  // adds DOM to ctx.viewport and tweens to ctx.tl
 *   }
 *
 * ctx.tl runs over 0 → 1. Place tweens at fractions of the scene: tl.to(x, {...}, 0.4).
 * ctx.atmo and ctx.clock are this scene's own proxies — tween them, never the global stage.
 * Only the ACTIVE scene's proxies reach the screen, so scenes can't fight over the sky.
 *
 * Atmosphere resolution, every frame:
 *   sky     = mix(atmo.bg,      skyAt(clock),     atmo.followClock)
 *   horizon = mix(atmo.horizon, horizonAt(clock), atmo.followClock)
 * so a scene can either paint the sky by hand or let it follow its clock.
 */
export function mountScenes(root, scenes, { stage, hud }) {
  const mounted = scenes.map((scene) => mountScene(root, scene, hud));
  let active = null;

  function setActive(m) {
    if (active === m) return;
    active = m;
  }
  setActive(mounted[0]);

  mounted.forEach((m, i) => {
    const joined = m.scene.joinPrevious;
    const nextJoined = mounted[i + 1]?.scene.joinPrevious;
    // Active = the section under the middle of the screen — or, across a joined cut, exactly
    // the scroll position where one viewport replaces the other.
    ScrollTrigger.create({
      trigger: m.section,
      start: joined ? 'top top' : 'top center',
      end: nextJoined ? 'bottom bottom' : 'bottom center',
      onToggle: (self) => self.isActive && setActive(m),
    });
    // A joined scene overlaps the previous one by a screen (negative margin) and stays hidden
    // until its top reaches the top: then it covers the previous scene's frozen last frame in
    // one frame, with no scroll-away between them.
    if (joined) {
      ScrollTrigger.create({
        trigger: m.section,
        start: 'top top',
        end: 'bottom top',
        toggleClass: { targets: m.viewport, className: 'is-on' },
      });
    }
    // Awake = any part on screen: run per-frame work, play videos, start lazy loads.
    ScrollTrigger.create({
      trigger: m.section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => m.setAwake(self.isActive),
    });
  });

  // Per-frame work only for scenes that can actually be seen: a joined scene once it has cut in,
  // and never a scene the next one has already covered. (Awake alone is too generous: a joined
  // scene's section overlaps the previous one by a screen, and two WebGL worlds rendering at
  // once at every cut is exactly the kind of frame drop that reads as jitter.)
  const isOn = (m) => m.viewport.classList.contains('is-on');
  gsap.ticker.add((time) => {
    for (let i = 0; i < mounted.length; i++) {
      const m = mounted[i];
      if (!m.awake) continue;
      if (m.scene.joinPrevious && !isOn(m)) continue;
      const next = mounted[i + 1];
      if (next?.scene.joinPrevious && isOn(next)) continue;
      for (const fn of m.ticks) fn(time);
    }
    if (!active) return;
    const { atmo, clock } = active;
    const minutes = clockAt(clock.from, clock.to, clock.progress, clock.days);
    const w = atmo.followClock;
    stage.set(
      w > 0 ? mixHex(atmo.bg, skyAt(minutes), w) : atmo.bg,
      w > 0 ? lerp(atmo.horizon, horizonAt(minutes), w) : atmo.horizon,
    );
    hud.clock.set(minutes, clock.visible);
  });

  return {
    mounted,
    get active() { return active; },
    /** Which scene is on screen, as an index into the story. */
    get activeIndex() { return active ? mounted.indexOf(active) : 0; },
    /** Where the story is right now: the scene on screen and how far into it (0..1). */
    moment() { return { scene: active?.scene.id, p: active ? active.tl.progress() : 0 }; },
    /** Each scene's id and where its section starts, in page pixels. */
    sections() { return mounted.map((m) => ({ id: m.scene.id, top: m.section.offsetTop })); },
  };
}

function mountScene(root, scene, hud) {
  const section = el('section', 'scene', { 'data-scene': scene.id, 'aria-label': `Scene ${scene.number}: ${scene.title}` });
  section.style.height = `${(scene.length ?? tokens.timing.defaultSceneLength) * 100}vh`;
  if (scene.joinPrevious) section.classList.add('scene--joined');
  const viewport = el('div', 'scene-viewport');
  viewport.append(atmosphereLayers());
  section.append(viewport);
  root.append(section);

  const atmo = { bg: tokens.color.sky.night, horizon: 0, followClock: 0, ...scene.atmosphere };
  const clock = {
    from: parseClock(scene.clock?.from ?? '12:00 AM'),
    to: parseClock(scene.clock?.to ?? scene.clock?.from ?? '12:00 AM'),
    days: scene.clock?.days ?? 0,
    progress: 0,
    visible: scene.clock?.visible ?? 0,
  };

  const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
  const ticks = [];
  const videos = [];
  const lazy = [];
  const m = {
    scene, section, viewport, atmo, clock, tl, ticks, awake: false,
    setAwake(on) {
      m.awake = on;
      for (const v of videos) on ? v.play().catch(() => {}) : v.pause();
      if (on) lazy.splice(0).forEach((fn) => fn());
    },
  };

  scene.build({
    viewport,
    section,
    tl,
    atmo,
    clock,
    tokens,
    motion,
    /** The bar over the story (core/hud.js): Scene 6 fades it to just the logo. */
    hud,
    /** Run fn(timeSeconds) every frame while this scene is on screen. */
    onTick: (fn) => ticks.push(fn),
    /** Register a <video> to play only while the scene is on screen. */
    addVideo: (v) => v && videos.push(v),
    /** Run once, the first time the scene comes near the screen (e.g. frame sequence load). */
    whenNear: (fn) => lazy.push(fn),
  });

  // Normalise to exactly 0 → 1 so positions read as fractions of the scene.
  if (tl.duration() < 1) tl.to({}, { duration: 1 - tl.duration() }, tl.duration());
  // A paused timeline hasn't rendered its time-0 sets yet; run it end→start once so every
  // element starts in its scene-start state before the first scroll.
  tl.progress(1).progress(0);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    animation: tl,
    scrub: motion.reduced ? true : tokens.timing.scrub,
    invalidateOnRefresh: true,
  });

  return m;
}
