"use client";

import { Activity, Clock, Network, RefreshCw, ScatterChart as ScatterIcon, Sigma } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartTip, Legend } from "@/components/charts/chart-tooltip";
import { AiChat, AiInsights, ModelPicker } from "@/components/live/ai-panels";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import { PageHero } from "@/components/layout/page-hero";
import { AqiBadge, Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CitySelect } from "@/components/ui/city-select";
import { Kpi } from "@/components/ui/kpi";
import { Stagger, StaggerItem } from "@/components/ui/reveal";
import { useAppStore } from "@/hooks/use-app-store";
import { useLive, type LiveCity, type LiveSnapshot } from "@/hooks/use-live";
import { categoryForPm } from "@/lib/aqi";
import { citySeries, fmtIst, mean, spearman, ventilation, type SeriesPoint } from "@/lib/live";
import { cn } from "@/lib/utils";

type FeatKey = "aod" | "dust" | "no2" | "co" | "temp" | "rh" | "wind" | "pblh" | "pressure" | "precip" | "fires_300km" | "frp_300km" | "fires_upwind" | "cpcb_baseline";

const FEATS: { key: FeatKey; label: string; unit: string; source: string }[] = [
  { key: "aod", label: "Aerosol optical depth", unit: "", source: "CAMS" },
  { key: "dust", label: "Dust", unit: "µg/m³", source: "CAMS" },
  { key: "no2", label: "NO₂", unit: "µg/m³", source: "CAMS" },
  { key: "co", label: "CO", unit: "µg/m³", source: "CAMS" },
  { key: "temp", label: "Temperature", unit: "°C", source: "Open-Meteo" },
  { key: "rh", label: "Humidity", unit: "%", source: "Open-Meteo" },
  { key: "wind", label: "Wind speed", unit: "m/s", source: "Open-Meteo" },
  { key: "pblh", label: "Mixing height", unit: "m", source: "Open-Meteo" },
  { key: "pressure", label: "Pressure", unit: "hPa", source: "Open-Meteo" },
  { key: "precip", label: "Rain", unit: "mm", source: "Open-Meteo" },
  { key: "fires_300km", label: "Fires within 300 km", unit: "", source: "NASA FIRMS" },
  { key: "frp_300km", label: "Fire radiative power", unit: "MW", source: "NASA FIRMS" },
  { key: "fires_upwind", label: "Fires upwind", unit: "", source: "NASA FIRMS" },
  { key: "cpcb_baseline", label: "Last year's CPCB level", unit: "µg/m³", source: "CPCB / XKDR" },
];

const TEMPORAL: { key: string; label: string; get: (p: SeriesPoint) => number | null }[] = [
  { key: "pblh", label: "Mixing height", get: (p) => p.pblh },
  { key: "vent", label: "Ventilation (wind × height)", get: (p) => ventilation(p) },
  { key: "wind", label: "Wind speed", get: (p) => p.wind },
  { key: "rh", label: "Humidity", get: (p) => p.rh },
  { key: "temp", label: "Temperature", get: (p) => p.temp },
  { key: "aod", label: "Aerosol optical depth", get: (p) => p.aod },
];

