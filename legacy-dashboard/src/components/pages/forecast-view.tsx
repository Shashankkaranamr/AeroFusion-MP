"use client";

import { ArrowDownRight, ArrowUpRight, CircleCheck, Droplets, Gauge, HeartPulse, Info, MountainSnow, Navigation, Sun, Thermometer, TriangleAlert, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTip, Legend } from "@/components/charts/chart-tooltip";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import { PageHero } from "@/components/layout/page-hero";
import { AqiBadge, Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CitySelect } from "@/components/ui/city-select";
import { Kpi } from "@/components/ui/kpi";
import { Delta } from "@/components/ui/primitives";
import { Stagger, StaggerItem } from "@/components/ui/reveal";
import { Segmented } from "@/components/ui/segmented";
import { useAppStore } from "@/hooks/use-app-store";
import { useLive, type LiveCity } from "@/hooks/use-live";
import { AQI_CATEGORIES, categoryForAqi, categoryForPm, NAAQS_PM25_24H, pmToAqi } from "@/lib/aqi";
import { getCity } from "@/lib/cities";
import { at, bestWindow, citySeries, compass, fmtIst, fmtPeriod, liveInsights, ventilation, window, type SeriesPoint } from "@/lib/live";
import { cn } from "@/lib/utils";

type Horizon = "24" | "48" | "96";

