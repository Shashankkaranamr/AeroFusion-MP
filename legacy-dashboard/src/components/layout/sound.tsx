"use client";

import { Volume2, VolumeX } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cn } from "@/lib/utils";

const useSound = create<{ muted: boolean; toggle: () => void }>()(
  persist((set) => ({ muted: false, toggle: () => set((s) => ({ muted: !s.muted })) }), { name: "aerofusion-sound", skipHydration: true }),
);

const CLICK_SELECTOR = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="option"], [role="menuitem"], input[type="checkbox"], input[type="radio"], summary';

/**
 * Water-drop click on every button / link, and the looping sunrise ambience while on the home page.
 * Browsers block audio until the first interaction, so the ambience starts on the first click / key / touch if autoplay is refused.
 */
export function SoundEngine() {
  const pathname = usePathname();
  const muted = useSound((s) => s.muted);
  const ambient = useRef<HTMLAudioElement | null>(null);
  const clicks = useRef<HTMLAudioElement[]>([]);
  const home = pathname === "/";

  // click sound (small pool so rapid clicks overlap)
  useEffect(() => {
    void useSound.persist.rehydrate();
    clicks.current = Array.from({ length: 4 }, () => {
      const a = new Audio("/sounds/click.mp3");
      a.preload = "auto";
      a.volume = 0.45;
      return a;
    });
    let i = 0;
    const onDown = (e: PointerEvent) => {
      if (useSound.getState().muted) return;
      const el = e.target instanceof Element ? e.target.closest(CLICK_SELECTOR) : null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      const a = clicks.current[i++ % clicks.current.length];
      a.currentTime = 0;
      void a.play().catch(() => {});
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  // looping sunrise ambience on the home page only
  useEffect(() => {
    if (!ambient.current) {
      const a = new Audio("/sounds/sunrise.mp3");
      a.loop = true;
      a.preload = "auto";
      a.volume = 0.35;
      ambient.current = a;
    }
    const a = ambient.current;
    if (!home || muted) {
      a.pause();
      return;
    }
    const start = () => void a.play().catch(() => {});
    start();
    // autoplay blocked → begin on the first user gesture
    const kick = () => {
      if (a.paused) start();
    };
    const opts = { once: true, capture: true } as const;
    window.addEventListener("pointerdown", kick, opts);
    window.addEventListener("keydown", kick, opts);
    window.addEventListener("touchstart", kick, opts);
    return () => {
      window.removeEventListener("pointerdown", kick, opts);
      window.removeEventListener("keydown", kick, opts);
      window.removeEventListener("touchstart", kick, opts);
    };
  }, [home, muted]);

  useEffect(() => () => ambient.current?.pause(), []);
  return null;
}

export function SoundToggle({ className }: { className?: string }) {
  const { muted, toggle } = useSound();
  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Sound off" : "Sound on"}
      className={cn("grid size-9 place-items-center rounded-full text-fg-muted transition hover:bg-surface-sunken hover:text-fg", className)}
    >
      {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
    </button>
  );
}
