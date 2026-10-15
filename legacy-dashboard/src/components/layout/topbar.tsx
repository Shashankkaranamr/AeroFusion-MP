"use client";

import { Bell, CalendarClock, Search, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useMemo } from "react";
import { AqiBadge, Dot } from "@/components/ui/badge";
import { Kbd, Tip } from "@/components/ui/primitives";
import { useClock } from "@/hooks/use-anchor";
import { useLive } from "@/hooks/use-live";
import { useAppStore } from "@/hooks/use-app-store";
import { fmtDateTimeMs } from "@/lib/format";
import { citySeries, fmtIst, peak, window } from "@/lib/live";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { SoundToggle } from "./sound";
import { ThemeToggle } from "./theme-toggle";

function DataModePill() {
  const { snap, error, countdown } = useLive();
  const state = snap && !error ? "live" : error ? "offline" : "connecting";
  const ok = snap?.sources.filter((x) => x.ok).length ?? 0;
  const color = state === "live" ? "#10b981" : state === "offline" ? "#ef4444" : "#f59e0b";
  return (
    <Tip
      content={
        <div className="space-y-1">
          <div className="font-semibold">{state === "live" ? "Live data" : state === "offline" ? "Backend offline" : "Connecting…"}</div>
          <div className="text-fg-muted">
            {snap
              ? `${ok}/${snap.sources.length} sources online · last sync ${fmtIst(Date.parse(snap.updated_at), { hour: "numeric", minute: "2-digit", hour12: true })}${countdown !== null ? ` · next in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}` : ""}`
              : (error ?? "Waiting for the AeroFusion API")}
          </div>
        </div>
      }
      side="bottom"
    >
      <Link
        href="/pipeline"
        className={cn(
          "hidden h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold sm:flex",
          state === "live" ? "bg-emerald-400/15 text-emerald-300" : state === "offline" ? "bg-red-400/15 text-red-300" : "bg-amber-400/15 text-amber-300",
        )}
      >
        <Dot color={color} pulse />
        {state === "live" ? "Live" : state === "offline" ? "Offline" : "Connecting"}
      </Link>
    </Tip>
  );
}

function Clock() {
  const now = useClock();
  return (
    <div className="hidden h-8 items-center gap-1.5 px-2.5 text-xs font-medium text-fg-muted xl:flex">
      <CalendarClock className="size-3.5 text-fg-subtle" />
      <span className="tabular">{now ? fmtDateTimeMs(now) : "—"}</span>
    </div>
  );
}

function Notifications() {
  const setCity = useAppStore((s) => s.setCity);
  const { snap } = useLive();
  const alerts = useMemo(() => {
    if (!snap) return [];
    const now = Date.parse(snap.updated_at);
    return snap.cities
      .map((c) => ({ c, p: peak(window(citySeries(c, now), 1, 24)) }))
      .filter((a) => (a.p?.pm25 ?? 0) > 90)
      .sort((a, b) => (b.p!.pm25 ?? 0) - (a.p!.pm25 ?? 0))
      .map(({ c, p }) => ({ city: c, peak24: p!.pm25 ?? 0, peakLead: p!.lead }));
  }, [snap]);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label="Alerts" className="relative grid size-9 place-items-center rounded-full text-fg-muted transition hover:bg-surface-sunken hover:text-fg">
          <Bell className="size-[18px]" />
          {alerts.length > 0 && (
            <span className="absolute right-2 top-2 grid size-2 place-items-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-red-500" />
              <span className="relative size-2 rounded-full bg-red-500" />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={12}
          className="glass-pop z-[90] w-[340px] rounded-[26px] p-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="font-display text-[15px] font-semibold">Forecast alerts</div>
            <span className="text-[11px] text-fg-subtle">CAMS · next 24 h</span>
          </div>
          <div className="max-h-[360px] space-y-1 overflow-y-auto" data-lenis-prevent>
            {alerts.length === 0 && <div className="px-3 py-6 text-center text-xs text-fg-muted">No cities forecast to cross “Poor”.</div>}
            {alerts.map((a) => (
              <Link key={a.city.slug} href="/forecast" onClick={() => setCity(a.city.slug)} className="flex items-start gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-surface-sunken">
                <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500">
                  <TriangleAlert className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.city.name}</span>
                    <AqiBadge pm={a.peak24} size="xs" />
                  </div>
                  <div className="mt-0.5 text-xs text-fg-muted">
                    Peak <span className="font-semibold text-fg tabular">{Math.round(a.peak24)} µg/m³</span> expected in {a.peakLead} h
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Floating toolbar: capsules of Liquid Glass over a soft scroll-edge blur. */
export function Topbar() {
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  return (
    <header className="sticky top-0 z-30 h-[76px]">
      <div className="scroll-edge pointer-events-none absolute inset-x-0 top-0 h-[104px]" />
      <div className="relative flex h-full items-center gap-2.5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden" aria-label="Home">
          <LogoMark className="size-7" />
        </Link>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setCommandOpen(true)}
          className="glass group flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-left text-sm text-fg-subtle transition sm:max-w-[400px]"
        >
          <Search className="size-4 shrink-0 transition group-hover:text-primary" />
          <span className="truncate">Search city, page or action</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </motion.button>
        <div className="glass ml-auto flex h-11 items-center gap-0.5 rounded-full p-1">
          <Clock />
          <DataModePill />
          <Notifications />
          <SoundToggle />
          <ThemeToggle />
          <Link
            href="/about"
            className="hidden size-9 place-items-center rounded-full bg-gradient-to-br from-[#5ad1bb] to-[#4b7fe6] text-[11px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:grid"
            aria-label="Profile"
          >
            S
          </Link>
        </div>
      </div>
    </header>
  );
}