export function ForecastView() {
  const slug = useAppStore((s) => s.city);
  const { snap } = useLive();
  const live = snap?.cities.find((c) => c.slug === slug);
  const city = getCity(slug);
  const [horizon, setHorizon] = useState<Horizon>("48");
  const pm = live?.pm25 ?? null;
  return (
    <div>
      <PageHero
        sky={{ pm: pm ?? 60, landmark: city.landmark, seed: city.slug.length + 3 }}
        eyebrow={
          <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span>Forecast</span>
            <span className="text-fg-subtle">/</span>
            <span className="text-fg">{city.name}</span>
          </div>
        }
        title={
          <>
            City <span className="text-gradient">Forecast</span>
          </>
        }
        subtitle="Hour-by-hour PM2.5 from the Copernicus CAMS model with live Open-Meteo weather. AeroFusion's own model will be overlaid once trained."
        aside={
          <div className="glass flex items-center gap-5 rounded-3xl px-5 py-4">
            <HeroStat icon={<Sun className="size-6 text-amber-400" />} value={live?.temp != null ? `${Math.round(live.temp)}°C` : "—"} label={live ? skyLabel(live.rh ?? 0, pm ?? 0) : "…"} />
            <div className="h-10 w-px bg-border-strong" />
            <HeroStat icon={<Droplets className="size-5 text-sky-400" />} value={live?.rh != null ? `${Math.round(live.rh)}%` : "—"} label="Humidity" />
            <div className="h-10 w-px bg-border-strong" />
            <HeroStat icon={<Wind className="size-5 text-teal-400" />} value={live?.wind != null ? `${live.wind.toFixed(1)} m/s` : "—"} label="Wind" />
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <CitySelect size="lg" />
          <Segmented
            value={horizon}
            onChange={setHorizon}
            variant="primary"
            options={[
              { value: "24", label: "24 Hours" },
              { value: "48", label: "48 Hours" },
              { value: "96", label: "4 Days" },
            ]}
          />
        </div>
      </PageHero>
      <LiveGate>
        {(s) => {
          const c = s.cities.find((x) => x.slug === slug) ?? s.cities[0];
          return <Body key={c.slug + s.updated_at} c={c} h={Number(horizon)} />;
        }}
      </LiveGate>
    </div>
  );
}

function Body({ c, h }: { c: LiveCity; h: number }) {
  const [nowMs] = useState(() => Date.now());
  const [metric, setMetric] = useState<"pm" | "aqi">("pm");
  const pts = useMemo(() => citySeries(c, nowMs), [c, nowMs]);
  const now = at(pts, 0);
  const prev = at(pts, -24);
  const nowPm = now?.pm25 ?? c.pm25 ?? 0;
  const cat = categoryForPm(nowPm);
  const view = window(pts, -24, h);
  const next24 = window(pts, 0, 24);
  const windows = bestWindow(window(pts, 1, 24), 3);
  const insights = liveInsights(c, pts);
  const vent = now ? ventilation(now) : null;

  return (
    <>
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StaggerItem className="col-span-2 md:col-span-1">
          <Kpi
            icon={<Gauge />}
            label="PM2.5 now"
            value={Math.round(nowPm)}
            unit="µg/m³"
            tint={cat.color}
            footer={
              <>
                <AqiBadge pm={nowPm} />
                {prev?.pm25 ? <Delta value={((nowPm - prev.pm25) / prev.pm25) * 100} /> : null}
                <span>vs 24 h</span>
              </>
            }
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<HeartPulse />} label="AQI · CPCB scale" value={pmToAqi(nowPm)} tint={cat.color} footer={<span className="truncate">PM2.5 sub-index</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            icon={<Thermometer />}
            label="Temperature"
            value={Number((c.temp ?? 0).toFixed(1))}
            digits={1}
            unit="°C"
            tint="#f59e0b"
            footer={now?.temp != null && prev?.temp != null ? <WeatherDelta now={now.temp} prev={prev.temp} unit="°C" /> : null}
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            icon={<MountainSnow />}
            label="Mixing height"
            value={Math.round(c.pblh ?? 0)}
            unit="m"
            tint="#a78bfa"
            footer={<span>{vent !== null ? `ventilation ${Math.round(vent).toLocaleString("en-IN")} m²/s` : "boundary layer"}</span>}
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            icon={<Wind />}
            label="Wind speed"
            value={Number((c.wind ?? 0).toFixed(1))}
            digits={1}
            unit="m/s"
            tint="#14b8a6"
            footer={
              <span className="inline-flex items-center gap-1.5">
                <Navigation className="size-3.5 text-fg-muted" style={{ transform: `rotate(${((c.wind_dir ?? 0) + 180) % 360}deg)` }} />
                from {compass(c.wind_dir)} · {(c.wind ?? 0) < 1.5 ? "stagnant" : (c.wind ?? 0) < 3.5 ? "light" : "breezy"}
              </span>
            }
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title={metric === "pm" ? "PM2.5 forecast" : "AQI forecast"}
            subtitle={`CAMS (Copernicus) · past 24 h analysis + ${h} h forecast`}
            action={
              <Segmented
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "pm", label: "PM2.5" },
                  { value: "aqi", label: "AQI" },
                ]}
              />
            }
          />
          <Legend
            className="mb-2"
            items={[
              { label: "CAMS forecast", color: "var(--primary)" },
              { label: "CAMS analysis (past)", color: "var(--fg)" },
              ...(c.cpcb && metric === "pm" ? [{ label: `CPCB monitors, ${fmtPeriod(c.cpcb.period)}`, color: "#fbbf24", dashed: true }] : []),
            ]}
          />
          <PmChart pts={view} nowMs={nowMs} metric={metric} baseline={metric === "pm" ? (c.cpcb?.pm25_mean ?? null) : null} />
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Air quality timeline" subtitle="Hourly CPCB category, next 24 hours" icon={<Info className="size-4" />} />
          <CategoryTimeline series={next24} />
          <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {AQI_CATEGORIES.map((k) => (
              <div key={k.key} className="rounded-xl bg-surface-sunken px-2 py-1.5 text-center">
                <div className="mx-auto mb-1 h-1.5 w-6 rounded-full" style={{ background: k.color }} />
                <div className="text-[10px] font-semibold text-fg">{k.short}</div>
                <div className="font-num text-[9.5px] text-fg-subtle">
                  {k.pm[0]}–{k.key === "severe" ? "∞" : k.pm[1]}
                </div>
              </div>
            ))}
          </div>
          {windows.best && windows.worst && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <WindowCard tone="good" title="Best 3 h to be outside" start={windows.best.start.ms} end={windows.best.end.ms} mean={windows.best.mean} />
              <WindowCard tone="bad" title="Avoid" start={windows.worst.start.ms} end={windows.worst.end.ms} mean={windows.worst.mean} />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4 !px-0 !pb-3">
        <div className="px-5 sm:px-6">
          <CardHeader title={h > 48 ? "Day by day" : "Hour by hour"} subtitle={h > 48 ? "Daily range and mean category (CAMS)" : "PM2.5 · wind · temperature, scroll for the full horizon →"} />
        </div>
        {h > 48 ? <DailyStrip series={window(pts, 1, h)} /> : <HourStrip series={window(pts, 0, h)} />}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Why it changes: ventilation" subtitle="Wind × mixing height (Open-Meteo). Below 6,000 m²/s pollution gets trapped." action={<Badge tone="primary">live</Badge>} />
          <VentChart pts={view} />
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Key insights" subtitle="Computed from live CAMS, weather, FIRMS & CPCB data" icon={<Gauge className="size-4" />} />
          <div className="space-y-2.5">
            {insights.map((ins, i) => (
              <motion.div key={ins.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }} className="flex gap-3 rounded-2xl bg-surface-sunken p-3">
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    ins.tone === "up" && "bg-red-500/15 text-red-300",
                    ins.tone === "down" && "bg-emerald-500/15 text-emerald-300",
                    ins.tone === "warn" && "bg-amber-500/15 text-amber-300",
                    ins.tone === "info" && "bg-sky-500/15 text-sky-300",
                  )}
                >
                  {ins.tone === "up" ? <ArrowUpRight className="size-4" /> : ins.tone === "down" ? <ArrowDownRight className="size-4" /> : ins.tone === "warn" ? <TriangleAlert className="size-4" /> : <Info className="size-4" />}
                </div>
                <div>
                  <div className="text-[13px] font-semibold leading-snug text-fg">{ins.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-fg-muted">{ins.body}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Health advice" subtitle="Based on CPCB category" icon={<HeartPulse className="size-4" />} />
          <AnimatePresence mode="wait">
            <motion.div key={cat.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="rounded-2xl p-3.5" style={{ background: `color-mix(in oklab, ${cat.color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${cat.color} 28%, transparent)` }}>
                <div className="text-xs font-semibold" style={{ color: cat.color }}>
                  Current risk: {cat.label}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-fg-muted">{cat.impact}</div>
              </div>
              <ul className="mt-3 space-y-2">
                {cat.advice.map((a) => (
                  <li key={a} className="flex items-start gap-2.5 text-[13px] text-fg">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    {a}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
      <SourceNote>
        Forecast values are the CAMS global atmospheric-composition model (Copernicus/ECMWF, ~40 km) served by Open-Meteo, not ground measurements. Weather: Open-Meteo. Fires: NASA FIRMS VIIRS. Baseline: CPCB monitors via the XKDR
        India Air Quality archive. AeroFusion&apos;s own forecasts will appear here once the model is trained on this data.
      </SourceNote>
    </>
  );
}

function PmChart({ pts, nowMs, metric, baseline }: { pts: SeriesPoint[]; nowMs: number; metric: "pm" | "aqi"; baseline: number | null }) {
  const f = metric === "aqi" ? pmToAqi : (v: number) => v;
  const data = pts.map((p) => ({
    ms: p.ms,
    lead: p.lead,
    past: p.lead <= 0 && p.pm25 !== null ? f(p.pm25) : null,
    fc: p.lead >= 0 && p.pm25 !== null ? f(p.pm25) : null,
    pm10: p.pm10,
  }));
  const vals = data.map((d) => d.past ?? d.fc ?? 0);
  const yMax = Math.max(metric === "aqi" ? 120 : 70, Math.ceil((Math.max(...vals, baseline ?? 0) * 1.15) / 25) * 25);
  const cats = AQI_CATEGORIES.map((k) => ({ ...k, lo: metric === "aqi" ? k.aqi[0] : k.pm[0], hi: metric === "aqi" ? k.aqi[1] : k.pm[1] }));
  const unit = metric === "aqi" ? "" : " µg/m³";
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="fc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {cats.map((k) => (k.lo < yMax ? <ReferenceArea key={k.key} y1={k.lo} y2={Math.min(k.hi, yMax)} fill={k.color} fillOpacity={0.06} strokeOpacity={0} ifOverflow="hidden" /> : null))}
          <CartesianGrid vertical={false} strokeDasharray="3 6" />
          <XAxis dataKey="ms" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={(ms: number) => fmtIst(ms, { weekday: "short", hour: "numeric", hour12: true })} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={48} tickMargin={8} />
          <YAxis domain={[0, yMax]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
          <Tooltip
            cursor={{ stroke: "var(--fg-subtle)", strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              const v = d.fc ?? d.past ?? 0;
              const k = metric === "aqi" ? categoryForAqi(v) : categoryForPm(v);
              return (
                <ChartTip
                  title={`${fmtIst(d.ms, { day: "numeric", month: "short", hour: "numeric", hour12: true })} (${d.lead > 0 ? "+" : ""}${d.lead} h)`}
                  rows={[
                    { label: d.lead > 0 ? "CAMS forecast" : "CAMS analysis", value: `${Math.round(v)}${unit}`, color: d.lead > 0 ? "var(--primary)" : "var(--fg)" },
                    ...(d.pm10 !== null && metric === "pm" ? [{ label: "PM10", value: `${Math.round(d.pm10)}${unit}` }] : []),
                  ]}
                  footer={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: k.color }} /> {k.label}
                    </span>
                  }
                />
              );
            }}
          />
          <Area type="monotone" dataKey="fc" stroke="var(--primary)" strokeWidth={2.6} fill="url(#fc-fill)" dot={false} connectNulls={false} animationDuration={900} />
          <Line type="monotone" dataKey="past" stroke="var(--fg)" strokeOpacity={0.8} strokeWidth={2} dot={false} animationDuration={700} />
          {baseline !== null && <ReferenceLine y={baseline} stroke="#fbbf24" strokeDasharray="6 5" strokeOpacity={0.9} />}
          {metric === "pm" && <ReferenceLine y={NAAQS_PM25_24H} stroke="var(--fg-subtle)" strokeDasharray="2 4" label={{ value: "NAAQS 60", position: "insideTopLeft", fill: "var(--fg-muted)", fontSize: 10 }} />}
          <ReferenceLine x={nowMs} stroke="var(--fg)" strokeOpacity={0.4} strokeDasharray="3 4" label={{ value: "Now", position: "insideTopRight", fill: "var(--fg-muted)", fontSize: 11 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function VentChart({ pts }: { pts: SeriesPoint[] }) {
  const data = pts.map((p) => ({ ms: p.ms, vent: ventilation(p), pm25: p.pm25 }));
  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="vent-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 6" />
          <XAxis dataKey="ms" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(ms: number) => fmtIst(ms)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
          <YAxis yAxisId="v" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <ChartTip
                  title={fmtIst(d.ms, { day: "numeric", month: "short", hour: "numeric", hour12: true })}
                  rows={[
                    { label: "Ventilation", value: d.vent !== null ? `${Math.round(d.vent).toLocaleString("en-IN")} m²/s` : "—", color: "#38bdf8" },
                    { label: "PM2.5", value: d.pm25 !== null ? `${Math.round(d.pm25)} µg/m³` : "—", color: "var(--primary)" },
                  ]}
                />
              );
            }}
          />
          <ReferenceArea yAxisId="v" y1={0} y2={6000} fill="#f87171" fillOpacity={0.08} strokeOpacity={0} />
          <Area yAxisId="v" type="monotone" dataKey="vent" stroke="#38bdf8" strokeWidth={1.8} fill="url(#vent-fill)" dot={false} />
          <Line yAxisId="p" type="monotone" dataKey="pm25" stroke="var(--primary)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <Legend
        className="mt-1"
        items={[
          { label: "Ventilation index (left)", color: "#38bdf8" },
          { label: "PM2.5 (right)", color: "var(--primary)" },
          { label: "Poor dispersion < 6k", color: "#f87171", band: true },
        ]}
      />
    </div>
  );
}

function skyLabel(rh: number, pm: number) {
  if (pm > 120) return "Smoggy";
  if (pm > 60) return "Hazy";
  if (rh > 80) return "Humid";
  return "Clear sky";
}

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <div className="font-num text-lg font-bold leading-none text-fg">{value}</div>
        <div className="mt-1 text-[11px] text-fg-muted">{label}</div>
      </div>
    </div>
  );
}

