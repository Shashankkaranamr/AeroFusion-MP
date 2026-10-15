"use client";

import { BarChart3, CalendarRange, Download, FileJson, FileSpreadsheet, FileText, Gauge, Printer, ShieldAlert, TrendingDown, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTip, Legend } from "@/components/charts/chart-tooltip";
import { Sparkline } from "@/components/charts/sparkline";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import { GlassNote, PageHero } from "@/components/layout/page-hero";
import { AqiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CitySelect } from "@/components/ui/city-select";
import { Kpi } from "@/components/ui/kpi";
import { Delta, Skeleton } from "@/components/ui/primitives";
import { Stagger, StaggerItem } from "@/components/ui/reveal";
import { PillTabs } from "@/components/ui/segmented";
import { useAppStore } from "@/hooks/use-app-store";
import { useApi, useLive, type LiveSnapshot } from "@/hooks/use-live";
import { categoryForPm, NAAQS_PM25_24H, pmColor, WHO_PM25_24H } from "@/lib/aqi";
import { CITY_BY_SLUG } from "@/lib/cities";
import { fmtIst, fmtPeriod, mean, national, type AllHistory, type CityHistory } from "@/lib/live";
import { cn, downloadFile } from "@/lib/utils";

type Tab = "overview" | "city" | "trends" | "downloads";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Row {
  slug: string;
  name: string;
  state: string;
  now: number | null;
  y2024: number | null;
  y2022: number | null;
  change: number | null;
  months: { month: string; pm25: number }[];
}

function buildRows(snap: LiveSnapshot, hist: AllHistory): Row[] {
  return snap.cities
    .map((c) => {
      const months = hist.cities[c.slug] ?? [];
      const yr = (y: string) => mean(months.filter((m) => m.month.startsWith(y)).map((m) => m.pm25));
      const y2024 = yr("2024");
      const y2022 = yr("2022");
      return { slug: c.slug, name: c.name, state: c.state, now: c.pm25, y2024, y2022, change: y2024 !== null && y2022 ? ((y2024 - y2022) / y2022) * 100 : null, months };
    })
    .sort((a, b) => (b.y2024 ?? -1) - (a.y2024 ?? -1));
}

