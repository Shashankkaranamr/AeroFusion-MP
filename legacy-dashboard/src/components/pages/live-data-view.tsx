"use client";

import { AlertTriangle, Boxes, CloudSun, Database, Flame, Key, Loader2, MapPin, RefreshCw, Satellite, Timer, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { PageHero } from "@/components/layout/page-hero";
import { AqiBadge, Badge, Dot } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/primitives";
import { API_URL, useLive, type GibsLayer, type LiveSnapshot, type LiveSource } from "@/hooks/use-live";
import { categoryForPm, pmColor } from "@/lib/aqi";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const SOURCE_ICON: Record<string, React.ReactNode> = {
  cams: <Wind className="size-5" />,
  weather: <CloudSun className="size-5" />,
  firms: <Flame className="size-5" />,
  gibs: <Satellite className="size-5" />,
  cpcb: <Database className="size-5" />,
  calendar: <Timer className="size-5" />,
};
const SOURCE_TINT: Record<string, string> = { cams: "#38bdf8", weather: "#fbbf24", firms: "#f97316", gibs: "#a78bfa", cpcb: "#34d399", calendar: "#f472b6" };

function fmtClock(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

/* ─────────────── countdown ring + refresh ─────────────── */

function RefreshPanel({ snap, countdown, refreshing, onRefresh }: { snap: LiveSnapshot | null; countdown: number | null; refreshing: boolean; onRefresh: () => void }) {
  const total = snap?.interval_s ?? 600;
  const left = countdown ?? total;
  const frac = Math.min(1, Math.max(0, left / total));
  const C = 2 * Math.PI * 42;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="glass flex items-center gap-5 rounded-[30px] p-4 pr-5">
      <div className="relative grid size-[104px] place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
          <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#cd-grad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - frac) }} transition={{ duration: 0.9, ease: "linear" }} />
          <defs>
            <linearGradient id="cd-grad" x1="0" x2="1">
              <stop offset="0" stopColor="#5eead4" />
              <stop offset="1" stopColor="#93c5fd" />
            </linearGradient>
          </defs>
        </svg>
        <div className="text-center">
          <div className="font-num text-[22px] font-semibold leading-none text-fg">{refreshing ? "··" : `${mm}:${ss}`}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-fg-muted">next sync</div>
        </div>
      </div>
      <div>
        <div className="text-xs text-fg-muted">Last updated</div>
        <div className="font-num text-lg font-semibold text-fg">{fmtClock(snap?.updated_at)}</div>
        <div className="text-[11px] text-fg-subtle">{snap ? `fused in ${(snap.took_ms / 1000).toFixed(1)} s · every ${Math.round(total / 60)} min` : "waiting for backend"}</div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="glass-tint mt-3 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-70"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          {refreshing ? "Fetching all sources…" : "Refresh now"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── sources ─────────────── */

function SourceCard({ s, i, pulseKey }: { s: LiveSource; i: number; pulseKey: string }) {
  const tint = SOURCE_TINT[s.id] ?? "#94a3b8";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.6, ease: EASE }}>
      <Card className="h-full !p-4">
        <motion.div key={pulseKey} className="pointer-events-none absolute inset-0 rounded-[inherit]" initial={{ boxShadow: `inset 0 0 0 2px ${tint}` }} animate={{ boxShadow: "inset 0 0 0 0px transparent" }} transition={{ duration: 1.4 }} />
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ color: tint, background: `color-mix(in oklab, ${tint} 18%, transparent)` }}>
            {SOURCE_ICON[s.id]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-fg">{s.name}</div>
            <div className="truncate text-[11px] text-fg-muted">{s.provider}</div>
          </div>
        </div>
        <div className="mt-3 line-clamp-2 min-h-[32px] text-xs text-fg-muted">{s.kind}</div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className={cn("flex items-center gap-1.5 font-semibold", s.ok ? "text-emerald-300" : "text-rose-300")}>
            <Dot color={s.ok ? "#34d399" : "#fb7185"} pulse={s.ok} />
            {s.ok ? "Online" : "Error"}
          </span>
          <span className="font-num text-fg-muted">
            {s.records.toLocaleString("en-IN")} rec · {s.latency_ms} ms
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-fg-subtle">
          <Key className="size-3" /> {s.key ? "API key (server-side)" : "No key needed"}
        </div>
        {!s.ok && s.error && <div className="mt-2 line-clamp-2 text-[10.5px] text-rose-200">{s.error}</div>}
      </Card>
    </motion.div>
  );
}

