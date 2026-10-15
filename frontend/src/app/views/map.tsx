import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import { Layers, Pause, Play, X } from "lucide-react";
import { AqiBadge } from "@/components/aqi";
import { createWindLayer, particlesToMap, upwindOf, windAt } from "@/components/map/overlays";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { AnimatedLink } from "@/components/ui/animated-link";
import { useLive, type LiveSnapshot } from "@/lib/api";
import { AQI_CATEGORIES, categoryForPm } from "@/lib/aqi";
import { INDIA_OUTLINE, INDIA_STATES } from "@/lib/geo/india";
import { fmtDay, fmtHour, fmtLead } from "@/lib/format";
import { at, citySeries, windGraph } from "@/lib/live";
import { usePrefs } from "@/lib/prefs";
import { href } from "@/lib/router";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const BOUNDS: [[number, number], [number, number]] = [
  [67.5, 6],
  [98.5, 37.6],
];
const GIBS_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [68, 37.5],
  [98, 37.5],
  [98, 6],
  [68, 6],
];
const SATS = [
  { id: "none", label: "None" },
  { id: "truecolor-viirs", label: "True colour" },
  { id: "fires", label: "Thermal" },
  { id: "aod", label: "Aerosol depth" },
  { id: "aerosol-index", label: "Smoke & dust" },
  { id: "lst", label: "Surface heat" },
] as const;

type Toggle = "cities" | "heat" | "fires" | "wind" | "transport";
const TOGGLES: { id: Toggle; label: string }[] = [
  { id: "cities", label: "City PM2.5" },
  { id: "heat", label: "PM2.5 heat" },
  { id: "fires", label: "Fires" },
  { id: "wind", label: "Wind" },
  { id: "transport", label: "Transport" },
];

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const rgb = (name: string, a = 1) => `rgba(${css(name).split(/\s+/).join(",")},${a})`;

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      states: { type: "geojson", data: INDIA_STATES as unknown as FeatureCollection },
      outline: { type: "geojson", data: INDIA_OUTLINE as unknown as FeatureCollection },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": css("--bg") } },
      { id: "land", type: "fill", source: "outline", paint: { "fill-color": css("--surface"), "fill-opacity": 0.9 } },
      { id: "states", type: "line", source: "states", paint: { "line-color": rgb("--ink-rgb", 0.1), "line-width": 0.7 } },
      { id: "coast", type: "line", source: "outline", paint: { "line-color": rgb("--ink-rgb", 0.28), "line-width": 1 } },
    ],
  };
}

function citiesAt(snap: LiveSnapshot, lead: number, now: number): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: snap.cities.map((c) => {
      const pm = lead === 0 ? c.pm25 : (at(citySeries(c, now), lead)?.pm25 ?? null);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
        properties: { slug: c.slug, name: c.name, pm: pm ?? 0, has: pm != null, color: pm == null ? "#888" : categoryForPm(pm).color },
      };
    }),
  };
}