export function ReportsView() {
  const [tab, setTab] = useState<Tab>("overview");
  const { snap } = useLive();
  const hist = useApi<AllHistory>(snap ? "/api/history" : null);
  const rows = useMemo(() => (snap && hist.data ? buildRows(snap, hist.data) : null), [snap, hist.data]);
  const withData = rows?.filter((r) => r.y2024 !== null) ?? [];
  const avg2024 = mean(withData.map((r) => r.y2024));
  const improving = rows?.filter((r) => (r.change ?? 0) < 0).length;
  const aboveNaaqs = withData.filter((r) => (r.y2024 ?? 0) > 40).length;
  const nat = snap ? national(snap) : null;

  return (
    <div>
      <PageHero
        sky={{ pm: avg2024 ?? 60, landmark: "victoria", seed: 17 }}
        title={
          <>
            Reports & <span className="text-gradient">Insights</span>
          </>
        }
        subtitle="Measured CPCB history (2022–2024) side by side with today's live levels, ready to export."
        aside={<GlassNote icon={<BarChart3 />}>Every number comes from CPCB monitors or the live CAMS feed.</GlassNote>}
      >
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "city", label: "City reports" },
            { value: "trends", label: "Trend analysis" },
            { value: "downloads", label: "Download reports" },
          ]}
        />
      </PageHero>

      <LiveGate>
        {(s) => (
          <>
            <Stagger className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StaggerItem>
                <Kpi icon={<Gauge />} label="National average now" value={nat ? Math.round(nat.avg) : undefined} unit="µg/m³" tint="#38bdf8" footer={<span>CAMS live · {nat?.count} cities</span>} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={<CalendarRange />} label="2024 annual mean (measured)" value={avg2024 !== null ? Math.round(avg2024) : undefined} unit="µg/m³" tint="#f59e0b" footer={<span>{withData.length} cities with CPCB monitors</span>} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={<TrendingDown />} label="Cleaner in 2024 than 2022" value={improving} unit={`/ ${withData.length}`} tint="#10b981" footer={<span>annual mean, CPCB</span>} />
              </StaggerItem>
              <StaggerItem>
                <Kpi icon={<ShieldAlert />} label="Above annual NAAQS (40)" value={rows ? aboveNaaqs : undefined} unit={`/ ${withData.length}`} tint="#ef4444" footer={<span>2024, WHO guideline is 5</span>} />
              </StaggerItem>
            </Stagger>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="mt-4">
                {hist.error ? (
                  <Card className="text-sm text-amber-200">CPCB archive unavailable: {hist.error}</Card>
                ) : !rows || !hist.data ? (
                  <Skeleton className="h-96 !rounded-[28px]" />
                ) : (
                  <>
                    {tab === "overview" && <Overview rows={rows} />}
                    {tab === "city" && <CityReport snap={s} />}
                    {tab === "trends" && <Trends rows={rows} />}
                    {tab === "downloads" && <Downloads snap={s} rows={rows} hist={hist.data} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            <SourceNote>
              Historical values: measured PM2.5 from CPCB CAAQMS monitors within 30 km of each city, via the XKDR India Air Quality archive (monthly means of station means). Live values: CAMS model via Open-Meteo. Annual NAAQS for
              PM2.5 is 40 µg/m³ (24-h: {NAAQS_PM25_24H}); WHO annual guideline 5 µg/m³ (24-h: {WHO_PM25_24H}).
            </SourceNote>
          </>
        )}
      </LiveGate>
    </div>
  );
}

function Overview({ rows }: { rows: Row[] }) {
  const setCity = useAppStore((s) => s.setCity);
  const top = rows.filter((r) => r.y2024 !== null).slice(0, 10);
  const max = Math.max(...top.map((r) => r.y2024 ?? 0), 1);
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <CardHeader title="Top 10 most polluted" subtitle="2024 annual mean, CPCB measured (µg/m³)" />
        <div className="space-y-2">
          {top.map((r, i) => (
            <button key={r.slug} onClick={() => setCity(r.slug)} className="grid w-full grid-cols-[18px_96px_1fr_36px] items-center gap-2 text-left">
              <span className="text-[11px] font-semibold text-fg-subtle">{i + 1}</span>
              <span className="truncate text-[13px] font-medium text-fg">{r.name}</span>
              <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                <motion.div initial={{ width: 0 }} animate={{ width: `${((r.y2024 ?? 0) / max) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.6 }} className="h-full rounded-full" style={{ background: categoryForPm(r.y2024 ?? 0).color }} />
              </div>
              <span className="font-num text-right text-xs font-semibold text-fg">{Math.round(r.y2024 ?? 0)}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="xl:col-span-8">
        <CardHeader title="City-wise summary" subtitle="Live now (CAMS) · 2024 mean and 2022→2024 change (CPCB) · 36-month trend" />
        <div className="-mx-2 max-h-[520px] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-black/40 backdrop-blur">
              <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle [&>th]:px-2 [&>th]:py-2">
                <th>City</th>
                <th className="text-right">Now</th>
                <th className="text-right">2024 mean</th>
                <th>Category</th>
                <th>2022–2024</th>
                <th className="text-right">vs 2022</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} onClick={() => setCity(r.slug)} className="cursor-pointer border-t border-border [&>td]:px-2 [&>td]:py-2">
                  <td>
                    <div className="font-medium text-fg">{r.name}</div>
                    <div className="text-[11px] text-fg-subtle">{r.state}</div>
                  </td>
                  <td className="font-num text-right text-fg-muted">{r.now !== null ? Math.round(r.now) : "—"}</td>
                  <td className="font-num text-right font-semibold text-fg">{r.y2024 !== null ? Math.round(r.y2024) : "—"}</td>
                  <td>{r.y2024 !== null ? <AqiBadge pm={r.y2024} size="xs" /> : <span className="text-[11px] text-fg-subtle">no monitor</span>}</td>
                  <td>{r.months.length > 2 && <Sparkline values={r.months.map((m) => m.pm25)} width={120} height={28} color={categoryForPm(r.y2024 ?? 0).color} dot={false} />}</td>
                  <td className="text-right">{r.change !== null ? <Delta value={r.change} /> : <span className="text-[11px] text-fg-subtle">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CityReport({ snap }: { snap: LiveSnapshot }) {
  const slug = useAppStore((s) => s.city);
  const live = snap.cities.find((c) => c.slug === slug) ?? snap.cities[0];
  const { data, error } = useApi<CityHistory>(`/api/history/${live.slug}`);
  const r = useMemo(() => {
    if (!data || !data.months.length) return null;
    const y24 = data.months.filter((m) => m.month.startsWith("2024"));
    const worst = data.months.reduce((a, b) => (b.pm25 > a.pm25 ? b : a));
    const best = data.months.reduce((a, b) => (b.pm25 < a.pm25 ? b : a));
    const above = data.days.filter((d) => d.pm25 > NAAQS_PM25_24H).length;
    return { mean24: mean(y24.map((m) => m.pm25)) ?? 0, worst, best, above };
  }, [data]);

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8" id="city-report">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">City air-quality report</div>
            <h2 className="mt-1 font-hero text-4xl text-fg">{live.name}</h2>
            <div className="text-sm text-fg-muted">
              {live.state} · CPCB 2022–2024 + live · generated {fmtIst(Date.parse(snap.updated_at), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
            </div>
          </div>
          <div className="no-print flex gap-2">
            <CitySelect />
            <Button variant="secondary" size="md" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-5 text-sm text-amber-200">History unavailable: {error}</div>
        ) : !data ? (
          <Skeleton className="mt-5 h-72" />
        ) : !r ? (
          <div className="mt-5 rounded-2xl bg-surface-sunken p-4 text-sm text-fg-muted">No CPCB monitor within 30 km of {live.name} in the archive. Live CAMS value now: {Math.round(live.pm25 ?? 0)} µg/m³.</div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <ReportStat label="Now (CAMS)" value={`${Math.round(live.pm25 ?? 0)}`} unit="µg/m³" color={categoryForPm(live.pm25 ?? 0).color} />
              <ReportStat label="2024 annual mean" value={`${Math.round(r.mean24)}`} unit="µg/m³ · measured" color={categoryForPm(r.mean24).color} />
              <ReportStat label="Days above NAAQS, 2024" value={`${r.above}`} unit={`/ ${data.days.length} days`} color="#f97316" />
              <ReportStat label="Worst month" value={`${Math.round(r.worst.pm25)}`} unit={fmtPeriod(r.worst.month)} color="#ef4444" />
            </div>
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-fg">Monthly mean PM2.5, 2022–2024</div>
              <MonthlyBars months={data.months} />
            </div>
            <div className="mt-5 rounded-2xl bg-surface-sunken p-4 text-[13px] leading-relaxed text-fg-muted">
              <div className="text-sm font-semibold text-fg">Summary</div>
              <p className="mt-2">
                {live.name} averaged <b className="text-fg">{Math.round(r.mean24)} µg/m³</b> in 2024 ({categoryForPm(r.mean24).label}), {(r.mean24 / 40).toFixed(1)}× the annual NAAQS, and exceeded the 24-h standard on{" "}
                <b className="text-fg">{r.above}</b> days. The worst month on record here was <b className="text-fg">{fmtPeriod(r.worst.month)}</b> ({Math.round(r.worst.pm25)} µg/m³), the cleanest{" "}
                <b className="text-fg">{fmtPeriod(r.best.month)}</b> ({Math.round(r.best.pm25)} µg/m³). Right now CAMS estimates <b className="text-fg">{Math.round(live.pm25 ?? 0)} µg/m³</b>.
              </p>
              <p className="mt-2 text-[11px]">Monitors used: {data.stations.join(", ")}</p>
            </div>
          </>
        )}
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="2024 calendar" subtitle={`${live.name} · daily mean PM2.5, measured`} />
        {data ? data.days.length ? <Calendar days={data.days} /> : <div className="text-sm text-fg-muted">No daily data.</div> : <Skeleton className="h-80" />}
      </Card>
    </div>
  );
}

function MonthlyBars({ months }: { months: { month: string; pm25: number }[] }) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={months} margin={{ top: 6, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 6" />
          <XAxis dataKey="month" tickFormatter={(m: string) => (m.endsWith("-01") ? m.slice(0, 4) : "")} interval={0} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { month: string; pm25: number };
              return <ChartTip title={fmtPeriod(d.month)} rows={[{ label: "PM2.5", value: `${Math.round(d.pm25)} µg/m³`, color: categoryForPm(d.pm25).color }]} />;
            }}
          />
          <ReferenceLine y={40} stroke="var(--fg-subtle)" strokeDasharray="3 4" label={{ value: "Annual NAAQS 40", position: "insideTopRight", fill: "var(--fg-muted)", fontSize: 10 }} />
          <Bar dataKey="pm25" radius={[4, 4, 0, 0]} shape={(p: unknown) => {
            const { x, y, width, height, payload } = p as { x: number; y: number; width: number; height: number; payload: { pm25: number } };
            return <rect x={x} y={y} width={width} height={height} rx={3} fill={categoryForPm(payload.pm25).color} />;
          }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Calendar({ days }: { days: { date: string; pm25: number }[] }) {
  const grid = useMemo(() => {
    const g: (number | null)[][] = Array.from({ length: 12 }, () => new Array(31).fill(null));
    for (const d of days) g[Number(d.date.slice(5, 7)) - 1][Number(d.date.slice(8, 10)) - 1] = d.pm25;
    return g;
  }, [days]);
  return (
    <div>
      <div className="grid grid-cols-[28px_1fr] gap-2">
        <div className="grid gap-[2px]">
          {MONTHS.map((m) => (
            <span key={m} className="flex h-[9px] items-center text-[9px] text-fg-subtle">
              {m}
            </span>
          ))}
        </div>
        <div className="grid gap-[2px]">
          {grid.map((row, i) => (
            <div key={i} className="grid grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
              {row.map((v, j) => (
                <div key={j} title={v !== null ? `${j + 1} ${MONTHS[i]} 2024 · ${Math.round(v)} µg/m³` : ""} className="h-[9px] rounded-[2px]" style={{ background: v !== null ? pmColor(v) : "rgba(255,255,255,0.05)" }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-[28px_1fr] gap-2 text-[10px] text-fg-subtle">
        <span />
        <div className="flex justify-between">
          <span>1</span>
          <span>10</span>
          <span>20</span>
          <span>31</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-muted">Each cell is one day of measured data. Winter months light up as the boundary layer collapses and stubble fires peak; the monsoon washes the air clean.</p>
    </div>
  );
}

function ReportStat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-2xl bg-surface-sunken p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="font-num mt-1 text-2xl font-bold text-fg">{value}</div>
      <div className="text-[11px] text-fg-subtle">{unit}</div>
    </div>
  );
}

function Trends({ rows }: { rows: Row[] }) {
  const [sel, setSel] = useState<string[]>(["delhi", "mumbai", "kolkata", "bengaluru"]);
  const colors = ["#ef4444", "#38bdf8", "#f59e0b", "#34d399"];
  const months = useMemo(() => [...new Set(rows.flatMap((r) => r.months.map((m) => m.month)))].sort(), [rows]);
  const data = months.map((m) => ({ month: m, ...Object.fromEntries(sel.map((s) => [s, rows.find((r) => r.slug === s)?.months.find((x) => x.month === m)?.pm25 ?? null])) }));
  const season = MONTHS.map((label, i) => {
    const key = String(i + 1).padStart(2, "0");
    return { label, pm: mean(rows.flatMap((r) => r.months.filter((m) => m.month.slice(5, 7) === key).map((m) => m.pm25))) ?? 0 };
  });
  const smax = Math.max(...season.map((s) => s.pm), 1);
  const toggle = (slug: string) => setSel((cur) => (cur.includes(slug) ? cur.filter((x) => x !== slug) : cur.length >= 4 ? [...cur.slice(1), slug] : [...cur, slug]));
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader title="Multi-city comparison" subtitle="Monthly mean PM2.5, CPCB measured, 2022–2024 · pick up to 4 cities" />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rows
            .filter((r) => r.months.length)
            .map((r) => {
              const k = sel.indexOf(r.slug);
              return (
                <button key={r.slug} onClick={() => toggle(r.slug)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition", k >= 0 ? "text-slate-900" : "bg-surface-sunken text-fg-muted hover:text-fg")} style={k >= 0 ? { background: colors[k] } : undefined}>
                  {r.name}
                </button>
              );
            })}
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="month" tickFormatter={(m: string) => fmtPeriod(m)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return <ChartTip title={fmtPeriod(String(label))} rows={sel.map((s, k) => ({ label: CITY_BY_SLUG[s]?.name ?? s, value: payload.find((p) => p.dataKey === s)?.value != null ? `${Math.round(Number(payload.find((p) => p.dataKey === s)?.value))} µg/m³` : "—", color: colors[k] }))} />;
                }}
              />
              <ReferenceLine y={40} stroke="var(--fg-subtle)" strokeDasharray="3 4" />
              {sel.map((s, k) => (
                <Line key={s} type="monotone" dataKey={s} stroke={colors[k]} strokeWidth={2.2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend className="mt-2" items={sel.map((s, k) => ({ label: CITY_BY_SLUG[s]?.name ?? s, color: colors[k] }))} />
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="Season ranking" subtitle="Mean PM2.5 by calendar month, all cities, 2022–2024" />
        <div className="space-y-1.5">
          {[...season]
            .sort((a, b) => b.pm - a.pm)
            .map((s, i) => (
              <div key={s.label} className="grid grid-cols-[34px_1fr_36px] items-center gap-2">
                <span className="text-xs font-medium text-fg">{s.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(s.pm / smax) * 100}%` }} transition={{ delay: i * 0.03 }} className="h-full rounded-full" style={{ background: categoryForPm(s.pm).color }} />
                </div>
                <span className="font-num text-right text-xs text-fg-muted">{Math.round(s.pm)}</span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

function Downloads({ snap, rows, hist }: { snap: LiveSnapshot; rows: Row[]; hist: AllHistory }) {
  const stamp = snap.updated_at.slice(0, 16).replace(/[:T]/g, "-");
  const items = [
    {
      title: "City summary (CSV)",
      body: "Live CAMS value, 2022 & 2024 measured means and change for all 33 cities.",
      icon: <FileSpreadsheet className="size-5" />,
      run: () => {
        const header = "city,state,pm25_now_cams,pm25_2024_cpcb,pm25_2022_cpcb,change_pct";
        const lines = rows.map((r) => [r.name, r.state, r.now?.toFixed(1) ?? "", r.y2024?.toFixed(1) ?? "", r.y2022?.toFixed(1) ?? "", r.change?.toFixed(1) ?? ""].join(","));
        downloadFile(`aerofusion-city-summary-${stamp}.csv`, [header, ...lines].join("\n"), "text/csv");
      },
    },
    {
      title: "Monthly history (CSV)",
      body: `Measured monthly PM2.5, 2022–2024, ${hist.stations} CPCB stations, long format.`,
      icon: <CalendarRange className="size-5" />,
      run: () => {
        const lines = Object.entries(hist.cities).flatMap(([slug, ms]) => ms.map((m) => `${slug},${m.month},${m.pm25},${m.stations}`));
        downloadFile(`aerofusion-cpcb-monthly-${stamp}.csv`, ["city,month,pm25_mean,stations", ...lines].join("\n"), "text/csv");
      },
    },
    {
      title: "Live snapshot (JSON)",
      body: "Everything the backend fused at the last refresh: cities, sources, fires and tensor metadata.",
      icon: <FileJson className="size-5" />,
      run: () => downloadFile(`aerofusion-live-${stamp}.json`, JSON.stringify(snap, null, 2), "application/json"),
    },
    {
      title: "Methodology (Markdown)",
      body: "Sources, processing and caveats for every number in the reports.",
      icon: <FileText className="size-5" />,
      run: () => {
        const md = `# AeroFusion data methodology\n\nGenerated ${snap.updated_at}\n\n## Live\n${snap.sources.map((s) => `- **${s.name}** (${s.provider}): ${s.kind}${s.ok ? "" : " — offline at export"}`).join("\n")}\n\n## History\n- Measured PM2.5 from CPCB CAAQMS monitors within 30 km of each city, via the XKDR India Air Quality archive; monthly means of station means, 2022–2024.\n\n## Caveats\n- Live PM2.5 is the CAMS global model (~40 km), not a ground measurement.\n- AeroFusion's own model is not yet trained; no model accuracy is reported.\n`;
        downloadFile(`aerofusion-methodology-${stamp}.md`, md, "text/markdown");
      },
    },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader title="Download reports" subtitle="Generated in your browser from the real data shown in the app" icon={<Download className="size-4" />} />
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <button
              key={it.title}
              onClick={() => {
                it.run();
                toast.success(`${it.title} downloaded`);
              }}
              className="flex gap-3 rounded-2xl bg-surface-sunken p-4 text-left transition hover:-translate-y-0.5"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{it.icon}</div>
              <div>
                <div className="text-sm font-semibold text-fg">{it.title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-fg-muted">{it.body}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="Printable city report" subtitle="Opens your browser's print dialog" icon={<Printer className="size-4" />} />
        <p className="text-[13px] leading-relaxed text-fg-muted">
          The City reports tab uses a print stylesheet: navigation and controls are hidden and charts keep their colours. Save as PDF to attach it to a submission. <Badge tone="primary">real data</Badge>
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
          <Users className="size-4" /> Population figures: Census-based urban estimates.
        </div>
      </Card>
    </div>
  );
}