export function ExplainView() {
  const { snap, refresh, refreshing } = useLive();
  const [nonce, setNonce] = useState(0);
  const [aiModel, setAiModel] = useState("auto");
  const [busy, setBusy] = useState(false);
  const refreshAll = async () => {
    setBusy(true);
    try {
      await refresh();
      setNonce((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  const spinning = busy || refreshing;
  return (
    <div>
      <PageHero
        title={
          <>
            What drives <span className="text-gradient">PM2.5</span>
          </>
        }
        subtitle="Data-driven explanations measured on today's live data: which conditions move with PM2.5 across 33 cities, and hour by hour within a city."
      >
        <div className="flex flex-wrap items-center gap-3">
          <CitySelect size="lg" />
          <ModelPicker value={aiModel} onChange={setAiModel} />
          <button
            onClick={refreshAll}
            disabled={spinning}
            className="glass inline-flex h-14 items-center gap-2.5 rounded-full px-6 text-[15px] font-semibold text-fg transition hover:brightness-110 disabled:opacity-60"
          >
            <RefreshCw className={cn("size-5 text-primary", spinning && "animate-spin")} />
            {spinning ? "Refreshing data & AI…" : "Refresh everything"}
          </button>
          {snap && (
            <span className="text-xs text-fg-muted">
              Data as of {fmtIst(Date.parse(snap.updated_at), { hour: "numeric", minute: "2-digit", hour12: true })} IST
            </span>
          )}
        </div>
      </PageHero>
      <LiveGate>{(s) => <Body snap={s} nonce={nonce} aiModel={aiModel} />}</LiveGate>
    </div>
  );
}

function Body({ snap, nonce, aiModel }: { snap: LiveSnapshot; nonce: number; aiModel: string }) {
  const slug = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const [nowMs] = useState(() => Date.now());
  const c = snap.cities.find((x) => x.slug === slug) ?? snap.cities[0];
  const cities = snap.cities.filter((x) => x.pm25 !== null);
  const pts = useMemo(() => citySeries(c, nowMs), [c, nowMs]);

  const cross = useMemo(
    () =>
      FEATS.map((f) => ({ ...f, rho: spearman(cities.map((x) => x.pm25), cities.map((x) => x[f.key])) }))
        .filter((f): f is typeof f & { rho: number } => f.rho !== null && Number.isFinite(f.rho))
        .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho)),
    [cities],
  );
  const temporal = useMemo(
    () =>
      TEMPORAL.map((t) => ({ ...t, rho: spearman(pts.map((p) => p.pm25), pts.map(t.get)) }))
        .filter((t): t is typeof t & { rho: number } => t.rho !== null && Number.isFinite(t.rho))
        .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho)),
    [pts],
  );
  const diurnal = useMemo(() => {
    const hourIst = (ms: number) => (new Date(ms).getUTCHours() + 5 + (new Date(ms).getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
    return Array.from({ length: 24 }, (_, h) => {
      const at = pts.filter((p) => hourIst(p.ms) === h);
      return { h, pm25: mean(at.map((p) => p.pm25)), pblh: mean(at.map((p) => p.pblh)) };
    });
  }, [pts]);
  const profile = useMemo(
    () =>
      FEATS.map((f) => {
        const vals = cities.map((x) => x[f.key]).filter((v): v is number => v !== null);
        const m = mean(vals) ?? 0;
        const sd = Math.sqrt(mean(vals.map((v) => (v - m) ** 2)) ?? 0);
        const v = c[f.key];
        return { ...f, v, z: v !== null && sd > 0 ? (v - m) / sd : null };
      })
        .filter((p): p is typeof p & { z: number } => p.z !== null)
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z)),
    [cities, c],
  );

  const night = mean(diurnal.filter((d) => d.h >= 22 || d.h <= 5).map((d) => d.pm25));
  const noon = mean(diurnal.filter((d) => d.h >= 12 && d.h <= 16).map((d) => d.pm25));
  const ratio = night && noon ? night / noon : null;
  const topCross = cross[0];
  const topTemp = temporal[0];

  return (
    <>
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <Kpi icon={<Network />} label="Strongest cross-city driver" value={topCross ? topCross.rho.toFixed(2) : "—"} unit="ρ" tint="#38bdf8" footer={<span className="truncate">{topCross?.label ?? "—"}</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Activity />} label={`Strongest hourly driver · ${c.name}`} value={topTemp ? topTemp.rho.toFixed(2) : "—"} unit="ρ" tint="#a78bfa" footer={<span className="truncate">{topTemp?.label ?? "—"}</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Clock />} label="Night ÷ afternoon PM2.5" value={ratio ? Number(ratio.toFixed(2)) : "—"} digits={2} unit="×" tint="#fbbf24" footer={<span>{c.name}, IST hours</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Sigma />} label="Sample" value={cities.length} unit="cities" tint="#34d399" footer={<span>{pts.length} hourly steps per city</span>} />
        </StaggerItem>
      </Stagger>

      <div className="mt-4">
        <AiInsights key={aiModel} snap={snap} nonce={nonce} provider={aiModel} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Drivers across India, right now" subtitle="Spearman rank correlation between each live feature and PM2.5 across the 33 cities" icon={<Network className="size-4" />} />
          <RhoBars items={cross.map((f) => ({ key: f.key, label: f.label, sub: f.source, rho: f.rho }))} />
        </Card>
        <div className="xl:col-span-5">
          <AiChat city={c.name} provider={aiModel} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <Scatterplot cities={cities} selected={c.slug} onSelect={setCity} options={cross.slice(0, 8)} />
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title={`Hour-by-hour drivers · ${c.name}`} subtitle={`Correlation with PM2.5 over the ${pts.length}-hour live window (past 2 days + forecast)`} icon={<Activity className="size-4" />} />
          <RhoBars items={temporal.map((t) => ({ key: t.key, label: t.label, sub: "", rho: t.rho }))} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title={`Daily cycle · ${c.name}`} subtitle="Mean PM2.5 and mixing height by hour of day (IST) over the live window" icon={<Clock className="size-4" />} />
          <Diurnal data={diurnal} />
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader
            title={`What's unusual in ${c.name}`}
            subtitle="Each feature vs the 33-city average, in standard deviations"
            action={<AqiBadge pm={c.pm25 ?? 0} size="xs" />}
          />
          <ZBars items={profile.slice(0, 9)} />
        </Card>
      </div>

      <SourceNote>
        AI cards and chat are written by an LLM (Amazon Nova Micro on Bedrock, Groq fallback) from the live numbers below and can make mistakes; check against the charts. Correlation is not causation: these are associations on today&apos;s live data (CAMS, Open-Meteo, NASA FIRMS, CPCB/XKDR), shown so the drivers are transparent. Model attributions (SHAP, attention and wavelet
        bands) will be added here once MW-AeroFusion-Net is trained on the archived data. <Badge tone="warn">model training pending</Badge>
      </SourceNote>
    </>
  );
}