export function MapView({ fromStory }: { fromStory: boolean }) {
  const { snap } = useLive();
  const { city, setCity } = usePrefs();
  const box = useRef<HTMLDivElement>(null);
  const windCanvas = useRef<HTMLCanvasElement>(null);
  const arrival = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const wind = useRef<ReturnType<typeof createWindLayer> | null>(null);
  const [ready, setReady] = useState(false);
  const [lead, setLead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [on, setOn] = useState<Record<Toggle, boolean>>({ cities: true, heat: true, fires: true, wind: true, transport: true });
  const [sat, setSat] = useState<(typeof SATS)[number]["id"]>("none");
  // On a phone the panel would cover the map: it starts closed there, one tap away.
  const [panel, setPanel] = useState(() => window.innerWidth >= 640);
  const [layersOpen, setLayersOpen] = useState(false);
  const [, redraw] = useState(0);
  const now = useMemo(() => Date.now(), [snap?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = snap?.cities.find((c) => c.slug === city) ?? snap?.cities[0];

  // Edges into the selected city: who sends it particles today, with each one's share.
  const inflow = useMemo(() => {
    if (!snap || !sel) return [];
    const edges = windGraph(snap.cities).edges.filter((e) => e.to.slug === sel.slug).slice(0, 5);
    const total = edges.reduce((s, e) => s + e.w, 0) || 1;
    return edges.map((e) => ({ from: e.from, share: e.w / total, km: e.km }));
  }, [snap, sel]);

  /* ----------------------------------------------------------- map setup -- */
  useEffect(() => {
    if (!box.current || !snap) return;
    const map = new maplibregl.Map({
      container: box.current,
      style: baseStyle(),
      bounds: BOUNDS,
      fitBoundsOptions: { padding: { top: 24, bottom: 120, left: 24, right: 24 } },
      maxBounds: [
        [55, -2],
        [112, 44],
      ],
      attributionControl: { compact: true, customAttribution: "CAMS · Open-Meteo · NASA FIRMS & GIBS" },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    // Zoom buttons on wide screens; phones pinch.
    if (window.innerWidth >= 640) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // satellite (one at a time, under the data)
      for (const l of snap.gibs?.layers ?? []) {
        map.addSource(`sat-${l.id}`, { type: "image", url: l.url, coordinates: GIBS_CORNERS });
        map.addLayer({ id: `sat-${l.id}`, type: "raster", source: `sat-${l.id}`, layout: { visibility: "none" }, paint: { "raster-opacity": l.transparent ? 0.85 : 0.92, "raster-fade-duration": 200 } }, "states");
      }
      map.addSource("cities", { type: "geojson", data: citiesAt(snap, 0, now) });
      map.addLayer({
        id: "heat",
        type: "heatmap",
        source: "cities",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "pm"], 0, 0, 250, 1],
          "heatmap-intensity": 1.1,
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 38, 6, 90],
          "heatmap-opacity": 0.55,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "rgba(163,198,68,0.35)", 0.45, "rgba(232,185,49,0.5)", 0.7, "rgba(242,136,58,0.65)", 1, "rgba(229,72,77,0.8)"],
        },
      });
      map.addSource("fires", {
        type: "geojson",
        data: { type: "FeatureCollection", features: snap.fires.points.map((f, i) => ({ type: "Feature", id: i, geometry: { type: "Point", coordinates: [f.lon, f.lat] }, properties: { frp: f.frp } })) },
      });
      map.addLayer({
        id: "fires",
        type: "circle",
        source: "fires",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 1.4, 50, 3.5],
          "circle-color": ["case", ["boolean", ["feature-state", "upwind"], false], "#ffc27a", "#ff8a3d"],
          "circle-opacity": ["case", ["boolean", ["feature-state", "upwind"], false], 1, 0.45],
          "circle-blur": 0.3,
        },
      });
      map.addLayer({
        id: "cities-halo",
        type: "circle",
        source: "cities",
        paint: { "circle-radius": ["interpolate", ["linear"], ["get", "pm"], 0, 7, 150, 16], "circle-color": ["get", "color"], "circle-opacity": fromStory ? 0 : 0.18, "circle-opacity-transition": { duration: 600 } },
      });
      map.addLayer({
        id: "cities",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "pm"], 0, 4, 150, 8],
          "circle-color": ["get", "color"],
          "circle-stroke-color": css("--surface"),
          "circle-stroke-width": 1.5,
          "circle-opacity": fromStory ? 0 : 1,
          "circle-stroke-opacity": fromStory ? 0 : 1,
          "circle-opacity-transition": { duration: 600 },
          "circle-stroke-opacity-transition": { duration: 600 },
        },
      });
      map.on("click", "cities", (e: MapLayerMouseEvent) => {
        const slug = e.features?.[0]?.properties?.slug as string | undefined;
        if (slug) {
          sound.tick();
          setCity(slug);
          setPanel(true);
        }
      });
      map.on("mouseenter", "cities", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "cities", () => (map.getCanvas().style.cursor = ""));
      map.on("move", () => redraw((n) => n + 1));

      if (windCanvas.current) wind.current = createWindLayer(map, windCanvas.current);
      setReady(true);

      // Arriving from the story: the ember breaks open and its particles fly to the cities.
      if (fromStory && arrival.current) {
        const targets = snap.cities.map((c) => {
          const p = map.project([c.lon, c.lat]);
          return { x: p.x, y: p.y, color: c.pm25 == null ? "#888" : categoryForPm(c.pm25).color };
        });
        particlesToMap(arrival.current, targets, () => {
          map.setPaintProperty("cities", "circle-opacity", 1);
          map.setPaintProperty("cities", "circle-stroke-opacity", 1);
          map.setPaintProperty("cities-halo", "circle-opacity", 0.18);
          history.replaceState(null, "", href("map"));
        });
      }
    });
    return () => {
      wind.current?.destroy();
      wind.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [snap?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------------------------------- data by time -- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !snap) return;
    (map.getSource("cities") as GeoJSONSource | undefined)?.setData(citiesAt(snap, lead, now));
    wind.current?.setField(windAt(snap.cities, lead, now));
  }, [lead, ready, snap, now]);

  /* ------------------------------------------------------------ toggles -- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = (id: string, v: boolean) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    vis("cities", on.cities);
    vis("cities-halo", on.cities);
    vis("heat", on.heat);
    vis("fires", on.fires);
    wind.current?.setVisible(on.wind);
    for (const s of SATS) if (s.id !== "none") vis(`sat-${s.id}`, sat === s.id);
  }, [on, sat, ready]);

  /* -------------------------------------------- fires upwind of selected -- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !snap || !sel) return;
    const up = upwindOf(sel, snap.fires.points);
    snap.fires.points.forEach((_, i) => map.setFeatureState({ source: "fires", id: i }, { upwind: up.has(i) }));
  }, [sel, ready, snap]);

  /* ---------------------------------------------------------------- play -- */
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setLead((l) => (l >= 96 ? -48 : l + 1)), 140);
    return () => clearInterval(id);
  }, [playing]);

  const upCount = useMemo(() => (snap && sel ? upwindOf(sel, snap.fires.points).size : 0), [snap, sel]);
  if (!snap || !sel) return null;
  const map = mapRef.current;
  const selPm = lead === 0 ? sel.pm25 : (at(citySeries(sel, now), lead)?.pm25 ?? null);
  const leadMs = now + lead * 3_600_000;

  return (
    <div className="-mx-[var(--gutter)] -mt-8 sm:-mt-10">
      <div className="relative h-[calc(100dvh-196px)] min-h-[520px] sm:h-[calc(100dvh-140px)] sm:min-h-[560px] overflow-hidden sm:mx-[var(--gutter)] sm:mt-6 sm:shadow-[0_0_0_1px_var(--line-2)]">
        <div ref={box} className="!absolute inset-0 size-full" aria-label="Map of India with PM2.5 for 33 cities" role="region" />
        <canvas ref={windCanvas} aria-hidden className="pointer-events-none absolute inset-0 size-full transition-opacity duration-300" />

        {/* Transport arrows into the selected city */}
        {map && on.transport && (
          <svg ref={svg} aria-hidden className="pointer-events-none absolute inset-0 size-full">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 1 L9 5 L0 9" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
              </marker>
            </defs>
            {inflow.map((e) => {
              const a = map.project([e.from.lon, e.from.lat]);
              const b = map.project([sel.lon, sel.lat]);
              const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
              const bx = b.x - ((b.x - a.x) / len) * 12;
              const by = b.y - ((b.y - a.y) / len) * 12;
              const mx = (a.x + bx) / 2 - (by - a.y) * 0.2;
              const my = (a.y + by) / 2 + (bx - a.x) * 0.2;
              return (
                <g key={e.from.slug}>
                  <path d={`M${a.x},${a.y} Q${mx},${my} ${bx},${by}`} fill="none" stroke="var(--ink)" strokeOpacity={0.35 + e.share * 0.6} strokeWidth={1 + e.share * 3} strokeDasharray="4 5" markerEnd="url(#arrow)" className="motion-safe:animate-[flow_0.9s_linear_infinite]" />
                  {len > 70 && <text x={mx} y={my} fill="var(--ink)" fontSize={11.5} fontFamily="var(--font-mono)" textAnchor="middle" paintOrder="stroke" stroke="var(--bg)" strokeWidth={3}>
                    {Math.round(e.share * 100)}%
                  </text>}
                </g>
              );
            })}
          </svg>
        )}
        <canvas ref={arrival} aria-hidden className="pointer-events-none absolute inset-0 size-full" />

        {/* Layer panel (floating, glass) */}
        <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
          <Button variant="tinted" className="glass" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} aria-controls="map-layers">
            <Layers /> Layers
          </Button>
          {layersOpen && (
            <div id="map-layers" className="glass mt-2 w-64 origin-top-left p-3 animate-[pop-in_200ms_var(--ease-out)]">
              <div className="tag mb-2 px-1">Data</div>
              <ul className="grid gap-0.5">
                {TOGGLES.map((t) => (
                  <li key={t.id}>
                    <label className="press flex h-9 cursor-pointer items-center gap-3 px-2 text-[13.5px] text-ink-2 hover:bg-press hover:text-ink has-[:checked]:text-ink">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={on[t.id]}
                        onChange={(e) => {
                          sound.tick();
                          setOn((o) => ({ ...o, [t.id]: e.target.checked }));
                        }}
                      />
                      <span className="relative h-4 w-7 shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors peer-checked:bg-ink peer-checked:shadow-none peer-focus-visible:outline peer-focus-visible:outline-1 after:absolute after:left-[3px] after:top-[3px] after:size-2.5 after:bg-ink-3 after:transition-[transform,background-color] after:duration-300 after:ease-[var(--ease-out)] peer-checked:after:translate-x-3 peer-checked:after:bg-canvas" aria-hidden />
                      {t.label}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="tag mb-2 mt-3 px-1">Satellite · {snap.gibs?.layers[0]?.date}</div>
              <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Satellite layer">
                {SATS.filter((s) => s.id === "none" || snap.gibs?.layers.some((l) => l.id === s.id)).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={sat === s.id}
                    onClick={() => {
                      sound.tick();
                      setSat(s.id);
                    }}
                    className={cn("press h-8 px-2 text-left text-[12.5px]", sat === s.id ? "bg-ink text-canvas" : "text-ink-2 hover:bg-press hover:text-ink")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected city panel */}
        {panel ? (
          <aside className="glass absolute right-3 top-3 z-10 w-[min(320px,calc(100%-24px))] p-5 max-sm:bottom-[148px] max-sm:top-auto sm:right-4 sm:top-4" aria-label={`${sel.name} details`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <div className="tag">{lead === 0 ? "Now" : `${fmtDay(leadMs)} · ${fmtHour(leadMs)}`}</div>
                <h2 className="display mt-2 text-[2rem]">
                  <strong>{sel.name}.</strong>
                </h2>
              </div>
              <Button size="icon-sm" variant="ghost" className="-mr-2 -mt-1 ml-auto" aria-label="Close panel" onClick={() => setPanel(false)}>
                <X />
              </Button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-[3.5rem] text-ember-ink">{selPm == null ? "—" : Math.round(selPm)}</span>
              <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">µg/m³</span>
            </div>
            <AqiBadge pm={selPm} className="mt-1" />
            <div className="tag mb-3 mt-6 border-t border-line pt-4">Top incoming sources</div>
            {inflow.length ? (
              <ul className="grid gap-1.5">
                {inflow.map((e) => (
                  <li key={e.from.slug} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[13px]">
                    <span className="text-ink">
                      {e.from.name} <span className="mono text-[11px] text-ink-3">{Math.round(e.km)} km</span>
                    </span>
                    <span className="mono text-ink-2">{Math.round(e.share * 100)}%</span>
                    <span className="col-span-2 h-px overflow-hidden bg-press-2">
                      <span className="block h-full bg-ink" style={{ width: `${e.share * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-2">Today's winds bring nothing from the other 32 cities.</p>
            )}
            <p className="mt-3 text-[12.5px] text-ink-2">
              <span className="text-ember-ink">{upCount}</span> fires upwind, lit brighter on the map.
            </p>
            <AnimatedLink href={href("city", sel.slug)} className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.16em]">
              Open {sel.name}
            </AnimatedLink>
          </aside>
        ) : (
          <Button variant="tinted" className="glass absolute right-3 top-3 z-10 sm:right-4 sm:top-4" onClick={() => setPanel(true)}>
            {sel.name}
          </Button>
        )}

        {/* Time scrubber */}
        <div className="glass absolute inset-x-3 bottom-3 z-10 px-4 pb-3 pt-3 sm:inset-x-4 sm:bottom-4 sm:mr-12">
          <div className="flex items-center gap-3">
            <Button
              size="icon-sm"
              variant="primary"
              aria-label={playing ? "Pause" : "Play the forecast"}
              onClick={() => {
                sound.tick();
                setPlaying((p) => !p);
              }}
            >
              {playing ? <Pause /> : <Play className="translate-x-px" />}
            </Button>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink">
                  {fmtDay(leadMs)} · {fmtHour(leadMs)} <span className="mono ml-1 text-[11.5px] text-ink-2">{fmtLead(lead)}</span>
                </span>
                <button type="button" className={cn("press font-mono text-[10.5px] uppercase tracking-[0.14em]", lead === 0 ? "text-ink-3" : "text-ink-2 hover:text-ink")} onClick={() => setLead(0)} disabled={lead === 0}>
                  Back to now
                </button>
              </div>
              <div className="relative">
                <Slider label="Forecast hour, from 48 hours ago to 96 hours ahead" min={-48} max={96} value={lead} onValueChange={(v) => setLead(v)} />
                {/* the "now" marker */}
                <span aria-hidden className="pointer-events-none absolute -bottom-3 -translate-x-1/2 font-mono text-[10px] text-ink-3" style={{ left: `${(48 / 144) * 100}%` }}>
                  now
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 hidden items-center gap-2 sm:flex" aria-label="PM2.5 colour key">
            {AQI_CATEGORIES.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
                <span className="size-1.5" style={{ background: c.color }} aria-hidden />
                {c.short}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
              <span className="size-1.5 rounded-full bg-ember-hot" aria-hidden /> fire upwind
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

