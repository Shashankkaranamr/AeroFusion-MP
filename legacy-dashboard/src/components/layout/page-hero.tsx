"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { SkyScene, type SkySceneProps } from "@/components/sky/sky-scene";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function PageHero({
  eyebrow,
  title,
  subtitle,
  aside,
  children,
  sky,
  className,
  height = "min-h-[300px]",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  sky?: SkySceneProps;
  className?: string;
  height?: string;
}) {
  return (
    <section className={cn("relative -mx-4 -mt-[76px] mb-6 sm:-mx-6 lg:-mx-8", className)}>
      <div className="page-hero-sky pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_62%,transparent_100%)]">
        <div className="absolute inset-0 [mask-image:linear-gradient(to_right,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.4)_22%,black_52%)]">
          <SkyScene {...sky} className="absolute inset-0" />
        </div>
      </div>
      <div className={cn("relative flex flex-col justify-end gap-6 px-4 pb-2 pt-[104px] sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8", height)}>
        <div className="max-w-2xl">
          {eyebrow && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="mb-3"
            >
              {eyebrow}
            </motion.div>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
            className="font-hero text-[40px] font-bold leading-[1.04] tracking-[-0.03em] text-fg sm:text-5xl xl:text-[56px]"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
              className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted sm:text-base"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
        {aside && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
            className="shrink-0"
          >
            {aside}
          </motion.div>
        )}
      </div>
      {children && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
          className="relative mt-5 px-4 sm:px-6 lg:px-8"
        >
          {children}
        </motion.div>
      )}
    </section>
  );
}

export function GlassNote({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "glass flex max-w-[280px] items-center gap-3 rounded-[24px] p-3.5 text-[13px] leading-snug text-fg",
        className,
      )}
    >
      {icon && <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary [&_svg]:size-5">{icon}</div>}
      <div>{children}</div>
    </div>
  );
}