function RhoBars({ items }: { items: { key: string; label: string; sub: string; rho: number }[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={it.key} className="grid grid-cols-[150px_1fr_48px] items-center gap-3 sm:grid-cols-[190px_1fr_52px]">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-fg">{it.label}</div>
            {it.sub && <div className="text-[10px] text-fg-subtle">{it.sub}</div>}
          </div>
          <div className="relative h-3 rounded-full bg-surface-sunken">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className={cn("absolute inset-y-0 rounded-full", it.rho >= 0 ? "origin-left" : "origin-right")}
              style={{
                left: it.rho >= 0 ? "50%" : `${50 + it.rho * 50}%`,
                width: `${Math.abs(it.rho) * 50}%`,
                background: it.rho >= 0 ? "linear-gradient(90deg,#fb923c,#ef4444)" : "linear-gradient(90deg,#22d3ee,#38bdf8)",
              }}
            />
          </div>
          <div className={cn("font-num text-right text-xs font-semibold", it.rho >= 0 ? "text-orange-300" : "text-sky-300")}>
            {it.rho > 0 ? "+" : ""}
            {it.rho.toFixed(2)}
          </div>
        </div>
      ))}
      <div className="flex justify-between pt-1 text-[10px] text-fg-subtle">
        <span>← cleaner when higher</span>
        <span>dirtier when higher →</span>
      </div>
    </div>
  );
}