/* ─────────────── NASA imagery ─────────────── */

function NasaImage({ src, alt, refreshKey, className }: { src: string; alt: string; refreshKey: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-[#0b1430]", className)}>
      <AnimatePresence>
        {!loaded && !failed && (
          <motion.div key="scan" exit={{ opacity: 0 }} className="absolute inset-0">
            <div className="skeleton absolute inset-0 !rounded-none opacity-40" />
            <motion.div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-sky-300/30 to-transparent" animate={{ y: ["-20%", "520%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }} />
            <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold uppercase tracking-widest text-white/70">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Downlinking
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {failed ? (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/70">Imagery not available for this date yet</div>
      ) : (
        <motion.img
          key={refreshKey}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          initial={{ opacity: 0, scale: 1.06, filter: "blur(14px)" }}
          animate={loaded ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
          transition={{ duration: 1.1, ease: EASE }}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}

function NasaSection({ snap }: { snap: LiveSnapshot }) {
  const layers = snap.gibs?.layers ?? [];
  const [active, setActive] = useState<string>("fires");
  const layer: GibsLayer | undefined = layers.find((l) => l.id === active) ?? layers[0];
  const firesByCity = useMemo(() => Object.fromEntries(snap.cities.map((c) => [c.slug, c.fires_300km ?? 0])), [snap.cities]);
  if (!snap.gibs || !layer) {
    return (
      <Card>
        <CardHeader title="NASA satellite imagery" subtitle="GIBS is unreachable right now — it will retry on the next sync" icon={<Satellite className="size-4" />} />
      </Card>
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-6" padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <div className="font-display text-[17px] font-semibold text-fg">NASA GIBS · India</div>
            <div className="text-xs text-fg-muted">
              {layer.title} · {layer.subtitle} · {layer.date} (daily composite)
            </div>
          </div>
          <Badge tone="accent">EPSG:4326 · WMS</Badge>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-5 pb-3 scrollbar-none">
          {layers.map((l) => (
            <button
              key={l.id}
              onClick={() => setActive(l.id)}
              className={cn("relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition", l.id === active ? "text-fg" : "text-fg-muted hover:text-fg")}
            >
              {l.id === active && <motion.span layoutId="gibs-tab" className="glass-strong absolute inset-0 rounded-full" />}
              <span className="relative">{l.title}</span>
            </button>
          ))}
        </div>
        <div className="relative mx-5 mb-5 overflow-hidden rounded-[22px]">
          <NasaImage src={layer.url} alt={`${layer.title} over India`} refreshKey={`${layer.id}-${snap.updated_at}`} className="aspect-[900/940] w-full" />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {layer.layers.split(",").at(-1)}
          </div>
        </div>
      </Card>

      <div className="xl:col-span-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <div className="font-display text-[17px] font-semibold text-fg">City close-ups</div>
            <div className="text-xs text-fg-muted">VIIRS true colour + NOAA-20 thermal anomalies · ±1.2° around each city</div>
          </div>
          <Badge tone="warn">fires = red dots</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {snap.gibs.cities.map((c, i) => (
            <motion.div key={c.city} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: EASE }}>
              <Card padded={false} className="group overflow-hidden !rounded-[22px]">
                <NasaImage src={c.url} alt={`${c.name} satellite view`} refreshKey={`${c.city}-${snap.updated_at}`} className="aspect-square w-full transition-transform duration-700 group-hover:scale-[1.04]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <div className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <MapPin className="size-3.5" /> {c.name}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Flame className="size-3 text-orange-300" />
                      {firesByCity[c.city] ?? 0}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/70">{c.date}</div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── tensor ─────────────── */

function TensorCard({ snap }: { snap: LiveSnapshot }) {
  const { tensor } = snap;
  const [hover, setHover] = useState<{ city: string; feat: string; z: number | null } | null>(null);
  const tint: Record<string, string> = { cams: "#38bdf8", weather: "#fbbf24", firms: "#f97316", cpcb: "#34d399", calendar: "#f472b6" };
  const zColor = (z: number | null) => {
    if (z === null) return "rgba(255,255,255,0.05)";
    const t = (z + 3) / 6;
    return t > 0.5 ? `rgba(251,113,133,${0.15 + (t - 0.5) * 1.6})` : `rgba(96,165,250,${0.15 + (0.5 - t) * 1.6})`;
  };
  return (
    <Card>
      <CardHeader
        title="Unified spatio-temporal tensor"
        subtitle={`Every sync appends one time step · saved to ${tensor.file}`}
        icon={<Boxes className="size-4" />}
        action={
          <span className="font-num rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
            ({tensor.shape.join(" × ")})
          </span>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-fg-muted">
        <span>
          dims: <b className="text-fg">{tensor.dims.join(" × ")}</b>
        </span>
        <span>·</span>
        <span>
          coverage <b className="text-fg">{(tensor.coverage * 100).toFixed(1)}%</b>
        </span>
        <span>·</span>
        {Object.entries(tint).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: c }} /> {k}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="min-w-[760px]">
          <div className="ml-[104px] grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${tensor.features.length}, minmax(0,1fr))` }}>
            {tensor.features.map((f) => (
              <div key={f.key} className="h-1.5 rounded-full" style={{ background: tint[f.source] ?? "#94a3b8" }} title={f.label} />
            ))}
          </div>
          <div className="mt-1 space-y-[2px]" onMouseLeave={() => setHover(null)}>
            {tensor.z.map((row, i) => (
              <div key={tensor.cities[i]} className="flex items-center gap-1">
                <span className="w-[100px] truncate text-right text-[10.5px] text-fg-muted">{snap.cities[i]?.name}</span>
                <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0,1fr))` }}>
                  {row.map((z, j) => (
                    <motion.div
                      key={j}
                      onMouseEnter={() => setHover({ city: snap.cities[i]?.name, feat: tensor.features[j].label, z })}
                      className="h-3.5 rounded-[3px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, background: zColor(z) }}
                      transition={{ delay: (i * row.length + j) * 0.0008, duration: 0.4 }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 h-9 rounded-2xl bg-surface-sunken px-3 py-2 text-xs text-fg-muted">
        {hover ? (
          <span>
            <b className="text-fg">{hover.city}</b> · {hover.feat} · z = <b className="font-num text-fg">{hover.z === null ? "missing" : hover.z.toFixed(2)}</b>
          </span>
        ) : (
          "Cells are z-scored per feature across cities (blue = low, red = high). Hover a cell."
        )}
      </div>
    </Card>
  );
}

/* ─────────────── fused city table ─────────────── */

function CityTable({ snap }: { snap: LiveSnapshot }) {
  const rows = [...snap.cities].sort((a, b) => (b.pm25 ?? 0) - (a.pm25 ?? 0));
  return (
    <Card>
      <CardHeader title="Fused city records" subtitle="One row per graph node · current hour" icon={<Database className="size-4" />} />
      <div className="-mx-2 max-h-[560px] overflow-auto scrollbar-thin" data-lenis-prevent>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle [&>th]:bg-[rgba(15,23,42,0.55)] [&>th]:px-2 [&>th]:py-2 [&>th]:backdrop-blur-md">
              <th>City</th>
              <th className="text-right">PM2.5 (CAMS)</th>
              <th>Category</th>
              <th className="text-right">CPCB baseline</th>
              <th className="text-right">Temp</th>
              <th className="text-right">RH</th>
              <th className="text-right">Wind</th>
              <th className="text-right">PBLH</th>
              <th className="text-right">Fires ≤300 km</th>
              <th className="text-right">Upwind</th>
              <th>PM2.5 ±24 h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <motion.tr key={c.slug} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="border-t border-border [&>td]:px-2 [&>td]:py-2">
                <td className="font-medium text-fg">{c.name}</td>
                <td className="font-num text-right font-semibold text-fg">{c.pm25?.toFixed(1) ?? "—"}</td>
                <td>{c.pm25 !== null && <AqiBadge pm={c.pm25} size="xs" />}</td>
                <td className="font-num text-right text-fg-muted">{c.cpcb_baseline?.toFixed(0) ?? "—"}</td>
                <td className="font-num text-right text-fg-muted">{c.temp?.toFixed(1) ?? "—"}°</td>
                <td className="font-num text-right text-fg-muted">{c.rh?.toFixed(0) ?? "—"}%</td>
                <td className="font-num text-right text-fg-muted">{c.wind?.toFixed(1) ?? "—"}</td>
                <td className="font-num text-right text-fg-muted">{c.pblh?.toFixed(0) ?? "—"}</td>
                <td className="font-num text-right text-fg">{c.fires_300km ?? 0}</td>
                <td className="font-num text-right text-orange-300">{c.fires_upwind ?? 0}</td>
                <td>
                  {c.pm25_24h.filter((v) => v !== null).length > 2 && (
                    <Sparkline values={c.pm25_24h.filter((v): v is number => v !== null)} width={110} height={26} color={pmColor(c.pm25 ?? 0)} dot={false} />
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FireCard({ snap }: { snap: LiveSnapshot }) {
  const max = Math.max(1, ...snap.fires.regions.map((r) => r.count));
  return (
    <Card>
      <CardHeader title="Active fires · last 24 h" subtitle="NASA FIRMS VIIRS (NOAA-20 + S-NPP) inside India" icon={<Flame className="size-4" />} action={<span className="font-num text-2xl font-semibold text-fg">{snap.fires.total.toLocaleString("en-IN")}</span>} />
      <div className="space-y-2.5">
        {snap.fires.regions.map((r, i) => (
          <div key={r.region}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-fg-muted">{r.region}</span>
              <span className="font-num text-fg">
                {r.count} · {Math.round(r.frp)} MW
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-500" initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.8, ease: EASE }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─────────────── page ─────────────── */

export function LiveDataView() {
  const { snap, error, refreshing, countdown, refresh } = useLive();
  const delhi = snap?.cities.find((c) => c.slug === "delhi");
  const online = snap?.sources.filter((s) => s.ok).length ?? 0;
  return (
    <div>
      <PageHero
        title={
          <>
            Live Data <span className="text-gradient">Fusion</span>
          </>
        }
        subtitle="Six open sources — NASA satellites, CAMS air quality, weather and the CPCB archive — fetched on a timer, fused per city and stacked into one spatio-temporal tensor."
        aside={<RefreshPanel snap={snap} countdown={countdown} refreshing={refreshing} onRefresh={refresh} />}
      />

      {error && !snap && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-amber-300" />
            <div className="text-sm text-fg">
              <b>Backend offline.</b> Start the API, then this page connects automatically:
              <pre className="mt-2 rounded-xl bg-black/40 p-3 font-mono text-xs text-emerald-200">cd backend && uvicorn app.main:app --port 8000</pre>
              <div className="mt-1 text-xs text-fg-muted">
                Looking for {API_URL} · {error}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sources online", value: snap ? `${online} / ${snap.sources.length}` : "—", tint: "#34d399" },
          { label: "Delhi PM2.5 (CAMS, now)", value: delhi?.pm25 != null ? `${delhi.pm25.toFixed(0)} µg/m³` : "—", tint: delhi?.pm25 != null ? categoryForPm(delhi.pm25).color : "#94a3b8" },
          { label: "Active fires (24 h)", value: snap ? snap.fires.total.toLocaleString("en-IN") : "—", tint: "#f97316" },
          { label: "Tensor shape", value: snap ? snap.tensor.shape.join(" × ") : "—", tint: "#93c5fd" },
        ].map((k) => (
          <Card key={k.label} className="!p-4">
            <div className="text-xs text-fg-muted">{k.label}</div>
            <div className="font-num mt-1 text-2xl font-semibold" style={{ color: k.tint }}>
              {k.value}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {snap ? snap.sources.map((s, i) => <SourceCard key={s.id} s={s} i={i} pulseKey={`${s.id}-${snap.updated_at}`} />) : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40 !rounded-[28px]" />)}
      </div>

      <div className="mt-4">{snap ? <NasaSection snap={snap} /> : <Skeleton className="h-[520px] !rounded-[28px]" />}</div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">{snap ? <TensorCard snap={snap} /> : <Skeleton className="h-96 !rounded-[28px]" />}</div>
        <div className="xl:col-span-4">{snap ? <FireCard snap={snap} /> : <Skeleton className="h-96 !rounded-[28px]" />}</div>
      </div>

      <div className="mt-4">{snap && <CityTable snap={snap} />}</div>

      <Card className="mt-4 !p-4">
        <div className="text-xs leading-relaxed text-fg-muted">
          <b className="text-fg">Provenance.</b> Live PM2.5 here is the <b>CAMS model</b> (Copernicus, via Open-Meteo) — modelled, not measured. The CPCB column is the measured
          same-month mean from the XKDR CPCB archive (latest complete year), used as a baseline feature. Fires are NASA FIRMS VIIRS detections from the last 24 h; imagery is the
          most recent NASA GIBS daily composite.
        </div>
      </Card>
    </div>
  );
}
