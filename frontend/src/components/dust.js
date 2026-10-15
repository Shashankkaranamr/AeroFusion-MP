import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { motion, isMobile } from '../core/motion.js';

/** A few faint dust specks drifting through the frame. state.opacity is tweenable. */
export function createDust() {
  const D = tokens.dust;
  const canvas = el('canvas', 'dust', { 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  const state = { opacity: 1 };

  const count = isMobile() ? D.countMobile : D.count;
  const specks = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: D.size[0] + Math.random() * (D.size[1] - D.size[0]),
    a: D.alpha[0] + Math.random() * (D.alpha[1] - D.alpha[0]),
    vx: (Math.random() - 0.5) * D.drift,
    vy: -(0.3 + Math.random()) * D.drift * 0.6,
    ph: Math.random() * Math.PI * 2,
  }));

  let w = 0, h = 0, dpr = 1, last = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  window.addEventListener('resize', resize);

  function render(t) {
    if (!w) resize();
    const dt = last === null ? 0 : Math.min(0.1, t - last) * motion.timeScale;
    last = t;
    canvas.style.opacity = String(state.opacity);
    if (state.opacity <= 0.001) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = tokens.color.ink;
    for (const s of specks) {
      s.x = (s.x + s.vx * dt + 1) % 1;
      s.y = (s.y + s.vy * dt + 1) % 1;
      const twinkle = 0.75 + 0.25 * Math.sin(t * 0.7 + s.ph);
      ctx.globalAlpha = s.a * twinkle;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { el: canvas, state, render, resize };
}