function WeatherDelta({ now, prev, unit }: { now: number; prev: number; unit: string }) {
  const d = now - prev;
  return (
    <span className="font-num">
      {d >= 0 ? "↑" : "↓"} {Math.abs(d).toFixed(1)}
      {unit} vs yesterday
    </span>
  );
}

function CategoryTimeline({ series }: { series: SeriesPoint[] }) {
  const f = series.filter((p) => p.lead > 0 && p.pm25 !== null);
  const max = Math.max(...f.map((p) => p.pm25 ?? 0), 1);
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {f.map((p, i) => {
          const k = categoryForPm(p.pm25 ?? 0);
          return (
            <motion.div
              key={p.ms}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.018, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex-1 origin-bottom rounded-t-[5px]"
              style={{ height: `${Math.max(8, ((p.pm25 ?? 0) / max) * 100)}%`, background: `linear-gradient(to top, color-mix(in oklab, ${k.color} 55%, transparent), ${k.color})` }}
            >
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/80 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                {fmtIst(p.ms)} · {Math.round(p.pm25 ?? 0)}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-fg-subtle">
        <span>Now</span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
    </div>
  );
}

function WindowCard({ tone, title, start, end, mean }: { tone: "good" | "bad"; title: string; start: number; end: number; mean: number }) {
  const k = categoryForPm(mean);
  return (
    <div className={cn("rounded-2xl p-3", tone === "good" ? "bg-emerald-500/12" : "bg-red-500/12")}>
      <div className={cn("text-[11px] font-semibold", tone === "good" ? "text-emerald-300" : "text-red-300")}>{title}</div>
      <div className="mt-1 text-sm font-bold text-fg">
        {fmtIst(start)} – {fmtIst(end + 3_600_000)}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
        <span className="size-1.5 rounded-full" style={{ background: k.color }} />~{Math.round(mean)} µg/m³
      </div>
    </div>
  );
}

function HourStrip({ series }: { series: SeriesPoint[] }) {
  return (
    <div className="scrollbar-thin flex gap-2.5 overflow-x-auto px-5 pb-3 sm:px-6">
      {series.map((p, i) => {
        const k = categoryForPm(p.pm25 ?? 0);
        return (
          <motion.div
            key={p.ms}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 20) * 0.02 }}
            className={cn("flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-surface-sunken px-2 py-3 transition hover:-translate-y-0.5", p.lead === 0 && "bg-primary-soft ring-1 ring-primary/40")}
          >
            <div className="text-[11px] font-medium text-fg-muted">{p.lead === 0 ? "Now" : fmtIst(p.ms)}</div>
            <div className="relative grid size-9 place-items-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={k.color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${Math.min(1, (p.pm25 ?? 0) / 250) * 94.2} 94.2`} />
              </svg>
              <span className="font-num text-[11px] font-bold text-fg">{Math.round(p.pm25 ?? 0)}</span>
            </div>
            <div className="text-[10px] font-semibold" style={{ color: k.color }}>
              {k.short}
            </div>
            <div className="font-num flex items-center gap-1 text-[10px] text-fg-subtle">
              <Wind className="size-3" />
              {(p.wind ?? 0).toFixed(1)}
            </div>
            <div className="font-num text-[10px] text-fg-subtle">{Math.round(p.temp ?? 0)}°</div>
          </motion.div>
        );
      })}
    </div>
  );
}

