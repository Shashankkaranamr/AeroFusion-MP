"use client";

import { ArrowRight, Boxes, CheckCircle2, Circle, Database, GitBranch, Layers, Loader2, Network, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { LiveGate, SourceNote } from "@/components/live/live-gate";
import { PageHero } from "@/components/layout/page-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { Skeleton } from "@/components/ui/primitives";
import { Stagger, StaggerItem } from "@/components/ui/reveal";
import { useAppStore } from "@/hooks/use-app-store";
import { useApi, type LiveSnapshot } from "@/hooks/use-live";
import { categoryForPm } from "@/lib/aqi";
import { fmtIst, windGraph } from "@/lib/live";
import { cn } from "@/lib/utils";

interface Archive {
  meta: { measurements: { rows: number; bytes: number; n_months: number; first_month: string; last_month: string }; stations: number; parameters: number };
  parameters: { parameter_name: string; unit: string; n_stations: number; n_rows: number; first_seen: string; last_seen: string }[];
}

interface TensorInfo {
  exists: boolean;
  shape?: number[];
  timestamps?: string[];
  features?: string[];
  coverage_per_feature?: number[];
  size_kb?: number;
}

const fmtBig = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export function ModelLabView() {
  return (
    <div>
      <PageHero
        title={
          <>
            Model <span className="text-gradient">Lab</span>
          </>
        }
        subtitle="What MW-AeroFusion-Net will learn from: the measured CPCB archive, the live unified tensor and the wind-driven city graph. No accuracy numbers are shown until a real training run produces them."
      />
      <LiveGate>{(s) => <Body snap={s} />}</LiveGate>
    </div>
  );
}

function Body({ snap }: { snap: LiveSnapshot }) {
  const archive = useApi<Archive>("/api/archive");
  const tensor = useApi<TensorInfo>(`/api/tensor?v=${snap.refresh_count}`);
  const a = archive.data;
  const t = tensor.data;
  const pm = a?.parameters.find((p) => p.parameter_name === "PM2.5");

  const steps: { label: string; detail: string; state: "done" | "doing" | "todo" }[] = [
    { label: "Live ingestion from 6 sources", detail: `${snap.sources.filter((s) => s.ok).length}/${snap.sources.length} online · every ${Math.round(snap.interval_s / 60)} min`, state: "done" },
    { label: "Unified spatio-temporal tensor", detail: `${snap.tensor.shape.join(" × ")} (time × city × feature), saved on every refresh`, state: "done" },
    { label: "Ground-truth archive access", detail: a ? `${fmtBig(a.meta.measurements.rows)} CPCB rows, ${a.meta.measurements.first_month} → ${a.meta.measurements.last_month}` : "CPCB via XKDR", state: a ? "done" : "doing" },
    { label: "Historical backfill of inputs", detail: "CAMS reanalysis + ERA5 weather + FIRMS archive aligned to the CPCB hours (2019–2024)", state: "doing" },
    { label: "Train MW-AeroFusion-Net", detail: "Wavelet + graph + ConvLSTM + causal-attention, pinball loss for P10/P50/P90", state: "todo" },
    { label: "Evaluate on held-out 2024", detail: "MAE / RMSE / CRPS by horizon vs CAMS and persistence", state: "todo" },
    { label: "Serve forecasts in the dashboards", detail: "Replaces the CAMS line on Forecast with AeroFusion + uncertainty bands", state: "todo" },
  ];
  const done = steps.filter((s) => s.state === "done").length;

  return (
    <>
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <Kpi icon={<Database />} label="Ground-truth rows (CPCB)" value={a ? fmtBig(a.meta.measurements.rows) : undefined} tint="#38bdf8" footer={a && <span>{a.meta.stations} stations · {a.meta.parameters} pollutants</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Layers />} label="PM2.5 label rows" value={pm ? fmtBig(pm.n_rows) : undefined} tint="#f59e0b" footer={pm && <span>{pm.n_stations} stations since {pm.first_seen.slice(0, 4)}</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<Boxes />} label="Live tensor" value={t?.shape ? t.shape.join(" × ") : undefined} tint="#a78bfa" footer={t?.size_kb !== undefined && <span>{t.timestamps?.length ?? 0} snapshots · {t.size_kb} KB</span>} />
        </StaggerItem>
        <StaggerItem>
          <Kpi icon={<ShieldCheck />} label="Model status" value="Not trained" tint="#fb923c" footer={<span>{done} of {steps.length} pipeline steps complete</span>} />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Road to a trained model" subtitle="Honest status of each stage" icon={<GitBranch className="size-4" />} />
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-sunken">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(done / steps.length) * 100}%` }} transition={{ duration: 0.9 }} className="h-full rounded-full bg-gradient-to-r from-teal-400 to-sky-400" />
          </div>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex gap-3 rounded-2xl bg-surface-sunken p-3">
                {s.state === "done" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                ) : s.state === "doing" ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-300 [animation-duration:2.5s]" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                )}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-fg">{s.label}</div>
                  <div className="text-xs text-fg-muted">{s.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader title="Ground-truth archive" subtitle="Measured CPCB CAAQMS + US Embassy data, India Air Quality API (XKDR)" icon={<Database className="size-4" />} action={a && <Badge tone="primary">{(a.meta.measurements.bytes / 1e6).toFixed(0)} MB</Badge>} />
          {a ? <ArchiveTable rows={a.parameters} /> : archive.error ? <div className="text-sm text-amber-200">Archive unavailable: {archive.error}</div> : <Skeleton className="h-[320px]" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <WindGraph snap={snap} />
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Model inputs" subtitle="The 20 features in every tensor slice, with live coverage" icon={<Layers className="size-4" />} />
          {t?.features ? <Coverage snap={snap} features={t.features} coverage={t.coverage_per_feature ?? []} /> : <Skeleton className="h-[360px]" />}
          {t?.timestamps && t.timestamps.length > 0 && (
            <div className="mt-3 text-[11px] text-fg-muted">
              Tensor window: {fmtIst(Date.parse(t.timestamps[0]), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} →{" "}
              {fmtIst(Date.parse(t.timestamps[t.timestamps.length - 1]), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} IST
            </div>
          )}
        </Card>
      </div>
      <SourceNote>
        Everything on this page is read from the running backend: archive metadata from the XKDR India Air Quality API, the tensor from <code>backend/data/processed/live_tensor.npz</code>, and graph weights from the current
        Open-Meteo winds. Accuracy, ablation and training-curve panels will return once real runs exist.
      </SourceNote>
    </>
  );
}

function ArchiveTable({ rows }: { rows: Archive["parameters"] }) {
  const max = Math.max(...rows.map((r) => r.n_rows));
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle [&>th]:px-2 [&>th]:pb-2">
            <th>Pollutant</th>
            <th>Rows</th>
            <th className="text-right">Stations</th>
            <th className="text-right">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.parameter_name} className={cn("border-t border-border [&>td]:px-2 [&>td]:py-2", r.parameter_name === "PM2.5" && "bg-primary-soft")}>
              <td>
                <div className="font-medium text-fg">{r.parameter_name}</div>
                <div className="text-[10px] text-fg-subtle">{r.unit}</div>
              </td>
              <td className="w-[40%]">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div className="h-full rounded-full bg-sky-400" style={{ width: `${(r.n_rows / max) * 100}%` }} />
                  </div>
                  <span className="font-num w-12 text-right text-xs text-fg-muted">{fmtBig(r.n_rows)}</span>
                </div>
              </td>
              <td className="font-num text-right text-fg-muted">{r.n_stations}</td>
              <td className="font-num text-right text-xs text-fg-muted">
                {r.first_seen.slice(0, 4)}–{r.last_seen.slice(0, 7)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Coverage({ snap, features, coverage }: { snap: LiveSnapshot; features: string[]; coverage: number[] }) {
  const meta = Object.fromEntries(snap.tensor.features.map((f) => [f.key, f]));
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
      {features.map((k, i) => {
        const f = meta[k];
        const cov = coverage[i] ?? 0;
        return (
          <div key={k} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-fg">{f?.label ?? k}</div>
              <div className="truncate text-[10px] text-fg-subtle">{f?.source ?? ""}</div>
            </div>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken">
              <div className={cn("h-full rounded-full", cov > 0.95 ? "bg-emerald-400" : cov > 0.7 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${cov * 100}%` }} />
            </div>
            <span className="font-num w-9 text-right text-[11px] text-fg-muted">{Math.round(cov * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function WindGraph({ snap }: { snap: LiveSnapshot }) {
  const setCity = useAppStore((s) => s.setCity);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const cities = useMemo(() => [...snap.cities].sort((a, b) => a.lon - b.lon), [snap]);
  const { W, edges } = useMemo(() => windGraph(cities), [cities]);
  const n = cities.length;
  const max = Math.max(...W.flat(), 1e-6);
  const size = 330;
  const cell = size / n;
  return (
    <>
      <CardHeader
        title="City graph from live winds"
        subtitle="Directed weights: how strongly air at one city is carried toward another right now (distance × wind alignment × wind speed). The graph module starts from this prior."
        icon={<Network className="size-4" />}
      />
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="shrink-0">
          <svg width={size} height={size} className="rounded-xl bg-black/20" onMouseLeave={() => setHover(null)}>
            {W.map((row, i) =>
              row.map((w, j) =>
                w > 0 ? (
                  <rect
                    key={`${i}-${j}`}
                    x={j * cell}
                    y={i * cell}
                    width={cell - 0.5}
                    height={cell - 0.5}
                    fill="#2dd4bf"
                    fillOpacity={0.15 + 0.85 * (w / max)}
                    onMouseEnter={() => setHover([i, j])}
                  />
                ) : null,
              ),
            )}
            {Array.from({ length: n }, (_, i) => (
              <rect key={i} x={i * cell} y={i * cell} width={cell - 0.5} height={cell - 0.5} fill="rgba(255,255,255,0.08)" />
            ))}
          </svg>
          <div className="mt-1.5 flex justify-between text-[10px] text-fg-subtle" style={{ width: size }}>
            <span>rows: source city (west → east)</span>
            <span>cols: receiving city</span>
          </div>
          <div className="mt-1 h-5 text-xs text-fg">
            {hover ? (
              <>
                {cities[hover[0]].name} → {cities[hover[1]].name} · <b className="font-num">{W[hover[0]][hover[1]].toFixed(2)}</b>
              </>
            ) : (
              <span className="text-fg-muted">Hover a cell</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Strongest transport links now</div>
          <div className="space-y-1.5">
            {edges.slice(0, 9).map((e) => (
              <button key={`${e.from.slug}-${e.to.slug}`} onClick={() => setCity(e.to.slug)} className="flex w-full items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-left">
                <span className="size-2 rounded-full" style={{ background: categoryForPm(e.from.pm25 ?? 0).color }} />
                <span className="truncate text-[13px] font-medium text-fg">{e.from.name}</span>
                <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" />
                <span className="truncate text-[13px] font-medium text-fg">{e.to.name}</span>
                <span className="font-num ml-auto shrink-0 text-[11px] text-fg-muted">
                  {Math.round(e.km)} km · <b className="text-fg">{e.w.toFixed(2)}</b>
                </span>
              </button>
            ))}
            {!edges.length && <div className="text-sm text-fg-muted">Winds are too light for meaningful transport right now.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
