"use client";

import { Activity, Droplets, Flame, Gauge, Layers, Pause, Play, Radar, Thermometer, TriangleAlert, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTip } from "@/components/charts/chart-tooltip";
import { Donut } from "@/components/charts/donut";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import type { Basemap } from "@/components/map/real-map";
import { AqiBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton, Slider, Switch } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import type { InflowLink } from "@/components/map/wind-flow";
import { useAppStore } from "@/hooks/use-app-store";
import type { LiveSnapshot } from "@/hooks/use-live";
import { AQI_CATEGORIES, categoryForPm, pmToAqi } from "@/lib/aqi";
import { at, citySeries, compass, fmtIst, national } from "@/lib/live";
import { cn } from "@/lib/utils";

const RealMap = dynamic(() => import("@/components/map/real-map").then((m) => m.RealMap), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-4" />,
});

export function LiveMapView() {
  return (
    <div className="pt-2">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-5">
        <h1 className="font-hero text-4xl text-fg sm:text-[44px]">
          Live Air Quality <span className="text-gradient">Map</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-fg-muted">Real basemap and NASA satellite imagery with live CAMS PM2.5, Open-Meteo winds and NASA FIRMS fire detections.</p>
      </motion.div>
      <LiveGate skeleton="h-[680px]">{(snap) => <MapBody snap={snap} />}</LiveGate>
    </div>
  );
}

