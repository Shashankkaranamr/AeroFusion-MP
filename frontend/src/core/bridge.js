import { el } from './dom.js';

/**
 * THE BRIDGE — the screen between the story and the dashboard.
 *
 * Black, the dashboard's engineering grid, and the airborne particles of its loading screen
 * (app/components/aether-field.tsx): drifting dots — most in white, a few in ember — joined by
 * faint threads, pushed aside by the pointer. Scene 6 fades it in once the logo has landed; it
 * stays fixed while the dashboard rises over it (core/site.js), and draws only while it shows.
 */
function createBridge() {
  const root = el('div', 'bridge-field', { 'aria-hidden': 'true' });
  const canvas = el('canvas');
  const cue = el('div', 'bridge-field__cue s-tag', {}, 'Scroll · the live dashboard');
  root.append(canvas, cue);
  const ctx = canvas.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: -1e4, y: -1e4, radius: 150 };
  let parts = [];
  let w = 0;
  let h = 0;
  let shown = 0;
  let raf = 0;

  function init() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(120, Math.round((w * h) / 11000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      dx: (Math.random() - 0.5) * 0.36,
      dy: (Math.random() - 0.5) * 0.36,
      r: Math.random() * 1.6 + 0.8,
      ember: Math.random() < 0.14,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const reach = Math.min(w, h) / 5.2;
    for (let a = 0; a < parts.length; a++) {
      for (let b = a + 1; b < parts.length; b++) {
        const dx = parts[a].x - parts[b].x;
        const dy = parts[a].y - parts[b].y;
        const d = Math.hypot(dx, dy);
        if (d > reach) continue;
        const near = Math.hypot(parts[a].x - mouse.x, parts[a].y - mouse.y) < mouse.radius;
        const o = (1 - d / reach) * (near ? 0.5 : 0.16);
        ctx.strokeStyle = near ? `rgba(255,138,61,${o})` : `rgba(255,255,255,${o})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(parts[a].x, parts[a].y);
        ctx.lineTo(parts[b].x, parts[b].y);
        ctx.stroke();
      }
    }
    for (const p of parts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.ember ? 'rgba(255,138,61,0.9)' : 'rgba(255,255,255,0.55)';
      ctx.fill();
    }
  }

  function step() {
    for (const p of parts) {
      if (p.x > w || p.x < 0) p.dx = -p.dx;
      if (p.y > h || p.y < 0) p.dy = -p.dy;
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < mouse.radius + p.r && d > 0) {
        const f = (mouse.radius - d) / mouse.radius;
        p.x -= (dx / d) * f * 4;
        p.y -= (dy / d) * f * 4;
      }
      p.x += p.dx;
      p.y += p.dy;
    }
  }

  const loop = () => {
    step();
    draw();
    raf = shown > 0 && !document.hidden && !still ? requestAnimationFrame(loop) : 0;
  };

  window.addEventListener('resize', () => {
    if (!parts.length) return;
    init();
    draw();
  });
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });
  document.addEventListener('pointerleave', () => {
    mouse.x = mouse.y = -1e4;
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shown > 0 && !raf && !still) raf = requestAnimationFrame(loop);
  });

  return {
    mount(parent = document.body) {
      parent.append(root);
    },
    /** 0 = gone, 1 = full. */
    set(v) {
      const o = Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
      if (o === shown) return;
      if (o > 0 && !parts.length) init();
      const was = shown;
      shown = o;
      root.style.opacity = String(o);
      root.style.visibility = o > 0 ? 'visible' : 'hidden';
      if (o > 0 && was === 0) {
        draw();
        if (!raf && !still) raf = requestAnimationFrame(loop);
      }
    },
  };
}

export const bridge = createBridge();
