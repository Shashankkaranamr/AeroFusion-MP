"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SPRING = { damping: 30, stiffness: 100, mass: 2 };

/**
 * Cursor-tilt for Liquid Glass cards (behaviour of React Bits' TiltedCard, without the image):
 * the card rotates toward the pointer, scales slightly, and a specular glare follows the cursor.
 * Disabled for touch pointers and prefers-reduced-motion.
 */
export function Tilt({
  children,
  className,
  rotateAmplitude = 12,
  scaleOnHover = 1.05,
  glare = true,
  radius = "inherit",
}: {
  children: ReactNode;
  className?: string;
  rotateAmplitude?: number;
  scaleOnHover?: number;
  glare?: boolean;
  radius?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glareOpacity = useSpring(0, { damping: 30, stiffness: 200 });
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 35%, transparent 65%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const ox = e.clientX - r.left - r.width / 2;
    const oy = e.clientY - r.top - r.height / 2;
    rotateX.set((oy / (r.height / 2)) * -rotateAmplitude);
    rotateY.set((ox / (r.width / 2)) * rotateAmplitude);
    gx.set(((e.clientX - r.left) / r.width) * 100);
    gy.set(((e.clientY - r.top) / r.height) * 100);
  };
  const onEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    scale.set(scaleOnHover);
    glareOpacity.set(1);
  };
  const onLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
    glareOpacity.set(0);
  };

  return (
    <div className={cn("[perspective:900px]", className)} onPointerMove={onMove} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <motion.div ref={ref} className="relative h-full [transform-style:preserve-3d]" style={{ rotateX, rotateY, scale, borderRadius: radius }}>
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 mix-blend-soft-light"
            style={{ background: glareBg, opacity: glareOpacity, borderRadius: radius }}
          />
        )}
      </motion.div>
    </div>
  );
}
