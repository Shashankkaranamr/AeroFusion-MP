"use client";

import { Menu, Search, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/layout/logo";
import { SoundToggle } from "@/components/layout/sound";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAppStore } from "@/hooks/use-app-store";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/forecast", label: "Forecast" },
  { href: "/live-map", label: "Live Map" },
  { href: "/model-lab", label: "Model Lab" },
  { href: "/explainability", label: "Explainability" },
  { href: "/about", label: "About" },
];

/** Floating Liquid Glass navigation: clear glass over the photo hero, adaptive glass below it. */
export function LandingNav() {
  const { scrollY } = useScroll();
  const [overHero, setOverHero] = useState(true);
  const [open, setOpen] = useState(false);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  useMotionValueEvent(scrollY, "change", (v) => setOverHero(v < 40));

  // The homepage artwork runs under the whole page, so the nav stays clear glass; it just tightens on scroll.
  const shell = overHero ? "glass-hero" : "glass-hero shadow-[0_18px_50px_-20px_rgba(5,15,35,0.7)]";
  const muted = "text-white/80 hover:text-white";

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-4 sm:px-6 lg:px-10"
    >
      <div className={cn("mx-auto flex max-w-[1500px] items-center gap-3 rounded-full p-2 transition-all duration-500", shell)}>
        <Link href="/" aria-label="AeroFusion home" className="flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-2 pr-4">
          <LogoMark className="size-10" />
          <div className="leading-none">
            <div className={cn("font-hero text-[19px] font-semibold tracking-tight", overHero ? "text-white" : "text-fg")}>AeroFusion</div>
            <div className={cn("mt-1 text-[11px]", overHero ? "text-white/75" : "text-fg-subtle")}>MW-AeroFusion-Net</div>
          </div>
        </Link>

        <nav className={cn("mx-auto hidden items-center gap-0.5 rounded-full p-1 lg:flex", overHero ? "bg-white/10 shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.25)]" : "bg-surface-sunken")}>
          {LINKS.map((l) => {
            const active = l.href === "/";
            return (
              <Link key={l.href} href={l.href} className={cn("relative rounded-full px-5 py-2.5 text-[15px] font-medium transition", active ? (overHero ? "text-white" : "text-fg") : muted)}>
                {active && (
                  <span className={cn("absolute inset-0 -z-0 rounded-full", overHero ? "glass-hero" : "glass-strong")}>
                    <span className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-80" />
                  </span>
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <button
            onClick={() => setCommandOpen(true)}
            className={cn(
              "hidden h-12 w-[300px] min-w-0 items-center gap-3 whitespace-nowrap rounded-full px-5 text-left text-[14px] transition md:flex",
              overHero ? "bg-white/10 text-white/80 shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.28)] hover:bg-white/15" : "bg-surface-sunken text-fg-subtle",
            )}
          >
            <Search className="size-5 shrink-0" />
            <span className="truncate">Search city (e.g., Delhi, Bengaluru…)</span>
          </button>
          <div className={cn("grid size-12 place-items-center rounded-full", overHero ? "bg-white/10 text-white shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.28)] [&_button]:text-white" : "")}>
            <SoundToggle className="text-white/85 hover:bg-white/15 hover:text-white" />
            <ThemeToggle />
          </div>
          <Link
            href="/dashboard"
            aria-label="Open dashboard"
            className="grid size-12 place-items-center rounded-full bg-gradient-to-b from-[#6b8cff] to-[#4361ee] text-lg font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_8px_22px_-8px_rgba(67,97,238,0.8)]"
          >
            S
          </Link>
          <button onClick={() => setOpen((o) => !o)} className="grid size-11 place-items-center rounded-full lg:hidden" aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass-pop mx-auto mt-2 max-w-[1500px] rounded-[28px] p-2 lg:hidden">
            {[...LINKS, { href: "/dashboard", label: "Open Dashboard" }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-medium text-fg hover:bg-surface-sunken">
                {l.label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
