"use client";

import { ArrowRight, Database, Factory, Flame, Gauge, MountainSnow, ShieldCheck, Sparkles, TriangleAlert, Users, Wind } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Donut } from "@/components/charts/donut";
import { Sparkline } from "@/components/charts/sparkline";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import { PageHero } from "@/components/layout/page-hero";
import { AqiBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { AnimatedNumber, Delta, Skeleton } from "@/components/ui/primitives";
import { Stagger, StaggerItem } from "@/components/ui/reveal";
import { useAppStore } from "@/hooks/use-app-store";
import { useLive, type LiveSnapshot } from "@/hooks/use-live";
import { AQI_CATEGORIES, categoryForPm, NAAQS_PM25_24H, pmToAqi } from "@/lib/aqi";
import { citySeries, fmtIst, mean, national, peak, window } from "@/lib/live";
import { cn } from "@/lib/utils";

const RealMap = dynamic(() => import("@/components/map/real-map").then((m) => m.RealMap), { ssr: false, loading: () => <Skeleton className="absolute inset-4" /> });

export function DashboardView() {
  const { snap } = useLive();
  const nat = snap ? national(snap) : null;
  const natCat = categoryForPm(nat?.avg ?? 50);
  const spark = useMemo(() => {
    if (!snap) return [];
    const n = snap.cities[0]?.pm25_24h.length ?? 0;
    return Array.from({ length: n }, (_, i) => mean(snap.cities.map((c) => c.pm25_24h[i])) ?? 0);
  }, [snap]);
  return (
    <div>
      <PageHero
        title={
          <>
            Air Quality <span className="text-gradient">Overview</span>
          </>
        }
        subtitle={
          nat ? (
            <>
              National average is <b className="text-fg">{Math.round(nat.avg)} µg/m³</b> right now. <b className="text-fg">{nat.aboveNaaqs}</b> of {nat.count} cities exceed the 24-h NAAQS of{" "}
              {NAAQS_PM25_24H} µg/m³ (CAMS, live).
            </>
          ) : (
            "Connecting to the live backend…"
          )
        }
        aside={
          <div className="glass w-[300px] rounded-[28px] p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-fg-muted">National avg · last 24 h</div>
              {nat && <AqiBadge pm={nat.avg} size="xs" />}
            </div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className="font-num text-4xl font-semibold leading-none text-fg">
                {nat ? <AnimatedNumber value={Math.round(nat.avg)} /> : "—"}
                <span className="ml-1 text-xs font-medium text-fg-muted">µg/m³</span>
              </div>
              {spark.length > 2 && <Sparkline values={spark} width={130} height={44} color={natCat.color} />}
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/forecast">
              Open forecast <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/live-map">Explore live map</Link>
          </Button>
        </div>
      </PageHero>
      <LiveGate>{(s) => <Body snap={s} />}</LiveGate>
    </div>
  );
}

function Body({ snap }: { snap: LiveSnapshot }) {
  const selected = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const [now] = useState(() => Date.now());
  const nat = national(snap);
  const series = useMemo(() => Object.fromEntries(snap.cities.map((c) => [c.slug, citySeries(c, now)])), [snap, now]);
  const sel = snap.cities.find((c) => c.slug === selected) ?? snap.cities[0];
  const next24 = window(series[sel.slug], 0, 24);
  const selPeak = peak(next24);
  const alerts = snap.cities
    .map((c) => ({ c, p: peak(window(series[c.slug], 1, 24)) }))
    .filter((a) => a.p && (a.p.pm25 ?? 0) > 90)
    .sort((a, b) => (b.p!.pm25 ?? 0) - (a.p!.pm25 ?? 0));
  const signals = [
    { icon: <Flame className="size-4" />, tint: "#f97316", title: "Most upwind fires", c: [...snap.cities].sort((a, b) => (b.fires_upwind ?? 0) - (a.fires_upwind ?? 0))[0], v: (c: (typeof snap.cities)[number]) => `${c.fires_upwind ?? 0} fires upwind` },
    { icon: <MountainSnow className="size-4" />, tint: "#a78bfa", title: "Shallowest mixing layer", c: [...snap.cities].filter((c) => c.pblh !== null).sort((a, b) => (a.pblh ?? 0) - (b.pblh ?? 0))[0], v: (c: (typeof snap.cities)[number]) => `${Math.round(c.pblh ?? 0)} m PBLH` },
    { icon: <Wind className="size-4" />, tint: "#38bdf8", title: "Most stagnant air", c: [...snap.cities].filter((c) => c.wind !== null).sort((a, b) => (a.wind ?? 0) - (b.wind ?? 0))[0], v: (c: (typeof snap.cities)[number]) => `${(c.wind ?? 0).toFixed(1)} m/s wind` },
    { icon: <Factory className="size-4" />, tint: "#eab308", title: "Highest dust load", c: [...snap.cities].filter((c) => c.dust !== null).sort((a, b) => (b.dust ?? 0) - (a.dust ?? 0))[0], v: (c: (typeof snap.cities)[number]) => `${Math.round(c.dust ?? 0)} µg/m³ dust` },
  ];
  const counts = AQI_CATEGORIES.map((cat) => ({ key: cat.key, label: cat.label, color: cat.color, value: nat.sorted.filter((c) => categoryForPm(c.pm25 ?? 0).key === cat.key).length })).filter((d) => d.value > 0);

  return (
    <>
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <Kpi icon={<Gauge />} label="National average PM2.5" value={Math.round(nat.avg)} unit="µg/m³" tint={categoryForPm(nat.avg).color} footer={<><Delta value={nat.change24} /> <span>vs 24 h ago</span></>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<TriangleAlert />} label="Cities above NAAQS" value={nat.aboveNaaqs} unit={`/ ${nat.count}`} tint="#fb923c" footer={<span>PM2.5 &gt; 60 µg/m³ now</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Users />} label="People exposed" value={Number(nat.exposedM.toFixed(1))} digits={1} unit="million" tint="#f87171" footer={<span>urban population in those cities</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Flame />} label="Fire detections · 24 h" value={snap.fires.total} tint="#fbbf24" footer={<span>NASA FIRMS VIIRS</span>} />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card padded={false} className="relative h-[540px] overflow-hidden xl:col-span-7">
          <RealMap
            basemap="satellite"
            cities={snap.cities.map((c) => ({ slug: c.slug, name: c.name, lat: c.lat, lon: c.lon, pm25: c.pm25, wind: c.wind, windDir: c.wind_dir }))}
            fires={snap.fires.points}
            wind={false}
            labels={false}
            selected={sel.slug}
            onSelect={setCity}
          />
          <div className="glass pointer-events-none absolute left-4 top-4 z-10 rounded-2xl px-3 py-2">
            <div className="text-sm font-semibold text-fg">PM2.5 across India</div>
            <div className="text-[11px] text-fg-muted">CAMS live · fires: NASA FIRMS · click a city</div>
          </div>
        </Card>

        <div className="grid gap-4 xl:col-span-5">
          <Card>
            <CardHeader title={`${sel.name} · next 24 h`} subtitle="CAMS forecast (Copernicus)" action={<Link href="/forecast" className="text-xs font-semibold text-primary">Details →</Link>} />
            <div className="flex items-center gap-5">
              <Ring pm={sel.pm25 ?? 0} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <AqiBadge pm={sel.pm25 ?? 0} />
                  <span className="text-xs text-fg-muted">AQI ≈ {pmToAqi(sel.pm25 ?? 0)}</span>
                </div>
                {next24.length > 2 && (
                  <Sparkline values={next24.map((p) => p.pm25 ?? 0)} width={260} height={64} color={categoryForPm(selPeak?.pm25 ?? 0).color} className="mt-2 w-full" />
                )}
                <div className="mt-1 flex justify-between text-[11px] text-fg-subtle">
                  <span>Now</span>
                  <span>
                    Peak <b className="font-num text-fg">{Math.round(selPeak?.pm25 ?? 0)}</b> at {selPeak ? fmtIst(selPeak.ms) : "—"}
                  </span>
                  <span>+24 h</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Forecast alerts" subtitle="Cities forecast (CAMS) to reach “Poor” (> 90) in 24 h" icon={<TriangleAlert className="size-4" />} />
            <div className="space-y-1.5">
              {alerts.length ? (
                alerts.slice(0, 4).map(({ c, p }) => (
                  <button key={c.slug} onClick={() => setCity(c.slug)} className="flex w-full items-center gap-3 rounded-xl bg-surface-sunken px-3 py-2 text-left">
                    <span className="size-2.5 rounded-full" style={{ background: categoryForPm(p!.pm25 ?? 0).color }} />
                    <span className="flex-1 text-sm font-medium text-fg">{c.name}</span>
                    <span className="text-xs text-fg-muted">
                      {Math.round(c.pm25 ?? 0)} → <b className="font-num text-fg">{Math.round(p!.pm25 ?? 0)}</b> at {fmtIst(p!.ms)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-3 text-sm text-emerald-200">
                  <ShieldCheck className="size-4" /> No city is forecast to cross “Poor” in the next 24 h.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Today’s signals" subtitle="Live conditions that push PM2.5 up" icon={<Sparkles className="size-4" />} />
            <div className="grid grid-cols-2 gap-2">
              {signals.map((s) =>
                s.c ? (
                  <button key={s.title} onClick={() => setCity(s.c.slug)} className="rounded-2xl bg-surface-sunken p-3 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                      <span style={{ color: s.tint }}>{s.icon}</span>
                      {s.title}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-fg">{s.c.name}</div>
                    <div className="font-num text-xs text-fg-muted">{s.v(s.c)}</div>
                  </button>
                ) : null,
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader title="City rankings" subtitle="Live PM2.5, last 24 h and next-24-h peak (CAMS)" icon={<Factory className="size-4" />} />
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle [&>th]:px-2 [&>th]:pb-2">
                  <th>#</th>
                  <th>City</th>
                  <th className="text-right">PM2.5</th>
                  <th>Category</th>
                  <th>Last 24 h</th>
                  <th className="text-right">24 h peak</th>
                  <th className="text-right">Δ 24 h</th>
                </tr>
              </thead>
              <tbody>
                {nat.sorted.slice(0, 10).map((c, i) => {
                  const pk = peak(window(series[c.slug], 1, 24));
                  const past = c.pm25_24h.filter((v): v is number => v !== null);
                  const d = past.length ? (((c.pm25 ?? 0) - past[0]) / past[0]) * 100 : 0;
                  return (
                    <tr key={c.slug} onClick={() => setCity(c.slug)} className={cn("cursor-pointer border-t border-border [&>td]:px-2 [&>td]:py-2.5", c.slug === sel.slug && "bg-surface-sunken")}>
                      <td className="text-xs font-semibold text-fg-subtle">{i + 1}</td>
                      <td>
                        <div className="font-medium text-fg">{c.name}</div>
                        <div className="text-[11px] text-fg-subtle">{c.state}</div>
                      </td>
                      <td className="font-num text-right font-semibold text-fg">{Math.round(c.pm25 ?? 0)}</td>
                      <td>
                        <AqiBadge pm={c.pm25 ?? 0} size="xs" />
                      </td>
                      <td>{past.length > 2 && <Sparkline values={past} width={110} height={28} color={categoryForPm(c.pm25 ?? 0).color} dot={false} />}</td>
                      <td className="font-num text-right text-fg-muted">{Math.round(pk?.pm25 ?? 0)}</td>
                      <td className="text-right">
                        <Delta value={d} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid gap-4 xl:col-span-4">
          <Card>
            <CardHeader title="Cities by category" subtitle="CPCB PM2.5 classes, now" />
            <Donut size={160} data={counts} center={<div className="font-num text-2xl font-semibold text-fg">{nat.count}</div>} />
          </Card>
          <Card>
            <CardHeader title="Data status" icon={<Database className="size-4" />} />
            <dl className="space-y-2 text-sm">
              <Row label="Sources online" value={`${snap.sources.filter((s) => s.ok).length} / ${snap.sources.length}`} />
              <Row label="Last sync" value={fmtIst(Date.parse(snap.updated_at), { hour: "numeric", minute: "2-digit", hour12: true })} />
              <Row label="Unified tensor" value={snap.tensor.shape.join(" × ")} />
              <Row label="Forecast model" value={<Badge tone="warn">training pending</Badge>} />
            </dl>
            <Button asChild variant="secondary" size="sm" className="mt-4 w-full">
              <Link href="/pipeline">Open Live Data</Link>
            </Button>
          </Card>
        </div>
      </div>
      <SourceNote>PM2.5 values and forecasts: CAMS (Copernicus) via Open-Meteo · weather: Open-Meteo · fires: NASA FIRMS · populations: Census-based estimates.</SourceNote>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}

function Ring({ pm }: { pm: number }) {
  const cat = categoryForPm(pm);
  const frac = Math.min(1, pmToAqi(pm) / 500);
  const C = 2 * Math.PI * 42;
  return (
    <div className="relative grid size-[112px] shrink-0 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <motion.circle cx="50" cy="50" r="42" fill="none" stroke={cat.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - frac) }} transition={{ duration: 1.2 }} />
      </svg>
      <div className="text-center">
        <div className="font-num text-[26px] font-semibold leading-none text-fg">{Math.round(pm)}</div>
        <div className="mt-1 text-[10px] text-fg-muted">µg/m³</div>
      </div>
    </div>
  );
}
