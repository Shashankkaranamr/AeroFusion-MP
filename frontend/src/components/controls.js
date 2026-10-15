import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { el } from '../core/dom.js';
import { brand } from '../core/brand.js';

/**
 * The reader's three controls, right of the bar: Autoplay · Sound · Live dashboard.
 *
 * AUTOPLAY scrolls the whole story by itself at a pace set per scene — slower where there is
 * reading, quicker through the journeys — easing in and out, and hands control straight back the
 * moment the reader scrolls, swipes or presses a key.
 *
 * LIVE DASHBOARD (skip) flies the ember from where it is right now into the logo in the corner
 * (core/brand.js) over a closing veil, then opens the dashboard under it (core/site.js), whose logo
 * sits in exactly that place.
 */
const PACE = { particle: 0.42, spark: 0.62, ride: 0.85, trap: 0.66, breath: 0.62, alone: 0.5 }; // screens / second

const icon = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3.2" width="2.8" height="9.6" rx="1" fill="currentColor"/><rect x="9.2" y="3.2" width="2.8" height="9.6" rx="1" fill="currentColor"/></svg>',
  soundOn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" fill="currentColor"/><path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.2 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" fill="currentColor"/><path d="M10.5 6l3.5 4M14 6l-3.5 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  skip: '<svg viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1.5 8.5 8.5 1.5M8.5 1.5H2.8M8.5 1.5v5.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/></svg>',
};

function button(cls, label) {
  const b = el('button', `control ${cls}`, { type: 'button' });
  const i = el('span', 'control__icon');
  const t = el('span', 'control__label');
  b.append(i, t);
  b.set = (svg, text, pressed) => {
    i.innerHTML = svg;
    t.textContent = text;
    b.setAttribute('aria-label', text);
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  };
  b.set('', label);
  return b;
}

export function createControls({ scroller, sound, sections, toDashboard }) {
  const root = el('nav', 'controls', { 'aria-label': 'Story controls' });
  const auto = button('control--auto', 'Autoplay');
  const audio = button('control--sound', 'Sound');
  const skip = button('control--skip', 'Live dashboard');
  root.append(auto, audio, skip);
  const veil = el('div', 'veil', { 'aria-hidden': 'true' });

  // The story's own end (the dashboard below it is not part of the story's scroll).
  const storyEl = document.getElementById('story');
  const maxScroll = () => storyEl.offsetTop + storyEl.offsetHeight - window.innerHeight;
  const scrollY = () => (scroller.lenis ? scroller.lenis.scroll : window.scrollY);
  const jump = (y) => {
    if (scroller.lenis) scroller.lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
    ScrollTrigger.update();
  };

  /* ------------------------------------------------------------- autoplay -- */
  let playing = false;
  let speed = 0; // eased 0..1
  let pos = 0;
  const paceAt = (y) => {
    const mid = y + window.innerHeight / 2;
    const s = sections().filter((x) => mid >= x.top).pop();
    return PACE[s?.id] ?? 0.6;
  };
  function tick(_, dtMs) {
    if (!playing && speed <= 0) return;
    const dt = Math.min(0.05, dtMs / 1000);
    speed += ((playing ? 1 : 0) - speed) * Math.min(1, dt * 2.2); // ~0.5 s ease in / out
    if (speed < 0.002 && !playing) { speed = 0; return; }
    const end = maxScroll();
    pos = Math.min(end, pos + paceAt(pos) * window.innerHeight * speed * dt);
    jump(pos);
    if (pos >= end - 1) stop();
  }
  gsap.ticker.add(tick);
  function play() {
    if (scrollY() >= maxScroll() - 2) jump(0); // finished? start again from the top
    pos = scrollY();
    playing = true;
    auto.set(icon.pause, 'Pause', true);
  }
  function stop() {
    playing = false;
    auto.set(icon.play, 'Autoplay', false);
  }
  auto.addEventListener('click', () => (playing ? stop() : play()));
  // The reader takes over: any scroll intent of their own stops autoplay.
  const takeOver = () => playing && stop();
  window.addEventListener('wheel', takeOver, { passive: true });
  window.addEventListener('touchstart', takeOver, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key) && e.target === document.body) takeOver();
  });

  /* ---------------------------------------------------------------- sound -- */
  audio.addEventListener('click', async () => {
    const on = await sound.toggle();
    audio.set(on ? icon.soundOn : icon.soundOff, on ? 'Sound on' : 'Sound off', on);
  });

  /* ----------------------------------------------------------------- skip -- */
  let skipping = false;
  async function skipToEnd() {
    if (skipping) return;
    skipping = true;
    stop();
    speed = 0;
    const from = brand.source?.() ?? { x: 0.5, y: 0.5, scale: 1 };
    // The ember flies to the corner over a closing veil; then the dashboard opens under it.
    gsap.to(veil, { autoAlpha: 1, duration: 0.45, ease: 'power2.in' });
    await brand.flyFrom(from, 1.6);
    sound.chime();
    await toDashboard();
    gsap.set(veil, { autoAlpha: 0 });
    skipping = false;
  }
  skip.addEventListener('click', skipToEnd);

  // The logo takes the reader back to the beginning.
  window.addEventListener('aerofusion:home', () => {
    stop();
    gsap.to(veil, {
      autoAlpha: 1, duration: 0.4, ease: 'power2.in',
      onComplete: () => { jump(0); gsap.to(veil, { autoAlpha: 0, duration: 0.8, ease: 'power2.out', delay: 0.1 }); },
    });
  });

  auto.set(icon.play, 'Autoplay', false);
  audio.set(icon.soundOff, 'Sound off', false);
  skip.set(icon.skip, 'Live dashboard');

  return {
    mount(parent) {
      parent.append(root);
      document.body.append(veil);
    },
    /** Jump to a place in the story (the rail), through the veil. */
    goTo(y) {
      stop();
      gsap.to(veil, {
        autoAlpha: 1, duration: 0.3, ease: 'power2.in',
        onComplete: () => { jump(y); gsap.to(veil, { autoAlpha: 0, duration: 0.6, ease: 'power2.out', delay: 0.05 }); },
      });
    },
    stop,
  };
}
