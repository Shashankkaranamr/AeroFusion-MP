import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The AeroFusion API. In dev, Vite proxies /api to it (vite.config.js), so this stays relative;
 * a deployed build sets VITE_API_URL to the API's origin.
 */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

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
  cpcb: { pm25_mean: number; pm25_p90?: number; n_days: number; stations: number; period: string; station_names: string[] } | null;
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

/**
 * How the connection is doing:
 *   connecting — first request in flight
 *   waking     — no answer after a few seconds: the free server is starting (cold start, ~1 min)
 *   live       — data in hand
 *   offline    — the API can't be reached; any data shown is the last we had
 */
export type Phase = "connecting" | "waking" | "live" | "offline";

interface LiveState {
  snap: LiveSnapshot | null;
  phase: Phase;
  error: string | null;
  refreshing: boolean;
  countdown: number | null;
  /** When the data was last received by this page (ms). */
  receivedAt: number | null;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
}

const LiveCtx = createContext<LiveState | null>(null);

function useLiveState(): LiveState {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const lastUpdated = useRef<string | null>(null);
  const hasData = useRef(false);

  const apply = useCallback((s: LiveSnapshot) => {
    lastUpdated.current = s.updated_at;
    hasData.current = true;
    setSnap(s);
    setCountdown(s.next_refresh_in);
    setReceivedAt(Date.now());
    setError(null);
    setPhase("live");
  }, []);

  const load = useCallback(async () => {
    // A cold server takes up to a minute; say so after a few seconds instead of spinning silently.
    const slow = setTimeout(() => !hasData.current && setPhase("waking"), 3500);
    try {
      const r = await fetch(`${API_URL}/api/live/snapshot`, { cache: "no-store" });
      if (!r.ok) throw new Error(`The API answered ${r.status}.`);
      apply((await r.json()) as LiveSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase((p) => (hasData.current ? "offline" : p === "connecting" ? "waking" : "offline"));
    } finally {
      clearTimeout(slow);
    }
  }, [apply]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch(`${API_URL}/api/live/refresh`, { method: "POST" });
      if (r.status === 409 || r.status === 429) await load();
      else if (!r.ok) throw new Error(`Refresh failed: the API answered ${r.status}.`);
      else apply((await r.json()) as LiveSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [load, apply]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    // Until the first answer, retry every 8 s (the cold start); then poll the cheap status call.
    const id = setInterval(async () => {
      if (!hasData.current) return void load();
      try {
        const r = await fetch(`${API_URL}/api/live/status`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const s = (await r.json()) as { updated_at: string | null; next_refresh_in: number };
        setCountdown(s.next_refresh_in);
        setPhase("live");
        if (s.updated_at && s.updated_at !== lastUpdated.current) await load();
      } catch {
        setPhase("offline");
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

  return { snap, phase, error, refreshing, countdown, receivedAt, refresh, reload: load };
}

/** One shared connection to the AeroFusion API for the whole app. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const state = useLiveState();
  return createElement(LiveCtx.Provider, { value: state }, children);
}

export function useLive(): LiveState {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}

/** Fetch a JSON endpoint once per path, with loading and error state. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    fetch(`${API_URL}${path}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`The API answered ${r.status}.`))))
      .then((j) => alive && setState({ path, data: j as T, error: null }))
      .catch((e) => alive && setState({ path, data: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [path]);
  const current = state.path === path;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!path && (!current || (!state.data && !state.error)) };
}
