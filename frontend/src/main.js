import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { applyTokens } from './tokens.js';
import './core/motion.js';
import { createStage } from './core/stage.js';
import { createHud } from './core/hud.js';
import { mountScenes } from './core/sceneRunner.js';
import { createSmoothScroll } from './core/smoothScroll.js';
import { scenes } from './scenes/index.js';
import { idle } from './core/idle.js';
import { createSound } from './core/sound.js';
import { createControls } from './components/controls.js';
import { mountEmberCursor } from './core/emberCursor.js';
import { brand } from './core/brand.js';
import { bridge } from './core/bridge.js';
import { createSite } from './core/site.js';
import './typography/typography.css';
import './styles/base.css';

gsap.registerPlugin(ScrollTrigger);
// Mobile URL bars resize the viewport while scrolling; don't re-measure every time they do.
ScrollTrigger.config({ ignoreMobileResize: true });

applyTokens();
const site = createSite();

/** Builds the story (once) and returns what the site needs to pause and resume it. */
function startStory() {
  const stage = createStage(document.body);
  const hud = createHud(document.body);
  const story = mountScenes(document.getElementById('story'), scenes, { stage, hud });
  const scroller = createSmoothScroll();
  scroller.start();

  // Sound follows the story: the scene on screen, how far into it, how fast the reader scrolls.
  let lastY = window.scrollY;
  let speed = 0;
  const sound = createSound({ getMoment: () => ({ ...story.moment(), speed }) });
  gsap.ticker.add(() => {
    const y = window.scrollY;
    speed += (Math.abs(y - lastY) - speed) * 0.2; // px per frame, eased
    lastY = y;
    sound.update();
  });
  const controls = createControls({ scroller, sound, sections: () => story.sections(), toDashboard: () => site.toDashboard() });
  controls.mount(hud.row);
  // Ask the data, pressed in the story's bar at its end: glide into the dashboard, then open the chat
  // once it has locked (the chat belongs to the dashboard).
  window.addEventListener('aerofusion:ask-from-story', () => {
    const open = (e) => {
      if (!e.detail?.dash) return;
      window.removeEventListener('aerofusion:mode', open);
      requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('aerofusion:ask')));
    };
    window.addEventListener('aerofusion:mode', open);
    window.dispatchEvent(new CustomEvent('aerofusion:enter'));
  });
  // The closing hero's button: glide on down into the live site (it locks when it reaches the top).
  window.addEventListener('aerofusion:enter', () => {
    const y = document.getElementById('app').offsetTop;
    if (scroller.lenis) scroller.lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  });
  // The mouse follow: a small ember — the logo's blob — trails the pointer (fine pointers only).
  mountEmberCursor();

  // Reveal once fonts are in, so the opening headline never flashes in a fallback face.
  document.fonts.ready.then(() => {
    document.documentElement.classList.add('is-ready');
    // Background preparation of the later scenes begins once the opening has settled.
    setTimeout(() => idle.start(), 1500);
    ScrollTrigger.refresh();
  });

  return {
    /** The dashboard has the page: stop scrolling smoothly, scrubbing, drawing and sounding. */
    pause() {
      controls.stop();
      scroller.stop();
      sound.setMuted(true);
      ScrollTrigger.getAll().forEach((t) => t.disable(false));
      gsap.ticker.sleep();
    },
    /**
     * Back into the story at its end, at scroll position `y` (the closing hero, with the
     * dashboard just under it): the reader scrolled up out of the dashboard.
     */
    resumeAt(y) {
      gsap.ticker.wake();
      brand.reset();
      ScrollTrigger.getAll().forEach((t) => t.enable(false));
      sound.setMuted(false);
      ScrollTrigger.refresh();
      window.scrollTo(0, y);
      scroller.start();
      scroller.lenis?.scrollTo(y, { immediate: true, force: true });
      ScrollTrigger.update();
    },
    /** The story again, from the top. */
    resume() {
      gsap.ticker.wake();
      brand.reset();
      ScrollTrigger.getAll().forEach((t) => t.enable(false));
      sound.setMuted(false);
      // Re-measure first (a refresh puts the page back where it was), then go to the top.
      ScrollTrigger.refresh();
      window.scrollTo(0, 0);
      scroller.start();
      scroller.lenis?.scrollTo(0, { immediate: true, force: true });
      ScrollTrigger.update();
      // Scene 6 is asleep at the top, so undo its end state here: the logo out of the corner,
      // the bar back, the particles' screen gone.
      const clear = () => {
        brand.reset();
        hud.finale(0);
        hud.toSite(0);
        bridge.set(0);
      };
      clear();
      requestAnimationFrame(() => requestAnimationFrame(clear));
    },
  };
}

site.init(startStory);
