import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * After 21st.dev's AetherFlow hero (the "sonar grid"): drifting particles joined by faint threads,
 * pushed aside by the pointer. Recast in the story's terms: the dots are airborne particles — most
 * in the sky's ink, a few in ember — and the threads are the wind that links them. Contained in
 * its box (never a full-page moving background, Apple › reduced motion), it sleeps off screen,
 * and with reduced motion it draws one still frame.
 */
export function AetherField({ className, density = 9000, emberShare = 0.14 }: { className?: string; density?: number; emberShare?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(canvas);
    const ink = css.getPropertyValue("--ink-rgb").trim().split(/\s+/).join(",") || "236,228,214";
    type P = { x: number; y: number; dx: number; dy: number; r: number; ember: boolean };
    let parts: P[] = [];
    let w = 0;
    let h = 0;
    const mouse = { x: -1e4, y: -1e4, radius: 140 };

    function init() {
      const r = canvas!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(110, Math.round((w * h) / density));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        dx: (Math.random() - 0.5) * 0.36,
        dy: (Math.random() - 0.5) * 0.36,
        r: Math.random() * 1.6 + 0.8,
        ember: Math.random() < emberShare,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      const reach = Math.min(w, h) / 5.2;
      for (let a = 0; a < parts.length; a++) {
        for (let b = a + 1; b < parts.length; b++) {
          const dx = parts[a].x - parts[b].x;
          const dy = parts[a].y - parts[b].y;
          const d = Math.hypot(dx, dy);
          if (d > reach) continue;
          const near = Math.hypot(parts[a].x - mouse.x, parts[a].y - mouse.y) < mouse.radius;
          const o = (1 - d / reach) * (near ? 0.5 : 0.16);
          ctx!.strokeStyle = near ? `rgba(255,138,61,${o})` : `rgba(${ink},${o})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(parts[a].x, parts[a].y);
          ctx!.lineTo(parts[b].x, parts[b].y);
          ctx!.stroke();
        }
      }
      for (const p of parts) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = p.ember ? "rgba(255,138,61,0.9)" : `rgba(${ink},0.55)`;
        ctx!.fill();
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

    let raf = 0;
    let visible = false;
    const loop = () => {
      step();
      draw();
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !still) raf = requestAnimationFrame(loop);
    });
    const ro = new ResizeObserver(() => {
      init();
      draw();
    });
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const out = () => {
      mouse.x = mouse.y = -1e4;
    };
    init();
    draw();
    io.observe(canvas);
    ro.observe(canvas);
    const host = canvas.parentElement ?? canvas;
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", out);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", out);
    };
  }, [density, emberShare]);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 size-full", className)} />;
}
