"use client";

import { Car, Construction, Droplets, Factory, Info, Lightbulb, RotateCcw, Sparkles, Thermometer, Timer, Users, Wheat, Wind } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend as RLegend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTip, Legend } from "@/components/charts/chart-tooltip";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import { PageHero } from "@/components/layout/page-hero";
import { AqiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CitySelect } from "@/components/ui/city-select";
import { AnimatedNumber, Skeleton, Slider, Tip } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { useAppStore } from "@/hooks/use-app-store";
import { useLive, type LiveSnapshot } from "@/hooks/use-live";
import { categoryForPm } from "@/lib/aqi";
import { getCity } from "@/lib/cities";
import { fmtPop } from "@/lib/format";
import { fmtIst, haversineKm } from "@/lib/live";
import { PRESETS, runScenario, ZERO_SCENARIO, type ScenarioInput, type ScenarioResult } from "@/lib/scenario";
import { cn } from "@/lib/utils";

const RealMap = dynamic(() => import("@/components/map/real-map").then((m) => m.RealMap), { ssr: false, loading: () => <Skeleton className="absolute inset-4" /> });

interface Lever {
  key: keyof ScenarioInput;
  label: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  help: string;
}

const LEVERS: Lever[] = [
  { key: "vehicles", label: "Vehicle emissions", icon: <Car />, min: -80, max: 80, step: 5, unit: "%", color: "#3b82f6", help: "Tailpipe + road traffic exhaust. ~27% of the local burden." },
  { key: "industry", label: "Industrial emissions", icon: <Factory />, min: -80, max: 80, step: 5, unit: "%", color: "#ef4444", help: "Stacks, brick kilns, power plants. ~22% of the local burden." },
  { key: "construction", label: "Construction & dust", icon: <Construction />, min: -80, max: 80, step: 5, unit: "%", color: "#f59e0b", help: "Construction sites and resuspended road dust. ~17%." },
  { key: "cropBurning", label: "Crop-residue burning", icon: <Wheat />, min: -100, max: 100, step: 5, unit: "%", color: "#16a34a", help: "Scales the fire share estimated from live NASA FIRMS upwind detections." },
  { key: "wind", label: "Wind speed", icon: <Wind />, min: -3, max: 3, step: 0.5, unit: " m/s", color: "#06b6d4", help: "More wind → better dispersion." },
  { key: "temperature", label: "Surface temperature", icon: <Thermometer />, min: -5, max: 5, step: 0.5, unit: " °C", color: "#f97316", help: "Warmer surface → deeper mixing layer." },
  { key: "humidity", label: "Humidity", icon: <Droplets />, min: -30, max: 30, step: 5, unit: " %RH", color: "#8b5cf6", help: "Humid air favours secondary aerosol formation." },
];

export function SimulatorView() {
  const slug = useAppStore((s) => s.city);
  const { snap } = useLive();
  const city = getCity(slug);
  const live = snap?.cities.find((c) => c.slug === slug);
  return (
    <div>
      <PageHero
        sky={{ pm: live?.pm25 ?? 80, landmark: city.landmark, seed: city.slug.length + 21 }}
        title={
          <>
            What-if <span className="text-gradient">Simulator</span>
          </>
        }
        subtitle="Change emissions and weather and see how the live CAMS forecast for a city would respond. A transparent sensitivity tool for policy conversations."
      >
        <CitySelect size="lg" />
      </PageHero>
      <LiveGate>{(s) => <Body key={slug} snap={s} slug={slug} />}</LiveGate>
    </div>
  );
}

