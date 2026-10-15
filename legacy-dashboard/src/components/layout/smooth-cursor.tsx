"use client";

// Port of the Framer "Smoothcursor" component (spring-follow arrow that rotates with movement direction,
// squishes while moving and on click). Hidden on touch, narrow or portrait screens.
import { motion, useSpring } from "motion/react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const canShow = () => {
  const isPortrait = window.innerHeight > window.innerWidth;
  const isNarrow = window.innerWidth < 768;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return !(isPortrait || isNarrow || isTouch);
};

function CursorSVG({ invert }: { invert?: boolean }) {
  const inner = invert ? "white" : "black";
  const outer = invert ? "black" : "white";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 50 54" fill="none">
      <g filter="url(#smooth-cursor-shadow)">
        <path
          d="M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z"
          fill={inner}
        />
        <path
          d="M43.7146 40.6933L28.5431 6.34306C27.3556 3.65428 23.5772 3.69516 22.3668 6.32755L6.57226 40.6778C5.3134 43.4156 7.97238 46.298 10.803 45.2549L24.7662 40.109C25.0221 40.0147 25.2999 40.0156 25.5494 40.1082L39.4193 45.254C42.2261 46.2953 44.9254 43.4347 43.7146 40.6933Z"
          stroke={outer}
          strokeWidth={2.25825}
        />
      </g>
      <defs>
        <filter id="smooth-cursor-shadow" x={0.602397} y={0.952444} width={49.0584} height={52.428} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy={2.25825} />
          <feGaussianBlur stdDeviation={2.25825} />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}
interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
}

/**
 * Jet-contrail tail behind the cursor (technique from Framer "CursorDotTrail"): a tapering line of recent
 * positions that fades with age, plus soft smoke puffs that drift, expand and dissolve.
 */
function JetTrail({ getPos, color = "255,255,255", trailMs = 450, smokeMs = 1000 }: { getPos: () => { x: number; y: number }; color?: string; trailMs?: number; smokeMs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let points: TrailPoint[] = [];
    let puffs: Puff[] = [];
    let last = performance.now();
    let prev = getPos();
    let raf = 0;

    const frame = () => {
      const now = performance.now();
      const dt = Math.min(now - last, 33);
      last = now;
      const pos = getPos();
      const dx = pos.x - prev.x;
      const dy = pos.y - prev.y;
      const speed = Math.hypot(dx, dy);
      prev = pos;

      // contrail points
      if (speed > 0.3) points.push({ x: pos.x, y: pos.y, age: 0 });
      for (const p of points) p.age += dt;
      points = points.filter((p) => p.age < trailMs);

      // smoke: more puffs the faster the cursor moves
      const spawn = Math.min(3, speed / 6);
      for (let i = 0; i < Math.floor(spawn + Math.random()); i++) {
        if (speed < 1.5) break;
        const back = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.9;
        const v = 0.02 + Math.random() * 0.04;
        puffs.push({ x: pos.x, y: pos.y, vx: Math.cos(back) * v, vy: Math.sin(back) * v - 0.008, r: 3 + Math.random() * 3, age: 0, life: smokeMs * (0.6 + Math.random() * 0.6) });
      }
      for (const f of puffs) {
        f.age += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.r += dt * 0.022;
      }
      puffs = puffs.filter((f) => f.age < f.life).slice(-160);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // smoke (behind the contrail)
      for (const f of puffs) {
        const a = 0.22 * (1 - f.age / f.life) ** 1.6;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(${color},${a})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // contrail: segment by segment, thicker and brighter toward the cursor
      ctx.lineCap = "round";
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const life = 1 - b.age / trailMs;
        ctx.strokeStyle = `rgba(${color},${0.55 * life * life})`;
        ctx.lineWidth = 0.5 + 3.5 * life;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [getPos, color, trailMs, smokeMs]);
  return <canvas ref={ref} aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999998 }} />;
}

export function SmoothCursor({
  cursorSize = 40,
  stiffness = 400,
  damping = 45,
  mass = 1,
  hideSystemCursor = true,
  enableBlendMode = false,
  invertIconColors = false,
  enableClickEffect = true,
  trail = true,
}: {
  cursorSize?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  hideSystemCursor?: boolean;
  enableBlendMode?: boolean;
  invertIconColors?: boolean;
  enableClickEffect?: boolean;
  /** jet contrail + smoke behind the cursor */
  trail?: boolean;
}) {
  const visible = useSyncExternalStore(subscribe, canShow, () => false);
  const cursorX = useSpring(-100, { stiffness, damping, mass });
  const cursorY = useSpring(-100, { stiffness, damping, mass });
  const rotation = useSpring(0, { stiffness: 300, damping: 60 });
  const scale = useSpring(1, { stiffness: 500, damping: 35 });
  const lastPos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const prevAngle = useRef(0);
  const accRotation = useRef(0);
  const raf = useRef<number | null>(null);
  const down = useRef(false);
  const first = useRef(true);
  const getPos = useCallback(() => ({ x: cursorX.get(), y: cursorY.get() }), [cursorX, cursorY]);

  useEffect(() => {
    if (!visible) return;
    lastTime.current = Date.now();
    const move = (e: MouseEvent) => {
      const pos = { x: e.clientX, y: e.clientY };
      const now = Date.now();
      const dt = now - lastTime.current;
      if (dt > 0) velocity.current = { x: (pos.x - lastPos.current.x) / dt, y: (pos.y - lastPos.current.y) / dt };
      lastTime.current = now;
      lastPos.current = pos;
      const speed = Math.hypot(velocity.current.x, velocity.current.y);
      if (first.current) {
        // appear at the pointer instead of flying in from off-screen (no streak in the trail)
        first.current = false;
        cursorX.jump(pos.x);
        cursorY.jump(pos.y);
      }
      cursorX.set(pos.x);
      cursorY.set(pos.y);
      if (speed > 0.1) {
        const angle = Math.atan2(velocity.current.y, velocity.current.x) * (180 / Math.PI) + 90;
        let diff = angle - prevAngle.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        accRotation.current += diff;
        rotation.set(accRotation.current);
        prevAngle.current = angle;
        if (!down.current) {
          scale.set(0.95);
          setTimeout(() => {
            if (!down.current) scale.set(1);
          }, 150);
        }
      }
    };
    const onMove = (e: MouseEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        move(e);
        raf.current = null;
      });
    };
    const onDown = () => {
      down.current = true;
      if (enableClickEffect) scale.set(0.7);
    };
    const onUp = () => {
      down.current = false;
      if (enableClickEffect) scale.set(1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onUp);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [visible, cursorX, cursorY, rotation, scale, enableClickEffect]);

  if (!visible) return null;
  return (
    <>
      {hideSystemCursor && <style>{`* { cursor: none !important; }`}</style>}
      {trail && <JetTrail getPos={getPos} />}
      <motion.div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          x: cursorX,
          y: cursorY,
          rotate: rotation,
          scale,
          zIndex: 999999,
          pointerEvents: "none",
          willChange: "transform",
          mixBlendMode: enableBlendMode ? "difference" : "normal",
          width: cursorSize,
          height: cursorSize,
          marginLeft: -cursorSize / 2,
          marginTop: -cursorSize / 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CursorSVG invert={invertIconColors} />
      </motion.div>
    </>
  );
}
