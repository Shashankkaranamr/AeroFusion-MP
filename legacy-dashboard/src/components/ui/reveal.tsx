"use client";

import { motion, type HTMLMotionProps, type Variants } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  once = true,
  ...rest
}: { children: ReactNode; delay?: number; y?: number; once?: boolean } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const containerV: Variants = {
  hidden: {},
  show: (stagger: number = 0.06) => ({ transition: { staggerChildren: stagger, delayChildren: 0.05 } }),
};

const itemV: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } },
};

/** Staggers its direct <StaggerItem> children when mounted (or scrolled into view). */
export function Stagger({
  children,
  className,
  stagger = 0.06,
  inView = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  inView?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={containerV}
      custom={stagger}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-40px" } } : { animate: "show" })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div variants={itemV} className={className} {...rest}>
      {children}
    </motion.div>
  );
}