function ZBars({ items }: { items: { key: string; label: string; unit: string; v: number | null; z: number }[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => {
        const w = Math.min(1, Math.abs(it.z) / 3) * 50;
        return (
          <div key={it.key} className="grid grid-cols-[130px_1fr_76px] items-center gap-3">
            <div className="truncate text-[13px] font-medium text-fg">{it.label}</div>
            <div className="relative h-3 rounded-full bg-surface-sunken">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.04, duration: 0.6 }}
                className={cn("absolute inset-y-0 rounded-full", it.z >= 0 ? "origin-left" : "origin-right")}
                style={{ left: it.z >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: it.z >= 0 ? "#f59e0b" : "#818cf8" }}
              />
            </div>
            <div className="font-num text-right text-[11px] text-fg-muted">
              <b className="text-fg">
                {it.z > 0 ? "+" : ""}
                {it.z.toFixed(1)}σ
              </b>{" "}
              {it.v !== null ? Math.round(it.v * 10) / 10 : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Scatterplot({ cities, selected, onSelect, options }: { cities: LiveCity[]; selected: string; onSelect: (s: string) => void; options: { key: FeatKey; label: string; unit: string; rho: number }[] }) {
  const [key, setKey] = useState<FeatKey>(options[0]?.key ?? "pblh");
  const f = options.find((o) => o.key === key) ?? options[0];
  const data = cities.filter((x) => x[key] !== null).map((x) => ({ slug: x.slug, name: x.name, x: x[key] as number, y: x.pm25 as number }));
  return (
    <>
      <CardHeader title="PM2.5 vs a driver, every city" subtitle={f ? `${f.label} · ρ = ${f.rho.toFixed(2)} · click a dot to select the city` : ""} icon={<ScatterIcon className="size-4" />} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.key} onClick={() => setKey(o.key)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", o.key === key ? "bg-white text-slate-900" : "bg-surface-sunken text-fg-muted hover:text-fg")}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 6" />
            <XAxis type="number" dataKey="x" name={f?.label} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
            <YAxis type="number" dataKey="y" name="PM2.5" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <ZAxis range={[90, 90]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTip
                    title={d.name}
                    rows={[
                      { label: "PM2.5", value: `${Math.round(d.y)} µg/m³`, color: categoryForPm(d.y).color },
                      { label: f?.label ?? "", value: `${Math.round(d.x * 100) / 100} ${f?.unit ?? ""}` },
                    ]}
                  />
                );
              }}
            />
            <Scatter data={data} onClick={(d: unknown) => onSelect((d as { slug: string }).slug)} className="cursor-pointer">
              {data.map((d) => (
                <Cell key={d.slug} fill={categoryForPm(d.y).color} stroke={d.slug === selected ? "#fff" : "rgba(0,0,0,0.3)"} strokeWidth={d.slug === selected ? 3 : 1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Diurnal({ data }: { data: { h: number; pm25: number | null; pblh: number | null }[] }) {
  const label = (h: number) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);
  return (
    <>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            <XAxis dataKey="h" tickFormatter={label} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
            <YAxis yAxisId="p" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
            <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTip
                    title={`${label(d.h)} IST`}
                    rows={[
                      { label: "PM2.5", value: d.pm25 !== null ? `${Math.round(d.pm25)} µg/m³` : "—", color: categoryForPm(d.pm25 ?? 0).color },
                      { label: "Mixing height", value: d.pblh !== null ? `${Math.round(d.pblh)} m` : "—", color: "#a78bfa" },
                    ]}
                  />
                );
              }}
            />
            <Bar yAxisId="p" dataKey="pm25" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.h} fill={categoryForPm(d.pm25 ?? 0).color} fillOpacity={0.85} />
              ))}
            </Bar>
            <Line yAxisId="b" type="monotone" dataKey="pblh" stroke="#a78bfa" strokeWidth={2.4} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        className="mt-1"
        items={[
          { label: "PM2.5 (left, µg/m³)", color: "#eab308" },
          { label: "Mixing height (right, m)", color: "#a78bfa" },
        ]}
      />
    </>
  );
}