function MapBody({ snap }: { snap: LiveSnapshot }) {
  const selected = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [layers, setLayers] = useState({ heat: true, fires: true, wind: true, links: true, labels: true, aod: false });
  const [inflow, setInflow] = useState<InflowLink[]>([]);
  const [lead, setLead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setLead((l) => (l >= 72 ? -24 : l + 3)), 700);
    return () => clearInterval(id);
  }, [playing]);

  const nat = national(snap);
  const series = useMemo(() => Object.fromEntries(snap.cities.map((c) => [c.slug, citySeries(c, now)])), [snap, now]);
  const mapCities = useMemo(
    () =>
      snap.cities.map((c) => {
        const p = lead === 0 ? null : at(series[c.slug], lead);
        return { slug: c.slug, name: c.name, lat: c.lat, lon: c.lon, pm25: p ? p.pm25 : c.pm25, wind: p ? p.wind : c.wind, windDir: p ? p.wind_dir : c.wind_dir };
      }),
    [snap, series, lead],
  );
  const sel = snap.cities.find((c) => c.slug === selected) ?? snap.cities[0];
  const selPm = mapCities.find((c) => c.slug === sel.slug)?.pm25 ?? sel.pm25 ?? 0;
  const ranked = [...mapCities].filter((c) => c.pm25 !== null).sort((a, b) => (b.pm25 ?? 0) - (a.pm25 ?? 0));
  const counts = AQI_CATEGORIES.map((cat) => ({ key: cat.key, label: cat.label, color: cat.color, value: mapCities.filter((c) => c.pm25 !== null && categoryForPm(c.pm25).key === cat.key).length })).filter((d) => d.value > 0);
  const chart = series[sel.slug].filter((p) => p.lead >= -48 && p.lead <= 96).map((p) => ({ ...p, pm: p.pm25 }));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini icon={<Activity />} tint="#f87171" label="National avg PM2.5 (CAMS)" value={`${Math.round(nat.avg)} µg/m³`} />
        <Mini icon={<TriangleAlert />} tint="#fb923c" label="Cities ≥ Poor (> 90)" value={`${mapCities.filter((c) => (c.pm25 ?? 0) > 90).length} / ${nat.count}`} />
        <Mini icon={<Radar />} tint="#34d399" label="Sources online" value={`${snap.sources.filter((s) => s.ok).length} / ${snap.sources.length}`} />
        <Mini icon={<Flame />} tint="#fbbf24" label="Fire detections · 24 h" value={snap.fires.total.toLocaleString("en-IN")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card padded={false} spotlight={false} className="relative h-[640px] overflow-hidden xl:col-span-8 2xl:col-span-9">
          <RealMap
            cities={mapCities}
            fires={layers.fires ? snap.fires.points : []}
            basemap={basemap}
            heat={layers.heat}
            showFires={layers.fires}
            wind={layers.wind}
            labels={layers.labels}
            aod={layers.aod}
            links={layers.wind && layers.links}
            onLinks={setInflow}
            selected={sel.slug}
            onSelect={setCity}
          />
          <div className="absolute left-4 top-4 z-10">
            <Segmented
              value={basemap}
              onChange={setBasemap}
              options={[
                { value: "satellite", label: "NASA satellite" },
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </div>
          <div className="absolute right-4 top-4 z-10 w-[250px] rounded-[24px] bg-slate-950/60 p-2 text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6),inset_0_0_0_0.75px_rgba(255,255,255,0.22)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[15px] font-semibold text-white">
              <Layers className="size-4 text-teal-300" /> Layers
            </div>
            {(
              [
                ["heat", "PM2.5 surface (CAMS)", "#ef4444"],
                ["fires", "Fires (NASA FIRMS)", "#f59e0b"],
                ["wind", "Wind flow (animated)", "#38bdf8"],
                ["links", "Who affects selected city", "#2dd4bf"],
                ["labels", "City labels", "#94a3b8"],
                ["aod", "Aerosol depth (MODIS)", "#a78bfa"],
              ] as const
            ).map(([key, label, color]) => (
              <label key={key} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] font-medium text-white/90 hover:bg-white/10", key === "links" && !layers.wind && "opacity-45")}>
                <span className="size-2 rounded-full" style={{ background: color }} />
                <span className="flex-1">{label}</span>
                <Switch checked={layers[key]} onChange={(v) => setLayers((l) => ({ ...l, [key]: v }))} color={color} aria-label={label} />
              </label>
            ))}
          </div>
          <div className="glass absolute inset-x-4 bottom-4 z-10 mx-auto flex max-w-[640px] items-center gap-3 rounded-full py-2 pl-2 pr-4">
            <button onClick={() => setPlaying((p) => !p)} className="glass-tint grid size-10 shrink-0 place-items-center rounded-full" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center justify-between text-[11px]">
                <span className="font-num font-semibold text-fg">{fmtIst(now + lead * 3_600_000, { weekday: "short", hour: "numeric", hour12: true })}</span>
                <span className={cn("font-semibold", lead <= 0 ? "text-emerald-300" : "text-sky-300")}>
                  {lead === 0 ? "Now · CAMS analysis" : lead < 0 ? `${lead} h · CAMS past` : `+${lead} h · CAMS forecast`}
                </span>
              </div>
              <Slider value={lead} onChange={setLead} min={-24} max={72} step={1} color={lead <= 0 ? "#34d399" : "#38bdf8"} aria-label="Time" />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:col-span-4 2xl:col-span-3">
          <Card>
            <AnimatePresence mode="wait">
              <motion.div key={sel.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-fg-muted">{sel.state}</div>
                    <div className="font-display text-xl font-semibold text-fg">{sel.name}</div>
                  </div>
                  <AqiBadge pm={selPm} />
                </div>
                <div className="font-num mt-2 text-4xl font-semibold text-fg">
                  {Math.round(selPm)}
                  <span className="ml-1 text-sm font-medium text-fg-muted">µg/m³ PM2.5</span>
                </div>
                <div className="text-xs text-fg-subtle">CPCB AQI ≈ {pmToAqi(selPm)} · CAMS modelled</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat icon={<Gauge className="size-3.5" />} label="PM10" value={sel.pm10?.toFixed(0) ?? "—"} />
                  <Stat icon={<Activity className="size-3.5" />} label="AOD" value={sel.aod?.toFixed(2) ?? "—"} />
                  <Stat icon={<Thermometer className="size-3.5" />} label="Temp" value={sel.temp !== null ? `${sel.temp.toFixed(0)}°` : "—"} />
                  <Stat icon={<Droplets className="size-3.5" />} label="RH" value={sel.rh !== null ? `${sel.rh.toFixed(0)}%` : "—"} />
                  <Stat icon={<Wind className="size-3.5" />} label="Wind" value={sel.wind !== null ? `${sel.wind.toFixed(1)} ${compass(sel.wind_dir)}` : "—"} />
                  <Stat icon={<Flame className="size-3.5" />} label="Fires 300km" value={String(sel.fires_300km ?? 0)} />
                </div>
                {sel.cpcb && (
                  <div className="mt-3 rounded-2xl bg-surface-sunken px-3 py-2 text-xs text-fg-muted">
                    CPCB measured, same month ({sel.cpcb.period.slice(0, 4)}): <b className="font-num text-fg">{sel.cpcb.pm25_mean.toFixed(0)} µg/m³</b> · {sel.cpcb.stations} stations
                  </div>
                )}
                {layers.wind && layers.links && (
                  <div className="mt-3 rounded-2xl bg-surface-sunken p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg">
                      <Wind className="size-3.5 text-teal-300" /> Air arriving in {sel.name} from
                    </div>
                    {inflow.length ? (
                      <div className="space-y-1.5">
                        {inflow.map((l) => (
                          <button key={l.from.slug} onClick={() => setCity(l.from.slug)} className="grid w-full grid-cols-[1fr_70px_36px] items-center gap-2 text-left text-xs">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="size-2 shrink-0 rounded-full" style={{ background: categoryForPm(l.from.pm25 ?? 0).color }} />
                              <span className="truncate text-fg">{l.from.name}</span>
                              <span className="font-num shrink-0 text-fg-subtle">{Math.round(l.km)} km</span>
                            </span>
                            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                              <span className="block h-full rounded-full bg-teal-300" style={{ width: `${l.share * 100}%` }} />
                            </span>
                            <span className="font-num text-right font-semibold text-fg">{Math.round(l.share * 100)}%</span>
                          </button>
                        ))}
                        <div className="pt-1 text-[10.5px] leading-snug text-fg-subtle">Share of upwind pollution load reaching {sel.name}: distance × wind alignment × wind speed × source PM2.5, from live Open-Meteo winds.</div>
                      </div>
                    ) : (
                      <div className="text-xs text-fg-muted">No nearby city is upwind right now — {sel.name}&apos;s air is mostly local.</div>
                    )}
                  </div>
                )}
                <Link href="/forecast" className="mt-3 inline-block text-xs font-semibold text-primary">
                  Open {sel.name} forecast →
                </Link>
              </motion.div>
            </AnimatePresence>
          </Card>
          <Card>
            <CardHeader title="Most polluted" subtitle={lead === 0 ? "Now" : `At ${lead > 0 ? "+" : ""}${lead} h`} />
            <div className="space-y-1">
              {ranked.slice(0, 6).map((c, i) => (
                <button key={c.slug} onClick={() => setCity(c.slug)} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-sunken", c.slug === sel.slug && "bg-surface-sunken")}>
                  <span className="grid size-6 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: categoryForPm(c.pm25 ?? 0).color }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-fg">{c.name}</span>
                  <span className="font-num text-sm font-semibold text-fg">{Math.round(c.pm25 ?? 0)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader title={`${sel.name} · PM2.5 timeline`} subtitle="CAMS: last 48 h and 4-day forecast (hourly)" />
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="lm-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5eead4" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#5eead4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" />
                <XAxis dataKey="ms" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(ms: number) => fmtIst(ms, { weekday: "short" })} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={({ active, payload }) => (active && payload?.length ? <ChartTip title={fmtIst((payload[0].payload as { ms: number }).ms, { weekday: "short", hour: "numeric", hour12: true })} rows={[{ label: "PM2.5", value: `${Math.round((payload[0].payload as { pm: number }).pm)} µg/m³`, color: "#5eead4" }]} /> : null)} />
                <ReferenceLine x={now} stroke="white" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "Now", fill: "white", fontSize: 11, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="pm" stroke="#5eead4" strokeWidth={2.4} fill="url(#lm-fill)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Cities by category" subtitle="CPCB PM2.5 classes" />
          <Donut data={counts} size={150} thickness={18} center={<div className="font-num text-2xl font-semibold text-fg">{nat.count}</div>} />
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Fire hotspots" subtitle="NASA FIRMS · last 24 h by state" />
          <div className="space-y-2">
            {snap.fires.regions.slice(0, 5).map((r) => (
              <div key={r.region}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-fg-muted">{r.region}</span>
                  <span className="font-num text-fg">{r.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-500" style={{ width: `${(r.count / Math.max(1, snap.fires.regions[0].count)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <SourceNote>
        Basemap: CARTO / OpenStreetMap or NASA GIBS VIIRS true colour ({new Date(now - 864e5).toISOString().slice(0, 10)}). PM2.5 and the timeline are CAMS (Copernicus) model values via
        Open-Meteo; winds from Open-Meteo; fires are NASA FIRMS VIIRS detections. Last sync {fmtIst(Date.parse(snap.updated_at), { hour: "numeric", minute: "2-digit", hour12: true })} IST.
      </SourceNote>
    </>
  );
}

function Mini({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full [&_svg]:size-[18px]" style={{ color: tint, background: `color-mix(in oklab, ${tint} 18%, transparent)` }}>
          {icon}
        </span>
        <div>
          <div className="font-num text-xl font-semibold text-fg">{value}</div>
          <div className="text-[11px] text-fg-muted">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunken px-1 py-2">
      <div className="flex items-center justify-center gap-1 text-[10px] text-fg-muted">
        {icon}
        {label}
      </div>
      <div className="font-num mt-0.5 text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}
