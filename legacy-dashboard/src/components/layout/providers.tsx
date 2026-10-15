"use client";

import Lenis from "lenis";
import { MotionConfig, MotionGlobalConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Tooltip } from "radix-ui";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useAppStore } from "@/hooks/use-app-store";
import { LiveProvider } from "@/hooks/use-live";
import { SmoothCursor } from "./smooth-cursor";
import { SoundEngine } from "./sound";

// `?static=1` renders every animation in its final state — handy for report screenshots.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("static") === "1") {
  MotionGlobalConfig.skipAnimations = true;
}

function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

function StoreHydration() {
  useEffect(() => {
    useAppStore.persist.rehydrate();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <Tooltip.Provider delayDuration={150}>
          <StoreHydration />
          <SmoothScroll />
          <SoundEngine />
          <SmoothCursor />
          <LiveProvider>{children}</LiveProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "!rounded-2xl !border !border-border-strong !bg-surface-solid !text-fg !shadow-lift",
            }}
          />
        </Tooltip.Provider>
      </MotionConfig>
    </ThemeProvider>
  );
}
