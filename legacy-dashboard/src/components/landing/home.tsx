"use client";

import {
  Activity,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudSun,
  Flame,
  Layers3,
  Loader2,
  MapPin,
  Satellite,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LogoMark } from "@/components/layout/logo";
import { AqiBadge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/primitives";
import { Tilt } from "@/components/ui/tilt";
import { useLive, type LiveSnapshot } from "@/hooks/use-live";
import { useAppStore } from "@/hooks/use-app-store";
import { categoryForPm, pmColor } from "@/lib/aqi";
import { CITY_BY_SLUG } from "@/lib/cities";
import { citySeries, fmtIst, window as win } from "@/lib/live";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.8, ease: EASE },
} as const;

/* ─────────────────────────── small pieces ─────────────────────────── */

function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden pb-[0.1em] align-bottom"
        >
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.08 }}
          >
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </>
  );
}

function MiniBars({
  values,
  color = "#5eead4",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-12 items-end gap-[3px]">
      {values.map((v, i) => (
        <motion.span
          key={i}
          className="w-[5px] rounded-full"
          style={{
            background: `linear-gradient(to top, ${color}44, ${color})`,
          }}
          initial={{ height: 0 }}
          whileInView={{ height: `${(v / max) * 100}%` }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.04, duration: 0.6, ease: EASE }}
        />
      ))}
    </div>
  );
}

function MiniLine({
  values,
  w = 110,
  h = 40,
}: {
  values: number[];
  w?: number;
  h?: number;
}) {
  if (values.filter((v) => Number.isFinite(v)).length < 2)
    return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 4 - ((v - min) / (max - min || 1)) * (h - 10),
  ]);
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: w, height: h }}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`ml-${w}`} x1="0" x2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke={`url(#ml-${w})`}
        strokeWidth={2.2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 1.2, ease: EASE }}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3.2}
        fill="#5eead4"
        stroke="white"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function LayerStack({ size = 1 }: { size?: number }) {
  const cols = ["#f59e0b", "#a78bfa", "#38bdf8", "#34d399"];
  return (
    <div className="relative" style={{ width: 64 * size, height: 56 * size }}>
      {cols.map((c, i) => (
        <motion.span
          key={c}
          className="absolute left-1/2 rounded-md"
          style={{
            width: 48 * size,
            height: 24 * size,
            bottom: i * 8 * size,
            background: `${c}cc`,
            transform: "translateX(-50%) rotateX(58deg) rotateZ(45deg)",
            boxShadow: `0 0 14px ${c}77, inset 0 1px 0 rgba(255,255,255,0.6)`,
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.12 }}
        />
      ))}
    </div>
  );
}

function GlassPanel({
  className,
  children,
  tilt,
}: {
  className?: string;
  children: ReactNode;
  tilt?: boolean;
}) {
  const panel = (
    <div className={cn("glass-hero rounded-[30px]", className)}>{children}</div>
  );
  return tilt ? (
    <Tilt className="h-full" radius="30px">
      {panel}
    </Tilt>
  ) : (
    panel
  );
}

/* ─────────────────────────── sections ─────────────────────────── */

function Hero({ delhi }: { delhi: number | null }) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="glass-hero mb-7 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em]"
        >
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          AI for cleaner air
        </motion.div>
        <h1 className="font-hero text-[44px] leading-[1.06] text-white [text-shadow:0_2px_28px_rgba(5,15,35,0.45)] sm:text-6xl xl:text-[80px]">
          <Words text="Forecast the Air." />
          <br />
          <Words text="Understand the" delay={0.25} />
          <br className="sm:hidden" />
          <span className="inline-block overflow-hidden pb-[0.1em] align-bottom">
            <motion.span
              className="inline-block text-[#5ef0bf]"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
            >
              Future<span className="text-white">.</span>
            </motion.span>
          </span>
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85 [text-shadow:0_1px_12px_rgba(5,15,35,0.4)] sm:text-xl"
        >
          MW-AeroFusion-Net delivers explainable PM2.5 forecasts by learning
          from multi-source environmental data across India.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.85 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link
            href="/forecast"
            className="group relative inline-flex h-[58px] items-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-[#5eead4] to-[#14b8a6] px-8 text-[17px] font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-2px_6px_rgba(0,80,70,0.25),0_0_0_1px_rgba(255,255,255,0.25),0_14px_40px_-8px_rgba(45,212,191,0.75)] transition hover:brightness-110"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            Explore Forecasts{" "}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/live-map"
            className="glass-hero inline-flex h-[58px] items-center gap-3 rounded-full px-8 text-[17px] font-semibold text-white transition hover:brightness-110"
          >
            View Live Map
            <span className="h-6 w-px bg-white/30" />
            <BookOpen className="size-5" />
          </Link>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.8, ease: EASE }}
        className="hidden justify-end lg:flex"
      >
        <Link
          href="/forecast?city=delhi"
          className="glass-hero group block w-[260px] rounded-[30px] p-6 text-white transition hover:brightness-110"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold">Delhi</span>
            <ChevronRight className="size-5 text-white/80 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="mt-1 text-[15px] text-white/80">PM2.5</div>
          <div className="font-num mt-1 text-4xl font-semibold">
            {delhi === null ? (
              "—"
            ) : (
              <AnimatedNumber value={Math.round(delhi)} />
            )}
            <span className="ml-1.5 text-xl font-medium text-white/90">
              µg/m³
            </span>
          </div>
          {delhi !== null && (
            <AqiBadge pm={delhi} size="md" className="mt-3 !bg-white/90" />
          )}
        </Link>
      </motion.div>
    </div>
  );
}