function Body({ snap, slug }: { snap: LiveSnapshot; slug: string }) {
  const live = snap.cities.find((c) => c.slug === slug) ?? snap.cities[0];
  const [nowMs] = useState(() => Date.now());
  const [input, setInput] = useState<ScenarioInput>(PRESETS[4].input);
  const [preset, setPreset] = useState<string | null>("grap3");
  const [horizon, setHorizon] = useState<"24" | "48" | "72">("48");
  const [view, setView] = useState<"baseline" | "scenario">("scenario");
  const deferred = useDeferredValue(input);

  const result = useMemo(() => runScenario(live, nowMs, Number(horizon), deferred), [live, nowMs, horizon, deferred]);

  const leverImpact = useMemo(() => {
    const base = runScenario(live, nowMs, 24, ZERO_SCENARIO).summary.avgBaseline;
    return LEVERS.map((l) => {
      const one = { ...ZERO_SCENARIO, [l.key]: l.key === "wind" || l.key === "temperature" ? 2 : l.key === "humidity" ? -20 : -50 } as ScenarioInput;
      return { ...l, delta: runScenario(live, nowMs, 24, one).summary.avgScenario - base };
    }).sort((a, b) => a.delta - b.delta);
  }, [live, nowMs]);

  const mapCities = useMemo(
    () =>
      snap.cities.map((c) => {
        const k = view === "scenario" ? 1 - (1 - result.factor) * Math.exp(-haversineKm(c, live) / 140) : 1;
        return { slug: c.slug, name: c.name, lat: c.lat, lon: c.lon, pm25: c.pm25 !== null ? c.pm25 * k : null, wind: c.wind, windDir: c.wind_dir };
      }),
    [snap, live, result.factor, view],
  );

  const set = (k: keyof ScenarioInput, v: number) => {
    setPreset(null);
    setInput((s) => ({ ...s, [k]: v }));
  };
  const s = result.summary;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="glass flex h-12 items-center gap-2 rounded-full px-2">
          <Timer className="ml-2 size-4 text-primary" />
          <Segmented
            value={horizon}
            onChange={setHorizon}
            variant="primary"
            options={[
              { value: "24", label: "24 h" },
              { value: "48", label: "48 h" },
              { value: "72", label: "72 h" },
            ]}
          />
        </div>
        <div className="glass flex h-12 items-center gap-2 rounded-full px-4 text-[13px] text-fg">
          <Sparkles className="size-4 text-primary" />
          This scenario changes {live.name}&apos;s average by
          <b className={s.change < 0 ? "text-emerald-300" : "text-red-300"}>
            {s.change > 0 ? "+" : ""}
            {s.change.toFixed(0)}%
          </b>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader
            title="Adjust factors"
            subtitle="Relative to the live CAMS forecast"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setInput(ZERO_SCENARIO);
                  setPreset(null);
                }}
              >
                <RotateCcw /> Reset
              </Button>
            }
          />
          <div className="space-y-4">
            {LEVERS.map((l) => {
              const v = input[l.key];
              return (
                <div key={l.key}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-xl [&_svg]:size-4" style={{ color: l.color, background: `color-mix(in oklab, ${l.color} 16%, transparent)` }}>
                      {l.icon}
                    </span>
                    <span className="flex-1 text-[13px] font-medium text-fg">{l.label}</span>
                    <Tip content={l.help}>
                      <Info className="size-3.5 text-fg-subtle" />
                    </Tip>
                    <span className={cn("font-num min-w-[62px] rounded-lg px-2 py-0.5 text-center text-xs font-semibold", v === 0 ? "bg-surface-sunken text-fg-muted" : "bg-primary-soft text-primary")}>
                      {v === 0 ? "No change" : `${v > 0 ? "+" : ""}${v}${l.unit}`}
                    </span>
                  </div>
                  <Slider value={v} onChange={(x) => set(l.key, x)} min={l.min} max={l.max} step={l.step} color={l.color} aria-label={l.label} />
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold text-fg">Scenario presets</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Tip key={p.id} content={p.description}>
                  <button
                    onClick={() => {
                      setInput(p.input);
                      setPreset(p.id);
                    }}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition", preset === p.id ? "bg-white text-slate-900" : "bg-surface-sunken text-fg-muted hover:text-fg")}
                  >
                    {p.label}
                  </button>
                </Tip>
              ))}
            </div>
          </div>
        </Card>

        <Card padded={false} className="relative min-h-[520px] overflow-hidden xl:col-span-5">
          <RealMap basemap="satellite" cities={mapCities} fires={snap.fires.points} wind={false} labels={false} selected={live.slug} />
          <div className="glass pointer-events-none absolute left-4 top-4 z-10 rounded-2xl px-3 py-2">
            <div className="text-sm font-semibold text-fg">PM2.5 now · {view === "scenario" ? "with your scenario" : "live CAMS"}</div>
            <div className="text-[11px] text-fg-muted">Effect fades with distance from {live.name} (illustrative)</div>
          </div>
          <div className="absolute right-4 top-4 z-10">
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              variant="primary"
              options={[
                { value: "baseline", label: "Baseline" },
                { value: "scenario", label: "Scenario" },
              ]}
            />
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-1">
          <Card>
            <CardHeader title="Impact summary" subtitle={`Next ${horizon} h vs live baseline`} />
            <div className="grid grid-cols-2 gap-2.5">
              <ImpactTile label="PM2.5 avg" from={s.avgBaseline} to={s.avgScenario} unit="µg/m³" />
              <ImpactTile label="AQI avg" from={s.aqiBaseline} to={s.aqiScenario} />
              <ImpactTile label="People exposed" from={s.exposedBaseline} to={s.exposedScenario} format={(v) => fmtPop(v)} icon={<Users className="size-3.5" />} />
              <ImpactTile label="Hours ≥ Poor" from={s.unhealthyBaseline} to={s.unhealthyScenario} />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken px-3 py-2 text-xs">
              <span className="text-fg-muted">Category</span>
              <span className="flex items-center gap-1.5">
                <AqiBadge category={s.catBaseline} size="xs" /> → <AqiBadge category={s.catScenario} size="xs" />
              </span>
            </div>
          </Card>
          <Card>
            <CardHeader title="Best single lever" subtitle={`Avg change in ${live.name}, 24 h`} icon={<Lightbulb className="size-4" />} />
            <div className="space-y-2">
              {leverImpact.slice(0, 4).map((l, i) => (
                <motion.div key={l.key} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2.5 text-xs">
                  <span className="grid size-7 place-items-center rounded-lg [&_svg]:size-3.5" style={{ color: l.color, background: `color-mix(in oklab, ${l.color} 16%, transparent)` }}>
                    {l.icon}
                  </span>
                  <span className="flex-1 text-fg-muted">
                    {l.label}{" "}
                    <span className="text-fg-subtle">
                      ({l.key === "wind" || l.key === "temperature" ? "+2" : l.key === "humidity" ? "−20" : "−50"}
                      {l.unit.trim()})
                    </span>
                  </span>
                  <span className="font-num font-semibold text-emerald-300">{l.delta.toFixed(1)}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="PM2.5 forecast comparison" subtitle="Live CAMS baseline vs your scenario" action={<Badge tone="warn">sensitivity surrogate</Badge>} />
          <Legend
            className="mb-2"
            items={[
              { label: "Baseline (CAMS)", color: "#ef4444" },
              { label: "Your scenario", color: "var(--primary)" },
            ]}
          />
          <ScenarioChart series={result.series} />
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Source contributions" subtitle={`Average µg/m³ by sector · fire share ${Math.round(result.fireShare * 100)}% from ${live.fires_upwind ?? 0} upwind FIRMS fires`} />
          <SectorChart sectors={result.sectors} />
        </Card>
      </div>

      <SourceNote>
        <b className="text-fg">How this works.</b> The baseline is the live CAMS forecast for {live.name}. Sector shares of the local burden (vehicles 27%, industry 22%, dust &amp; construction 17%, other 34%) follow published
        Indian source-apportionment studies and scale with each emission lever; the fire share comes from the live NASA FIRMS upwind count; weather levers enter as dispersion multipliers. Once MW-AeroFusion-Net is trained,
        the same controls will perturb the model inputs and re-run it.
      </SourceNote>
    </>
  );
}

function ImpactTile({ label, from, to, unit, format, icon }: { label: string; from: number; to: number; unit?: string; format?: (v: number) => string; icon?: React.ReactNode }) {
  const change = from !== 0 ? ((to - from) / from) * 100 : 0;
  return (
    <div className="rounded-2xl bg-surface-sunken p-3">
      <div className="flex items-center gap-1 text-[11px] text-fg-muted">
        {icon}
        {label}
      </div>
      <div className="font-num mt-1 flex items-baseline gap-1 text-[15px] font-bold text-fg">
        <span className="text-fg-muted">{format ? format(from) : Math.round(from)}</span>
        <span className="text-fg-subtle">→</span>
        <span>{format ? format(to) : <AnimatedNumber value={Math.round(to)} />}</span>
        {unit && <span className="text-[9.5px] font-medium text-fg-subtle">{unit}</span>}
      </div>
      <div className={cn("font-num mt-1 text-[11px] font-semibold", change < -0.5 ? "text-emerald-300" : change > 0.5 ? "text-red-300" : "text-fg-subtle")}>
        {change < 0 ? "↓" : change > 0 ? "↑" : "→"} {Math.abs(change).toFixed(0)}%
      </div>
    </div>
  );
}

function ScenarioChart({ series }: { series: ScenarioResult["series"] }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 6" />
          <XAxis dataKey="ms" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(ms: number) => fmtIst(ms, { weekday: "short", hour: "numeric", hour12: true })} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as ScenarioResult["series"][number];
              return (
                <ChartTip
                  title={`+${d.lead} h · ${fmtIst(d.ms)}`}
                  rows={[
                    { label: "Baseline (CAMS)", value: Math.round(d.baseline), color: "#ef4444" },
                    { label: "Scenario", value: Math.round(d.scenario), color: "var(--primary)" },
                    { label: "Δ", value: `${Math.round(d.scenario - d.baseline)}` },
                  ]}
                  footer={<span>{categoryForPm(d.scenario).label} (scenario)</span>}
                />
              );
            }}
          />
          <Line type="monotone" dataKey="baseline" stroke="#ef4444" strokeWidth={2.2} dot={false} animationDuration={600} />
          <Line type="monotone" dataKey="scenario" stroke="var(--primary)" strokeWidth={2.8} dot={false} animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectorChart({ sectors }: { sectors: ScenarioResult["sectors"] }) {
  const data = sectors.map((s) => ({ name: s.label, Baseline: s.base, Scenario: s.scen }));
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }} barGap={3}>
          <CartesianGrid horizontal={false} strokeDasharray="3 6" />
          <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={118} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <ChartTip
                  title={d.name}
                  rows={[
                    { label: "Baseline", value: `${d.Baseline.toFixed(1)} µg/m³`, color: "rgba(255,255,255,0.5)" },
                    { label: "Scenario", value: `${d.Scenario.toFixed(1)} µg/m³`, color: "var(--primary)" },
                  ]}
                />
              );
            }}
          />
          <RLegend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Baseline" fill="rgba(255,255,255,0.45)" radius={[0, 6, 6, 0]} barSize={11} animationDuration={600} />
          <Bar dataKey="Scenario" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={11} animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
