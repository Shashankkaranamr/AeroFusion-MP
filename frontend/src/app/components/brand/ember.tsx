import { useEffect, useRef } from "react";
// The story's own particle: the same WebGL ember, at logo size.
import { createParticle } from "../../../components/particle.js";
import { cn } from "@/lib/utils";

interface Particle {
  el: HTMLElement;
  state: Record<string, number>;
  render: (t: number) => void;
  resize: () => void;
}

/**
 * A live ember at a fixed size — the logo's blob, and anywhere the brand mark appears. It keeps
 * the story particle's slow, dusty surface. Draws only while on screen; with reduced motion it
 * draws one still frame.
 */
export function Ember({ size = 28, className, heat = 0, label }: { size?: number; className?: string; heat?: number; label?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const p = useRef<Particle | null>(null);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    const particle = createParticle({ count: 80, diameter: size }) as Particle;
    Object.assign(particle.state, { float: 0, glow: 0.9, scale: 1, heat });
    host.append(particle.el);
    particle.resize();
    p.current = particle;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !still) raf = requestAnimationFrame(loop);
    });
    io.observe(host);
    function loop(now: number) {
      particle.render(now / 1000);
      raf = visible && !still && !document.hidden ? requestAnimationFrame(loop) : 0;
    }
    particle.render(0.5);
    if (!still) raf = requestAnimationFrame(loop);
    const onVis = () => !document.hidden && visible && !raf && !still && (raf = requestAnimationFrame(loop));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      particle.el.remove();
    };
  }, [size]);

  useEffect(() => {
    if (p.current) p.current.state.heat = heat;
  }, [heat]);

  return (
    <span
      ref={box}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("pointer-events-none relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
