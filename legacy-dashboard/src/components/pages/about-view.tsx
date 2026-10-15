"use client";

import { BookOpen, Building, Code2, Database, ExternalLink, GraduationCap, HeartPulse, Scale, ShieldCheck, ThermometerSun, Users } from "lucide-react";
import { motion } from "motion/react";
import { GlassNote, PageHero } from "@/components/layout/page-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

const TEAM = [
  { name: "Shashank Ravindra Karanam", usn: "1BM23CS312" },
  { name: "Sohan R", usn: "1BM23CS336" },
  { name: "Srinidhi B V", usn: "1BM23CS339" },
  { name: "Srujan K R", usn: "1BM23CS340" },
];

const STACK = [
  { group: "Frontend", items: ["Next.js 16 (App Router)", "React 19", "TypeScript", "Tailwind CSS v4", "Motion", "Lenis", "Recharts", "d3-geo / d3-zoom", "Radix UI", "cmdk"] },
  { group: "Backend", items: ["FastAPI", "Uvicorn", "httpx (async)", "NumPy tensor store"] },
  { group: "Machine learning", items: ["PyTorch 2", "PyWavelets", "scikit-learn", "LightGBM", "SHAP"] },
  { group: "Data", items: ["CPCB via XKDR archive", "Copernicus CAMS", "Open-Meteo", "NASA FIRMS", "NASA GIBS", "MapLibre + CARTO", "DataMeet boundaries"] },
];

const ATTRIBUTION = [
  { label: "India boundaries", by: "DataMeet India community", licence: "CC BY 4.0", url: "https://github.com/datameet/maps" },
  { label: "Measured air quality", by: "CPCB CAAQMS via XKDR India Air Quality API", licence: "GODL-India", url: "https://airquality.xkdr.org" },
  { label: "Weather", by: "Open-Meteo (ECMWF, GFS & others)", licence: "CC BY 4.0", url: "https://open-meteo.com" },
  { label: "Active fires", by: "NASA FIRMS (VIIRS)", licence: "NASA open data", url: "https://firms.modaps.eosdis.nasa.gov" },
  { label: "Satellite imagery", by: "NASA GIBS / Worldview", licence: "NASA open data", url: "https://www.earthdata.nasa.gov/gibs" },
  { label: "Air-quality model", by: "Copernicus CAMS via Open-Meteo", licence: "CC BY 4.0", url: "https://atmosphere.copernicus.eu" },
];

export function AboutView() {
  return (
    <div>
      <PageHero
        sky={{ pm: 26, landmark: "vidhana", seed: 31 }}
        title={
          <>
            About <span className="text-gradient">AeroFusion</span>
          </>
        }
        subtitle="MW-AeroFusion-Net: Multi-Resolution Wavelet Adaptive Diffusion Graph ConvLSTM Transformer Network for Explainable PM2.5 Forecasting in India."
        aside={
          <GlassNote icon={<GraduationCap />}>
            Explainable air-quality
            <br />
            intelligence for India
          </GlassNote>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="The problem" icon={<BookOpen className="size-4" />} />
          <div className="space-y-3 text-[15px] leading-relaxed text-fg-muted">
            <p>
              Fine particulate matter (PM2.5) penetrates deep into the lungs and bloodstream. In India, its levels swing with crop-residue burning, winter inversions, traffic and
              industry — and they travel hundreds of kilometres between cities. Most forecasting tools are black boxes: a number without a reason.
            </p>
            <p>
              <b className="text-fg">MW-AeroFusion-Net</b> combines multi-resolution wavelets, an adaptive diffusion graph, ConvLSTM, a Transformer encoder and a causal attention gate to
              forecast PM2.5 1, 24 and 48 hours ahead — and to explain which sources drive each forecast.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { n: "3", t: "Good health", icon: <HeartPulse className="size-5" />, c: "#4c9f38" },
              { n: "11", t: "Sustainable cities", icon: <Building className="size-5" />, c: "#fd9d24" },
              { n: "13", t: "Climate action", icon: <ThermometerSun className="size-5" />, c: "#3f7e44" },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3">
                <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: s.c }}>
                  {s.icon}
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-fg-subtle">SDG {s.n}</div>
                  <div className="text-sm font-medium text-fg">{s.t}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader title="Team" subtitle="The people building AeroFusion" icon={<Users className="size-4" />} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {TEAM.map((m, i) => (
              <motion.div
                key={m.usn}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 font-display text-sm font-bold text-white">
                  {m.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-fg">{m.name}</div>
                  <div className="font-mono text-[11px] text-fg-subtle">{m.usn}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary-soft p-3.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-fg">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <div className="text-[11px] font-semibold text-primary">Mentor</div>
              <div className="text-sm font-semibold text-fg">Pallavi C V</div>
              <div className="text-xs text-fg-muted">Research mentor</div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader title="Integrity & data provenance" subtitle="What you are looking at, stated plainly" icon={<ShieldCheck className="size-4" />} />
          <ul className="space-y-3 text-[14px] leading-relaxed text-fg-muted">
            <li className="flex gap-3">
              <Badge tone="primary" className="mt-0.5 shrink-0">
                Live
              </Badge>
              <span>Current and forecast PM2.5 is the Copernicus CAMS model, with Open-Meteo weather, NASA FIRMS fires and NASA GIBS imagery, refreshed every 12 hours by the AeroFusion backend (or on demand with Refresh). CAMS is always labelled as CAMS.</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="primary" className="mt-0.5 shrink-0">
                Measured
              </Badge>
              <span>History and baselines are CPCB monitor measurements from the XKDR India Air Quality archive (558 stations, 2009–2026).</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="warn" className="mt-0.5 shrink-0">
                Not trained
              </Badge>
              <span>MW-AeroFusion-Net has not been trained yet, so no accuracy figures are shown anywhere. Model Lab shows the real training data and its readiness instead.</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="accent" className="mt-0.5 shrink-0">
                Scenarios
              </Badge>
              <span>The What-if simulator applies transparent, documented sensitivities on top of the live CAMS forecast. It is a sensitivity tool, not a model prediction.</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="neutral" className="mt-0.5 shrink-0">
                Proxies
              </Badge>
              <span>There is no free India-wide traffic feed; hour-of-week and festival indicators are used and documented as proxies.</span>
            </li>
          </ul>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader title="Technology" icon={<Code2 className="size-4" />} />
          <div className="space-y-3">
            {STACK.map((g) => (
              <div key={g.group}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{g.group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <span key={it} className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-xs text-fg">
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-12">
          <CardHeader title="Data & attribution" icon={<Scale className="size-4" />} />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ATTRIBUTION.map((a) => (
              <a key={a.label} href={a.url} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border bg-surface-2 p-3.5 transition hover:border-border-strong hover:shadow-card">
                <div className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Database className="size-4" />
                  </span>
                  <ExternalLink className="size-3.5 text-fg-subtle transition group-hover:text-primary" />
                </div>
                <div className="mt-2 text-sm font-semibold text-fg">{a.label}</div>
                <div className="text-xs text-fg-muted">{a.by}</div>
                <div className="mt-1 text-[11px] text-fg-subtle">{a.licence}</div>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