function StatCards({ line }: { line: number[] }) {
  const items = [
    {
      href: "/live-map",
      icon: <Building2 />,
      title: "33 Cities",
      sub: "Across India",
      visual: <MiniBars values={[3, 5, 4, 7, 6, 9, 8, 10, 7, 9]} />,
    },
    {
      href: "/forecast",
      icon: <Clock3 />,
      title: "4-day Forecasts",
      sub: "Hourly, live CAMS",
      visual: <MiniLine values={line} />,
    },
    {
      href: "/data-sources",
      icon: <Layers3 />,
      title: "Multi-Source Data",
      sub: "CAMS, NASA, Open-Meteo, CPCB",
      visual: <LayerStack size={0.85} />,
    },
    {
      href: "/explainability",
      icon: <BrainCircuit />,
      title: "Explainable AI",
      sub: "Understand key factors",
      visual: <MiniBars values={[4, 7, 5, 9, 6, 10, 8]} color="#38bdf8" />,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it, i) => (
        <motion.div
          key={it.title}
          {...reveal}
          transition={{ ...reveal.transition, delay: i * 0.08 }}
        >
          <Tilt radius="28px">
            <Link
              href={it.href}
              className="glass-hero group flex h-[112px] items-center gap-4 rounded-[28px] px-5 text-white"
            >
              <span className="glass-hero grid size-13 shrink-0 place-items-center rounded-full text-emerald-200 [&_svg]:size-6 [&_svg]:stroke-[1.5]">
                {it.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[17px] leading-tight">
                  {it.title}
                </div>
                <div className="mt-1 truncate text-[12.5px] text-white/75">
                  {it.sub}
                </div>
              </div>
              <div className="hidden shrink-0 min-[1500px]:block">
                {it.visual}
              </div>
              <ChevronRight className="size-5 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Tilt>
        </motion.div>
      ))}
    </div>
  );
}