function DailyStrip({ series }: { series: SeriesPoint[] }) {
  const byDay = new Map<string, SeriesPoint[]>();
  for (const p of series) {
    if (p.pm25 === null) continue;
    const key = fmtIst(p.ms, { year: "numeric", month: "2-digit", day: "2-digit" });
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const days = [...byDay.values()]
    .filter((d) => d.length >= 6)
    .map((d) => {
      const v = d.map((p) => p.pm25 ?? 0);
      return { ms: d[0].ms, n: d.length, min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length };
    });
  const gmax = Math.max(...days.map((d) => d.max), 1);
  return (
    <div className="grid gap-2 px-5 pb-3 sm:px-6">
      {days.map((d, i) => {
        const k = categoryForPm(d.mean);
        return (
          <motion.div
            key={d.ms}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="grid grid-cols-[96px_1fr_88px] items-center gap-3 rounded-xl px-2 py-1.5 sm:grid-cols-[150px_1fr_140px]"
          >
            <div className="text-sm font-medium text-fg">
              {fmtIst(d.ms, { weekday: "short" })} <span className="text-xs text-fg-subtle">{fmtIst(d.ms, { day: "numeric", month: "short" })}</span>
              {d.n < 24 && <span className="ml-1 text-[10px] text-fg-subtle">({d.n} h)</span>}
            </div>
            <div className="relative h-2.5 rounded-full bg-surface-sunken">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.6 }}
                className="absolute inset-y-0 origin-left rounded-full"
                style={{
                  left: `${(d.min / gmax) * 100}%`,
                  width: `${Math.max(2, ((d.max - d.min) / gmax) * 100)}%`,
                  background: `linear-gradient(90deg, ${categoryForPm(d.min).color}, ${categoryForPm(d.max).color})`,
                }}
              />
            </div>
            <div className="font-num flex items-center justify-end gap-2 text-xs text-fg-muted">
              {Math.round(d.min)}–{Math.round(d.max)} · avg {Math.round(d.mean)}
              <span className="size-2 rounded-full" style={{ background: k.color }} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
