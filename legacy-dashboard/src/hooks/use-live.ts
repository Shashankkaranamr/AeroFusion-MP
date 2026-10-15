"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface LiveSource {
  id: string;
  name: string;
  provider: string;
  kind: string;
  key: boolean;
  ok: boolean;
  records: number;
  latency_ms: number;
  error: string | null;
  fetched_at: string | null;
}

export interface LiveSeries {
  time: string[];
  pm25: (number | null)[];
  pm10: (number | null)[];
  aod: (number | null)[];
  temp: (number | null)[];
  rh: (number | null)[];
  wind: (number | null)[];
  wind_dir: (number | null)[];
  pblh: (number | null)[];
}

export interface LiveCity {
  slug: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  pm25: number | null;
  pm10: number | null;
  aod: number | null;
  dust: number | null;
  no2: number | null;
  co: number | null;
  temp: number | null;
  rh: number | null;
  wind: number | null;
  pressure: number | null;
  precip: number | null;
  pblh: number | null;
  fires_300km: number | null;
  frp_300km: number | null;
  fires_upwind: number | null;
  cpcb_baseline: number | null;
  us_aqi: number | null;
  wind_dir: number | null;
  pm25_24h: (number | null)[];
  series: LiveSeries;
  cpcb: { pm25_mean: number; n_days: number; stations: number; period: string; station_names: string[] } | null;
  observed_at: string | null;
}

export interface GibsLayer {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  url: string;
  layers: string;
  transparent: boolean;
}

export interface LiveFire {
  lat: number;
  lon: number;
  frp: number;
  confidence: string;
  satellite: string;
  acq?: string;
}

export interface LiveSnapshot {
  updated_at: string;
  took_ms: number;
  interval_s: number;
  refresh_count: number;
  next_refresh_in: number;
  sources: LiveSource[];
  cities: LiveCity[];
  fires: { total: number; points: LiveFire[]; regions: { region: string; count: number; frp: number }[] };
  gibs: { layers: GibsLayer[]; cities: { city: string; name: string; date: string; url: string }[] } | null;
  tensor: {
    shape: number[];
    dims: string[];
    features: { key: string; label: string; unit: string; source: string }[];
    cities: string[];
    z: (number | null)[][];
    coverage: number;
    file: string;
  };
}

interface LiveState {
  snap: LiveSnapshot | null;
  error: string | null;
  refreshing: boolean;
  countdown: number | null;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
}

const LiveCtx = createContext<LiveState | null>(null);

function useLiveState(): LiveState {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const lastUpdated = useRef<string | null>(null);

  const apply = useCallback((s: LiveSnapshot) => {
    lastUpdated.current = s.updated_at;
    setSnap(s);
    setCountdown(s.next_refresh_in);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/live/snapshot`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      apply((await r.json()) as LiveSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [apply]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch(`${API_URL}/api/live/refresh`, { method: "POST" });
      if (r.status === 409) await load();
      else if (!r.ok) throw new Error(`HTTP ${r.status}`);
      else apply((await r.json()) as LiveSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [load, apply]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${API_URL}/api/live/status`, { cache: "no-store" });
        if (!r.ok) return;
        const s = (await r.json()) as { updated_at: string | null; next_refresh_in: number };
        setCountdown(s.next_refresh_in);
        if (s.updated_at && s.updated_at !== lastUpdated.current) await load();
      } catch {
        setError((e) => e ?? "Backend unreachable");
      }
    }, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => (c === null ? c : Math.max(0, c - 1))), 1000);
    return () => clearInterval(id);
  }, []);

  return { snap, error, refreshing, countdown, refresh, reload: load };
}

/** One shared connection to the AeroFusion backend for the whole app. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const state = useLiveState();
  return createElement(LiveCtx.Provider, { value: state }, children);
}

export function useLive(): LiveState {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}

/** Fetch a JSON endpoint once per path, with loading/error state. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    fetch(`${API_URL}${path}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => alive && setState({ path, data: j as T, error: null }))
      .catch((e) => alive && setState({ path, data: null, error: String(e) }));
    return () => {
      alive = false;
    };
  }, [path]);
  const current = state.path === path;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!path && (!current || (!state.data && !state.error)) };
}
