"use client";

import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/rng";

/** Drifting particulate "dust motes" — density follows PM2.5. */
export function PmParticles({ pm, dark, className }: { pm: number; dark: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pmRef = useRef(pm);
  useEffect(() => {
    pmRef.current = pm;
  }, [pm]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rnd = mulberry32(42);
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const MAX = 160;
    const parts = Array.from({ length: MAX }, () => ({
      x: rnd(),
      y: rnd(),
      r: 0.5 + rnd() * 1.9,
      vx: 0.00003 + rnd() * 0.00012,
      phase: rnd() * Math.PI * 2,
      a: 0.25 + rnd() * 0.6,
    }));
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const dt = Math.min(64, now - last);
      last = now;
      const p = pmRef.current;
      const n = Math.round(Math.min(MAX, 14 + Math.max(0, p) * 0.45));
      const alpha = Math.min(0.85, 0.18 + p / 260);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        const q = parts[i];
        if (!reduce) {
          q.x += q.vx * dt;
          q.phase += dt * 0.0006;
          if (q.x > 1.02) q.x = -0.02;
        }
        const y = q.y + Math.sin(q.phase) * 0.012;
        const px = q.x * w;
        const py = y * h;
        const g = ctx.createRadialGradient(px, py, 0, px, py, q.r * 3);
        const col = dark ? "255,196,140" : "128,104,78";
        g.addColorStop(0, `rgba(${col},${q.a * alpha})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, q.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [dark]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
