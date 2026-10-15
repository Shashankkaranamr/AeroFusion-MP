"use client";

import { useSyncExternalStore } from "react";
import { HOUR_MS, type Hour } from "@/lib/sim/core";

/**
 * The current hour (hours since epoch) on the client, `null` during SSR / prerender.
 * Time-dependent demo data is only computed in the browser, which keeps the
 * prerendered shell static and avoids hydration mismatches.
 */
const listeners = new Set<() => void>();
let current: Hour | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function read(): Hour {
  return Math.floor(Date.now() / HOUR_MS);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = read();
    timer = setInterval(() => {
      const next = read();
      if (next !== current) {
        current = next;
        listeners.forEach((l) => l());
      }
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): Hour {
  if (current === null) current = read();
  return current;
}

export function useAnchor(): Hour | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** Wall-clock milliseconds, ticking every `interval` ms on the client. */
const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 15_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

export function useClock(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => {
      if (!clockNow) clockNow = Date.now();
      return clockNow;
    },
    () => null,
  );
}
