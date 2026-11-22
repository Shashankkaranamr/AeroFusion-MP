import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap } from "maplibre-gl";
import { upwindOf } from "@/components/map/overlays";
import { PulsatingLoader } from "@/components/ui/loader";
import { SourceNote } from "@/components/ui/card";
import { useApi, type LiveCity, type LiveSnapshot } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Mirrors backend/app/ml/inference.py LiveForecaster._sensitivity. */
export interface Sensitivity {
  status: "available" | "pending" | "no_station";
  message?: string;
  issued_at?: string;
  hours?: number;
  base?: number;
  groups?: { group: string; features: string[]; available: boolean; delta: number | null }[];
  places?: { kind: "city" | "region"; id: string; name: string; lat: number; lon: number; km: number; delta: number }[];
  notes?: string[];
}

export const GROUP_LABEL: Record<string, string> = {
  history: "Recent measured pollution",
  met: "Weather",
  fire: "Fires",
  cams: "CAMS forecast",
  dust: "Dust & aerosol (CAMS)",
  traffic_proxy: "Traffic proxy (NO₂, CO, weekday)",
};

export function useSensitivity(city: string | null) {
  return useApi<Sensitivity>(city ? `/api/model/sensitivity?city=${encodeURIComponent(city)}` : null).data;
}