function CityList({
  snap,
  selected,
  onSelect,
}: {
  snap: LiveSnapshot | null;
  selected: string;
  onSelect: (s: string) => void;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    if (!snap) return [];
    const list = snap.cities
      .map((c) => ({ c, v: c.pm25 ?? 0 }))
      .filter(({ c }) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    return q
      ? list
      : list.filter(({ c }) =>
          [
            "delhi",
            "bengaluru",
            "mumbai",
            "hyderabad",
            "chennai",
            "kolkata",
            "lucknow",
          ].includes(c.slug),
        );
  }, [snap, q]);
  return (
    <GlassPanel className="flex h-full flex-col p-5 text-white">
      <label className="flex h-12 items-center gap-3 rounded-full bg-white/10 px-4 shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.28)]">
        <Search className="size-[18px] text-white/75" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any city…"
          className="h-full flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/60"
        />
      </label>
      <div
        className="mt-3 flex-1 space-y-0.5 overflow-y-auto pr-1 scrollbar-none"
        data-lenis-prevent
      >
        {rows.slice(0, 7).map(({ c, v }) => {
          const cat = categoryForPm(v);
          const active = c.slug === selected;
          return (
            <button
              key={c.slug}
              onClick={() => onSelect(c.slug)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                active
                  ? "bg-white/15 shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.3)]"
                  : "hover:bg-white/10",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  background: cat.color,
                  boxShadow: `0 0 10px ${cat.color}`,
                }}
              />
              <span className="flex-1 text-[15px] font-medium">{c.name}</span>
              <span
                className="size-2 rounded-full"
                style={{ background: cat.color }}
              />
              <span className="font-num w-[92px] text-right text-[14px] text-white/90">
                {Math.round(v)} <span className="text-white/60">µg/m³</span>
              </span>
              <ChevronRight className="size-4 text-white/60" />
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-white/60">
            No city matches “{q}”.
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function RealtimeChart({
  snap,
  slug,
}: {
  snap: LiveSnapshot | null;
  slug: string;
}) {
  const [h, setH] = useState<24 | 48>(24);
  const [open, setOpen] = useState(false);
  const city = CITY_BY_SLUG[slug];
  const data = useMemo(() => {
    const lc = snap?.cities.find((c) => c.slug === slug);
    if (!lc || !snap) return [];
    return win(citySeries(lc, Date.parse(snap.updated_at)), -h, h)
      .filter((p) => p.pm25 !== null)
      .map((p) => ({ t: p.ms, v: p.pm25 as number, lead: p.lead }));
  }, [snap, slug, h]);
  const peak = data.reduce(
    (m, d) => (d.v > m.v ? d : m),
    data[0] ?? { t: 0, v: 0, lead: 0 },
  );
  return (
    <GlassPanel className="h-full p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl">Real-time Air Quality</div>
          <div className="mt-0.5 text-[13px] text-white/70">
            {city.name} · CAMS PM2.5, past & forecast (live)
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.28)]"
          >
            {h}h <ChevronDown className="size-4" />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-hero absolute right-0 top-12 z-10 w-24 rounded-2xl p-1"
              >
                {([24, 48] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setH(v);
                      setOpen(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/15"
                  >
                    {v} hours
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-4 h-[210px]">
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 28, right: 8, bottom: 0, left: -18 }}
            >
              <defs>
                <linearGradient id="rt-stroke" x1="0" x2="1">
                  {data.map((d, i) => (
                    <stop
                      key={i}
                      offset={`${(i / (data.length - 1)) * 100}%`}
                      stopColor={pmColor(d.v)}
                    />
                  ))}
                </linearGradient>
                <linearGradient id="rt-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity={0.18} />
                  <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickFormatter={(t: number) => fmtIst(t)}
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{
                  stroke: "rgba(255,255,255,0.4)",
                  strokeDasharray: "4 4",
                }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="glass-hero rounded-2xl px-3 py-2 text-xs text-white">
                      <div className="font-semibold">
                        {fmtIst((payload[0].payload as { t: number }).t)}
                      </div>
                      <div className="font-num">
                        {Math.round((payload[0].payload as { v: number }).v)}{" "}
                        µg/m³
                      </div>
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="url(#rt-stroke)"
                strokeWidth={3}
                fill="url(#rt-fill)"
                animationDuration={1200}
              />
              <ReferenceDot
                x={peak.t}
                y={peak.v}
                r={6}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2}
                label={{
                  value: `${Math.round(peak.v)} µg/m³`,
                  position: "top",
                  fill: "white",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassPanel>
  );
}

function DataSourcesCard() {
  const feeds = [
    {
      icon: <Flame className="size-5" />,
      name: "NASA FIRMS",
      sub: "Fire hotspots",
      tint: "#f97316",
    },
    {
      icon: <MapPin className="size-5" />,
      name: "CPCB (XKDR)",
      sub: "Measured PM2.5 archive",
      tint: "#a78bfa",
    },
    {
      icon: <CloudSun className="size-5" />,
      name: "Open-Meteo",
      sub: "Live weather",
      tint: "#f59e0b",
    },
    {
      icon: <Satellite className="size-5" />,
      name: "CAMS + NASA GIBS",
      sub: "Aerosol model & satellite imagery",
      tint: "#38bdf8",
    },
  ];
  const demo = false;
  return (
    <GlassPanel className="p-6 text-white">
      <div className="flex items-center gap-2 font-display text-xl">
        Data Sources {demo ? "" : "(Live)"}
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
      </div>
      <div className="mt-4 space-y-1">
        {feeds.map((f, i) => (
          <motion.div
            key={f.name}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
          >
            <Link
              href="/data-sources"
              className="flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition hover:bg-white/10"
            >
              <span
                className="glass-hero grid size-11 place-items-center rounded-full"
                style={{ color: f.tint }}
              >
                {f.icon}
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">
                  {f.name}
                </span>
                <span className="block text-xs text-white/65">{f.sub}</span>
              </span>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold",
                  demo ? "text-amber-200" : "text-emerald-300",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    demo ? "bg-amber-300" : "bg-emerald-400",
                  )}
                />
                {demo ? "Simulated" : "Online"}
              </span>
              <ChevronRight className="size-4 text-white/60" />
            </Link>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  );
}

const STEPS = [
  "Ingesting data",
  "Processing & aligning",
  "Generating forecast",
  "Explaining results",
];

function ModelCard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => (s + 1) % (STEPS.length + 2)),
      1100,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <GlassPanel className="p-6 text-white">
      <div className="flex items-start gap-3">
        <span className="glass-hero grid size-11 place-items-center rounded-full text-emerald-200">
          <Activity className="size-5" />
        </span>
        <div>
          <div className="font-display text-lg">AI Forecast Model</div>
          <div className="text-[13px] text-white/70">
            Multi-source fusion with spatio-temporal deep learning
          </div>
        </div>
      </div>
      <div className="my-5 flex justify-center">
        <LayerStack size={1.6} />
      </div>
      <div className="space-y-2.5 border-t border-white/15 pt-4">
        {STEPS.map((s, i) => {
          const done = i < step;
          const running = i === step;
          return (
            <div key={s} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "size-2 rounded-full",
                  done
                    ? "bg-emerald-400"
                    : running
                      ? "bg-sky-300"
                      : "bg-white/40",
                )}
              />
              <span
                className={cn(
                  "flex-1",
                  done || running ? "text-white" : "text-white/60",
                )}
              >
                {s}
              </span>
              <span className="grid size-5 place-items-center">
                {done ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="grid size-5 place-items-center rounded-full bg-emerald-400 text-[#06221a]"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </motion.span>
                ) : running ? (
                  <Loader2 className="size-4 animate-spin text-sky-200" />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function FloatingWidgets({ snap }: { snap: LiveSnapshot | null }) {
  const mumbai = useMemo(() => {
    const m = snap?.cities.find((c) => c.slug === "mumbai");
    return m && snap
      ? win(citySeries(m, Date.parse(snap.updated_at)), 0, 24).map(
          (p) => p.pm25 ?? 0,
        )
      : [1, 2, 3, 2, 4];
  }, [snap]);
  const top = useMemo(
    () =>
      !snap
        ? []
        : snap.cities
            .map((c) => ({ c, v: c.pm25 ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 4),
    [snap],
  );
  const avg = useMemo(
    () =>
      !snap
        ? 0
        : snap.cities.reduce((s, c) => s + (c.pm25 ?? 0), 0) /
          snap.cities.length,
    [snap],
  );
  const regions = snap?.fires.regions.slice(0, 7) ?? [];
  const label =
    "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70";
  const card = "flex h-full min-h-[190px] flex-col p-5 text-white";
  return (
    <div className="flex h-full flex-col justify-center">
      <motion.div
        {...reveal}
        className="mb-5 flex items-end justify-between gap-4"
      >
        <div>
          <div className="font-display text-2xl text-white [text-shadow:0_2px_18px_rgba(5,15,35,0.5)]">
            Live right now
          </div>
          <div className="text-sm text-white/75">
            Refreshed every 12 hours from CAMS, Open-Meteo and NASA FIRMS
          </div>
        </div>
        <Link
          href="/dashboard"
          className="glass-hero hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white sm:inline-flex"
        >
          Open dashboard <ArrowRight className="size-4" />
        </Link>
      </motion.div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div {...reveal}>
          <GlassPanel tilt className={card}>
            <div className={label}>National average</div>
            <div className="mt-3 flex flex-1 items-center gap-4">
              <div className="relative grid size-20 shrink-0 place-items-center">
                <svg
                  viewBox="0 0 36 36"
                  className="absolute inset-0 -rotate-90"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="3.2"
                  />
                  <motion.circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={categoryForPm(avg).color}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeDasharray="94.2"
                    initial={{ strokeDashoffset: 94.2 }}
                    whileInView={{
                      strokeDashoffset: 94.2 * (1 - Math.min(1, avg / 150)),
                    }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2 }}
                  />
                </svg>
                <span className="font-num text-xl font-semibold">
                  {Math.round(avg)}
                </span>
              </div>
              <div>
                <div className="text-sm text-white/85">PM2.5, µg/m³</div>
                {snap && (
                  <AqiBadge pm={avg} size="sm" className="mt-2 !bg-white/90" />
                )}
              </div>
            </div>
          </GlassPanel>
        </motion.div>
        <motion.div
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.08 }}
        >
          <GlassPanel tilt className={card}>
            <div className={label}>Most polluted now</div>
            <div className="mt-3 flex-1 space-y-2">
              {top.map(({ c, v }) => (
                <div key={c.slug} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      background: categoryForPm(v).color,
                      boxShadow: `0 0 8px ${categoryForPm(v).color}`,
                    }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-num font-semibold">
                    {Math.round(v)}
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
        <motion.div
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.16 }}
        >
          <GlassPanel tilt className={card}>
            <div className={label}>Mumbai · next 24 h</div>
            <div className="mt-3 flex flex-1 items-center">
              <MiniLine values={mumbai} w={240} h={80} />
            </div>
            <div className="flex justify-between text-[11px] text-white/60">
              <span>Now</span>
              <span>+24 h</span>
            </div>
          </GlassPanel>
        </motion.div>
        <motion.div
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.24 }}
        >
          <GlassPanel tilt className={card}>
            <div className={label}>
              Fires today · {snap?.fires.total.toLocaleString("en-IN") ?? "—"}
            </div>
            <div className="mt-3 flex-1 space-y-1.5">
              {regions.slice(0, 4).map((r) => (
                <div
                  key={r.region}
                  className="grid grid-cols-[1fr_90px_34px] items-center gap-2 text-xs"
                >
                  <span className="truncate text-white/85">{r.region}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/12">
                    <motion.span
                      className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500"
                      initial={{ width: 0 }}
                      whileInView={{
                        width: `${(r.count / (regions[0]?.count || 1)) * 100}%`,
                      }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8 }}
                    />
                  </span>
                  <span className="font-num text-right">{r.count}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="glass-hero mx-auto flex max-w-[1500px] flex-col gap-4 rounded-[28px] px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <LogoMark className="size-9" />
        <div>
          <div className="font-display text-base">AeroFusion</div>
          <div className="text-xs text-white/70">
            Explainable air-quality forecasting for India
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
        <Link href="/dashboard" className="hover:text-white">
          Dashboard
        </Link>
        <Link href="/model-lab" className="hover:text-white">
          Model Lab
        </Link>
        <Link href="/data-sources" className="hover:text-white">
          Data Sources
        </Link>
        <Link href="/about" className="hover:text-white">
          About
        </Link>
      </div>
      <div className="text-xs text-white/60">© 2026 AeroFusion · Live data</div>
    </footer>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export function HomePage() {
  const { snap } = useLive();
  const selected = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const dl = snap?.cities.find((c) => c.slug === "delhi");
  const delhi = dl?.pm25 ?? null;
  const line = useMemo(
    () =>
      dl && snap
        ? win(citySeries(dl, Date.parse(snap.updated_at)), 0, 24).map(
            (p) => p.pm25 ?? 0,
          )
        : [3, 4, 3, 5, 4, 6, 5, 7],
    [dl, snap],
  );

  // On large screens every section sits on its matching region of the artwork (positions are % of its height).
  const place = (extra: string) =>
    cn(
      "relative px-5 py-8 lg:px-10",
      extra.replace(/lg:(top|bottom)-\[[^\]]*\]|lg:top-auto|lg:h-\[15%\]/g, ""),
    );

  return (
    <main className="relative overflow-hidden bg-[#0b1430]">
      <Image
        src="/hero/homepage.webp"
        alt=""
        fill
        priority
        quality={100}
        sizes="100vw"
        className="pointer-events-none select-none object-cover object-top"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-[#0b1d33]/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[#050a14]/30 dark:block" />

      <section
        className={place("flex min-h-dvh flex-col justify-center pt-32")}
      >
        <div className="mx-auto max-w-[1500px]">
          <Hero delhi={delhi} />
        </div>
      </section>

      <section className={place("lg:top-[31.5%]")}>
        <div className="mx-auto max-w-[1500px]">
          <StatCards line={line} />
        </div>
      </section>

      <section className={place("lg:top-[38.6%]")}>
        <motion.div
          {...reveal}
          className="mx-auto grid max-w-[1500px] gap-5 lg:h-[380px] lg:grid-cols-[0.75fr_1.25fr]"
        >
          <CityList snap={snap} selected={selected} onSelect={setCity} />
          <RealtimeChart snap={snap} slug={selected} />
        </motion.div>
      </section>

      <section className={place("lg:top-[60.2%]")}>
        <div className="mx-auto grid max-w-[1500px] items-center gap-6 lg:grid-cols-2">
          <motion.div {...reveal}>
            <DataSourcesCard />
          </motion.div>
          <motion.div
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.1 }}
          >
            <ModelCard />
          </motion.div>
        </div>
      </section>

      <section className={place("lg:h-[420px]")}>
        <div className="relative mx-auto h-full max-w-[1500px]">
          <FloatingWidgets snap={snap} />
        </div>
      </section>

      <section className={place("pb-8 lg:bottom-[1.2%] lg:top-auto")}>
        <Footer />
      </section>
    </main>
  );
}
