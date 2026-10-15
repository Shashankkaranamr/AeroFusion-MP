import { createParticle } from '../components/particle.js';

/**
 * THE EMBER CURSOR — the mouse follow, drawn as the brand's blob.
 *
 * After the 21st.dev SpringMouseFollow (Skiper 61): the ball trails the pointer on a spring
 * (mass 0.1, damping 10, stiffness 131 — overdamped, so it glides in without bouncing), fades and
 * grows in when the pointer arrives and shrinks away when it leaves. The ball is the story's own
 * ember (components/particle.js) at cursor size, so it keeps its slow, dusty surface: the same
 * particle that is the logo follows your hand.
 *
 * The system cursor stays (it is the precise one); the ember rides just behind it.
 *   - over something pressable it tightens to a bright point, so it never covers a label;
 *   - pressing squeezes it; over text fields it steps aside;
 *   - fine pointers only (no touch), and off entirely with reduced motion.
 *
 * Shared by the story (src/main.js) and the dashboard (src/app/main.tsx). One rAF loop, which
 * sleeps when the ember has settled.
 */
const SPRING = { mass: 0.1, damping: 10, stiffness: 131 };
const SIZE = 30; // px: the ember's diameter at rest
const PRESSABLE = 'a[href], button:not(:disabled), [role="button"], [role="tab"], [role="option"], [role="slider"], [role="switch"], select, label[for], summary, [data-cursor="press"]';
const TEXT = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"], [data-cursor="text"]';

/** One spring axis, integrated in fixed sub-steps so it behaves the same at any frame rate. */
function spring(value = 0) {
  return {
    value,
    target: value,
    v: 0,
    step(dt) {
      const h = 1 / 240;
      for (let t = 0; t < dt; t += h) {
        const a = (-SPRING.stiffness * (this.value - this.target) - SPRING.damping * this.v) / SPRING.mass;
        this.v += a * h;
        this.value += this.v * h;
      }
      return Math.abs(this.v) > 0.01 || Math.abs(this.value - this.target) > 0.01;
    },
  };
}

export function mountEmberCursor({ parent = document.body, zIndex = 2147483000 } = {}) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduced.matches) return { destroy() {} };

  const layer = document.createElement('div');
  layer.className = 'ember-cursor';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: String(zIndex), overflow: 'hidden', contain: 'strict' });
  const ember = createParticle({ count: 60, diameter: SIZE });
  Object.assign(ember.state, { float: 0, opacity: 0, glow: 0.7, scale: 0.6 });
  // The particle draws on a canvas six diameters wide; keep its glow subtle at this size.
  ember.el.style.position = 'absolute';
  layer.append(ember.el);
  parent.append(layer);
  ember.resize();

  const x = spring(window.innerWidth / 2);
  const y = spring(window.innerHeight / 2);
  const presence = spring(0); // 0 gone … 1 here (drives opacity and scale, as in the original)
  const size = spring(1); // 1 at rest, smaller over pressables / while pressed
  let seen = false;
  let raf = 0;
  let last = 0;
  let mode = 'rest';
  let pressed = false;

  function wake() {
    // The story's cursor only: once the page is the dashboard, it rests.
    if (document.documentElement.classList.contains('mode-dash')) return;
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function setMode(next) {
    mode = next;
    size.target = pressed ? (mode === 'press' ? 0.32 : 0.7) : mode === 'press' ? 0.42 : 1;
    presence.target = mode === 'text' || !seen ? 0 : 1;
    wake();
  }

  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    x.target = e.clientX;
    y.target = e.clientY;
    if (!seen) {
      // First sight: appear where the pointer is, rather than flying in from the middle.
      seen = true;
      x.value = e.clientX;
      y.value = e.clientY;
    }
    const t = e.target instanceof Element ? e.target : null;
    setMode(t?.closest(TEXT) ? 'text' : t?.closest(PRESSABLE) ? 'press' : 'rest');
  }
  const onLeave = () => {
    seen = false;
    setMode(mode);
  };
  const onDown = () => {
    pressed = true;
    setMode(mode);
  };
  const onUp = () => {
    pressed = false;
    setMode(mode);
  };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moving = [x.step(dt), y.step(dt), presence.step(dt), size.step(dt)].some(Boolean);
    const p = Math.max(0, Math.min(1, presence.value));
    ember.state.x = x.value / window.innerWidth;
    ember.state.y = y.value / window.innerHeight;
    ember.state.opacity = p;
    ember.state.scale = 0.6 * Math.max(0.2, p) * size.value;
    ember.state.glow = 0.55 + (1 - size.value) * 0.9; // tighter = brighter
    ember.render(now / 1000);
    // The ember's surface turns slowly even at rest; keep drawing while it is visible.
    raf = moving || p > 0.01 ? requestAnimationFrame(frame) : 0;
  }

  const onResize = () => ember.resize();
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('resize', onResize);
  const off = () => destroy();
  reduced.addEventListener('change', off);

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('resize', onResize);
    reduced.removeEventListener('change', off);
    layer.remove();
  }

  return {
    destroy,
    /** Where the ember is now, in viewport px (for handing it to another animation). */
    get position() {
      return { x: x.value, y: y.value };
    },
  };
}