const fmtDelta = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)}`;

/** Signed bars: how much the model's next-day forecast changes when each input group is treated as missing. */
export function SensitivityBars({ s, limit, className }: { s: Sensitivity; limit?: number; className?: string }) {
  const rows = [...(s.groups ?? [])].sort((a, b) => Math.abs(b.delta ?? -1) - Math.abs(a.delta ?? -1)).slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.delta ?? 0)));
  return (
    <ul className={cn("grid gap-2", className)}>
      {rows.map((r) => (
        <li key={r.group} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[13px]">
          <span className={r.available ? "text-ink" : "text-ink-3"}>{GROUP_LABEL[r.group] ?? r.group}</span>
          <span className={cn("mono text-[12px]", !r.available ? "text-ink-3" : (r.delta ?? 0) > 0 ? "text-ember-ink" : "text-ink-2")}>
            {r.available && r.delta != null ? `${fmtDelta(r.delta)} µg/m³` : "not available live"}
          </span>
          <span className="col-span-2 relative h-1.5 bg-press-2" aria-hidden>
            {r.available && r.delta != null && (
              <span
                className={cn("absolute top-0 h-full", r.delta >= 0 ? "left-1/2 bg-ember" : "right-1/2 bg-ink-2")}
                style={{ width: `${(Math.abs(r.delta) / max) * 50}%` }}
              />
            )}
            <span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-ink-3" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Compact block for the main map's city panel. */
export function SensitivityPanel({ city }: { city: string }) {
  const s = useSensitivity(city);
  if (!s) return <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-2"><PulsatingLoader /> Asking our model what it leans on…</div>;
  if (s.status === "no_station") return null;
  if (s.status !== "available") return null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="tag mb-3">What our model leans on · next {s.hours} h</div>
      <SensitivityBars s={s} limit={3} />
      <a href="#sources-map" className="mt-3 inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink">
        All inputs and upwind places ↓
      </a>
    </div>
  );
}

/** Second map: arrows from the upwind places the model links to this city, upwind fires, and the wind. */
export function SourcesMap({ snap, sel, baseStyle }: { snap: LiveSnapshot; sel: LiveCity; baseStyle: () => maplibregl.StyleSpecification }) {
  const s = useSensitivity(sel.slug);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [, redraw] = useState(0);
  const upFires = useMemo(() => upwindOf(sel, snap.fires.points), [sel, snap]);

  useEffect(() => {
    if (!box.current) return;
    const map = new maplibregl.Map({ container: box.current, style: baseStyle(), center: [sel.lon, sel.lat], zoom: 5, attributionControl: false, dragRotate: false });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("fires", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "fires",
        type: "circle",
        source: "fires",
        paint: { "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 1.6, 200, 4], "circle-color": ["case", ["get", "up"], "#ff7a1a", "#7a5a45"], "circle-opacity": ["case", ["get", "up"], 0.9, 0.35] },
      });
      setReady(true);
    });
    const r = () => redraw((x) => x + 1);
    map.on("move", r);
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // fires and framing follow the selected city
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("fires") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: snap.fires.points.map((f, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [f.lon, f.lat] }, properties: { frp: f.frp, up: upFires.has(i) } })),
    });
    const pts: [number, number][] = [[sel.lon, sel.lat], ...(s?.places ?? []).map((p) => [p.lon, p.lat] as [number, number])];
    const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b.isEmpty() ? new maplibregl.LngLatBounds([sel.lon - 4, sel.lat - 4], [sel.lon + 4, sel.lat + 4]) : b, { padding: 70, maxZoom: 6.2, duration: 600 });
  }, [ready, sel, snap, s, upFires]);

  const map = mapRef.current;
  const places = s?.status === "available" ? (s.places ?? []) : [];
  const maxD = Math.max(0.5, ...places.map((p) => Math.abs(p.delta)));
  const c = map && ready ? map.project([sel.lon, sel.lat]) : null;
  const windTo = sel.wind_dir == null ? null : (sel.wind_dir + 180) % 360;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]" id="sources-map">
      <div className="relative h-[440px] overflow-hidden shadow-[0_0_0_1px_var(--line-2)]">
        <div ref={box} className="!absolute inset-0 size-full" role="region" aria-label={`Upwind places, fires and wind around ${sel.name}`} />
        {c && map && (
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
            <defs>
              <marker id="src-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 1 L9 5 L0 9" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              </marker>
            </defs>
            {places.map((p) => {
              const a = map.project([p.lon, p.lat]);
              const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
              const bx = c.x - ((c.x - a.x) / len) * 14;
              const by = c.y - ((c.y - a.y) / len) * 14;
              const w = 1.2 + (Math.abs(p.delta) / maxD) * 5;
              return (
                <g key={p.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={bx}
                    y2={by}
                    stroke={Math.abs(p.delta) < 0.05 ? "var(--ink-3)" : p.delta > 0 ? "var(--ember)" : "var(--ink-2)"}
                    strokeWidth={Math.abs(p.delta) < 0.05 ? 1 : w}
                    strokeDasharray={Math.abs(p.delta) < 0.05 ? "2 5" : undefined}
                    strokeOpacity={0.85}
                    markerEnd="url(#src-arrow)"
                  />
                  <circle cx={a.x} cy={a.y} r={p.kind === "region" ? 5 : 4} fill={p.kind === "region" ? "none" : "var(--ink)"} stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={a.x} y={p.kind === "region" ? a.y + 19 : a.y - 9} fill={p.kind === "region" ? "var(--ink-2)" : "var(--ink)"} fontSize={11.5} fontFamily="var(--font-mono)" textAnchor="middle" paintOrder="stroke" stroke="var(--bg)" strokeWidth={3}>
                    {p.name} {fmtDelta(p.delta)}
                  </text>
                </g>
              );
            })}
            {windTo != null && (
              <g transform={`translate(${c.x},${c.y}) rotate(${windTo})`}>
                <line x1={0} y1={34} x2={0} y2={-34} stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray="3 4" markerEnd="url(#src-arrow)" />
              </g>
            )}
            <circle cx={c.x} cy={c.y} r={7} fill="var(--ember)" stroke="var(--bg)" strokeWidth={2} />
            <text x={c.x} y={c.y + 22} fill="var(--ink)" fontSize={13} fontWeight={600} textAnchor="middle" paintOrder="stroke" stroke="var(--bg)" strokeWidth={3}>
              {sel.name}
            </text>
          </svg>
        )}
        {!s && (
          <div className="glass absolute left-3 top-3 flex items-center gap-2 px-3 py-2 text-[12.5px] text-ink-2">
            <PulsatingLoader /> Running our model without each input…
          </div>
        )}
        <div className="glass absolute bottom-3 left-3 grid gap-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
          <span><span className="mr-1.5 inline-block h-[3px] w-5 bg-ember align-middle" />raises the forecast</span>
          <span><span className="mr-1.5 inline-block h-[3px] w-5 bg-ink-2 align-middle" />lowers it</span>
          <span><span className="mr-1.5 inline-block w-5 border-t border-dashed border-ink-3 align-middle" />≈ no effect (under 0.05)</span>
          <span><span className="mr-1.5 inline-block size-2 rounded-full bg-[#ff7a1a] align-middle" />fire upwind (NASA FIRMS)</span>
          <span>– – › wind direction now</span>
        </div>
      </div>

      <aside className="shadow-[0_0_0_1px_var(--line-2)] p-5">
        <div className="tag">Our model · {sel.name}</div>
        {!s ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2"><PulsatingLoader /> Working…</p>
        ) : s.status === "no_station" ? (
          <p className="mt-3 text-[13.5px] text-ink-2">{sel.name} has no measuring station in our model&rsquo;s panel, so the model makes no forecast for it and there is nothing to break down.</p>
        ) : s.status !== "available" ? (
          <p className="mt-3 text-[13.5px] text-ink-2">{s.message ?? "Not available right now."}</p>
        ) : (
          <>
            <h3 className="display mt-2 text-[1.4rem]">
              {Math.round(s.base!)} <span className="font-mono text-[11px] text-ink-2">µg/m³ forecast, next {s.hours} h average</span>
            </h3>
            <div className="tag mb-3 mt-5">Without each input group</div>
            <SensitivityBars s={s} />
            <div className="tag mb-2 mt-5">Upwind places the model links to {sel.name}</div>
            {places.length ? (
              <ul className="grid gap-1 text-[13px]">
                {places.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="text-ink">
                      {p.name} <span className="mono text-[11px] text-ink-3">{p.kind === "region" ? "region" : "city"} · {p.km} km</span>
                    </span>
                    <span className="mono text-[12px] text-ink-2">{fmtDelta(p.delta)} µg/m³</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-2">Today&rsquo;s wind brings air from no other place in the model&rsquo;s panel.</p>
            )}
            <SourceNote className="mt-5">
              {s.notes?.join(" ")} Recent measured pollution reaches public sources days late, so the live model runs without it, and upwind places
              therefore pass on little. Factories and other industry are not in this project&rsquo;s data, so they are not shown. Fire dots and
              the wind arrow are observations, not model results.
            </SourceNote>
          </>
        )}
      </aside>
    </div>
  );
}
