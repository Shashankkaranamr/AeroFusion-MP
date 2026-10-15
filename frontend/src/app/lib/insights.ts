import { useEffect, useRef, useState } from "react";
import { API_URL, useLive } from "./api";

export interface Insight {
  title: string;
  finding: string;
  reasoning: string;
  tone: "alert" | "warn" | "good" | "info";
  cities?: string[];
  confidence?: string;
}

export interface InsightsResp {
  headline: string;
  insights: Insight[];
  updated_at: string | null;
  model: string | null;
  generating?: boolean;
  generating_for_s?: number;
  error?: string | null;
  stale?: boolean;
}

/**
 * The AI's insight cards for the current snapshot. The server writes them in the background after
 * each refresh; while it is still writing, this polls every 8 s. `regenerate()` asks for a fresh set.
 */
export function useInsights(provider: string) {
  const { snap } = useLive();
  const [data, setData] = useState<InsightsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [tick, setTick] = useState(0);
  const forced = useRef(0);

  useEffect(() => {
    if (!snap) return;
    let alive = true;
    const force = nonce > forced.current;
    if (force) forced.current = nonce;
    fetch(`${API_URL}/api/ai/insights?provider=${encodeURIComponent(provider)}${force ? "&force=1" : ""}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).detail ?? `The AI service answered ${r.status}.`))))
      .then((j: InsightsResp) => {
        if (!alive) return;
        setData(j);
        setError(j.error && !j.insights?.length ? j.error : null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [snap?.updated_at, provider, nonce, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const generating = !!data?.generating;
  useEffect(() => {
    if (!generating) return;
    const id = setTimeout(() => setTick((t) => t + 1), 8000);
    return () => clearTimeout(id);
  }, [generating, tick]);

  return { data, error, generating, regenerate: () => setNonce((n) => n + 1) };
}

export const TONE: Record<Insight["tone"], { color: string; label: string }> = {
  alert: { color: "var(--bad)", label: "Alert" },
  warn: { color: "var(--warn)", label: "Watch" },
  good: { color: "var(--good)", label: "Good news" },
  info: { color: "var(--moon)", label: "Context" },
};
