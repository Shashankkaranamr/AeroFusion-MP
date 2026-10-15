import type { ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { Figure, type FigureName } from "@/components/figure";
import { WindGraph } from "@/components/map/wind-graph";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { ConfirmIcon } from "@/components/ui/confirm-icon";
import { PulsatingLoader } from "@/components/ui/loader";
import { SectionTitle, ViewHeader } from "@/components/view-header";
import { useApi, useLive, type LiveSnapshot } from "@/lib/api";
import { CITY_BY_SLUG } from "@/lib/cities";
import { fmtAgo, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Archive {
  meta: { measurements: { rows: number; bytes: number; n_months: number; first_month: string; last_month: string }; stations: number; parameters: number };
  parameters: { parameter_name: string; unit: string; n_stations: number; n_rows: number; first_seen: string; last_seen: string }[];
}

/** The pipeline's four stages. Each is a Hairline figure standing for the stage (never its data). */
const STAGES: { fig: FigureName; step: string; title: string; text: string; alt: string }[] = [
  { fig: "dish", step: "01", title: "Sources", text: "Six feeds, fetched every 12 hours: the CAMS model, weather, NASA fire satellites and imagery, the CPCB archive, the calendar.", alt: "A dish antenna that follows the pointer, receiving" },
  { fig: "sieve", step: "02", title: "Fusion", text: "Every feed is cleaned, aligned to the same 33 cities and the same hours, and checked for gaps.", alt: "Stacked sieves, one lifting clear" },
  { fig: "terrain", step: "03", title: "Tensor", text: "One block of numbers: time × 33 cities × 20 features. Everything on this site reads from it.", alt: "A field of pillars rising around the pointer" },
  { fig: "relay", step: "04", title: "Explanation", text: "Statistics and a language model read the tensor and say, in words, what is driving the air.", alt: "A hub whose paths light up hop by hop" },
];

export function DataView() {
  const { snap } = useLive();
  const archive = useApi<Archive>("/api/archive");
  if (!snap) return null;
  const t = snap.tensor;
  const okCount = snap.sources.filter((s) => s.ok).length;
  const records = snap.sources.reduce((s, x) => s + x.records, 0);

  const live: Record<string, ReactNode> = {
    "01": `${okCount}/${snap.sources.length} healthy · ${fmtNum(records)} records`,
    "02": `${snap.cities.length} cities · fused in ${(snap.took_ms / 1000).toFixed(1)} s`,
    "03": `[${t.shape.join(" × ")}] · ${Math.round(t.coverage * 100)}% filled`,
    "04": "Spearman · Nova Micro → GPT-OSS",
  };

  return (
    <div>
      <ViewHeader
        eyebrow="Behind the data · system architecture"
        title={
          <>
            How AeroFusion knows
            <br />
            <strong>what it knows.</strong>
          </>
        }
      >
        Every number on this site comes through one pipeline, refreshed every 12 hours. Here is each step, what it holds right now, and what it can't do.
      </ViewHeader>

      {/* The pipeline diagram: four figures joined by hairlines that flow left to right. */}
      <Card className="overflow-hidden bg-[linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] bg-[size:32px_32px] p-5 sm:p-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div>
            <h2 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-light leading-none tracking-[-0.04em] text-ink">
              Unified data <span className="text-ink-3">pipeline</span>
            </h2>
            <div className="tag mt-4 flex flex-wrap gap-x-6 gap-y-1">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="size-1.5 bg-good" /> Live
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="size-1.5 bg-ink-2" /> Refreshed every 12 h
              </span>
            </div>
          </div>
          <div className="tag text-ink-3">Sources → explanation</div>
        </div>
        <ol className="grid grid-cols-1 items-stretch gap-0 lg:grid-cols-[1fr_40px_1fr_40px_1fr_40px_1fr]">
          {STAGES.map((s, i) => (
            <li key={s.step} className="contents">
              <div className="stagger flex flex-col bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow duration-500 ease-[var(--ease-out)] hover:shadow-[inset_0_0_0_1px_var(--ink)]" style={{ "--i": i } as React.CSSProperties}>
                <div className="tag flex items-center justify-between">
                  <span className="text-ink">{s.step}</span>
                  <span className="text-ink-3">Stage</span>
                </div>
                <Figure name={s.fig} label={s.alt} intensity={0.6} className="mx-auto mt-2 w-full max-w-[220px]" />
                <h3 className="mt-2 text-[19px] font-normal tracking-[-0.02em] text-ink">{s.title}</h3>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-2">{s.text}</p>
                <div className="mt-4 truncate bg-press px-2 py-1.5 text-center font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">{live[s.step]}</div>
              </div>
              {i < STAGES.length - 1 && <Connector />}
            </li>
          ))}
        </ol>
        <div className="tag mt-8 flex flex-wrap items-center justify-between gap-4 text-ink-3">
          <span>Hover a stage to inspect</span>
          <span aria-hidden className="flex gap-1.5">
            {STAGES.map((s) => (
              <span key={s.step} className="h-px w-5 bg-ink-3" />
            ))}
          </span>
        </div>
      </Card>

      <SectionTitle aside={<span className="tag">{okCount} of {snap.sources.length} healthy</span>}>The six sources</SectionTitle>
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {snap.sources.map((s, i) => (
          <Card key={s.id} i={i} className="p-5 sm:p-6">
            <div className="tag mb-5 flex items-center gap-2.5">
              <span className="text-ink">{String(i + 1).padStart(2, "0")}</span>
              <span aria-hidden className="h-px w-3 bg-line-2" />
              <span className={s.ok ? "text-good" : "text-bad"}>{s.ok ? "Healthy" : "Failed"}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className={cn("grid size-8 shrink-0 place-items-center shadow-[inset_0_0_0_1px_currentColor]", s.ok ? "text-good" : "text-bad")} aria-hidden>
                {s.ok ? <ConfirmIcon size={16} /> : <Circle className="size-3 fill-current" />}
              </span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-normal tracking-[-0.02em] text-ink">{s.name}</h3>
                <p className="text-[12.5px] text-ink-2">{s.provider}</p>
              </div>
              {s.key && <span className="chip ml-auto shrink-0">API key</span>}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{s.kind}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
              <Mini label="Records" value={fmtNum(s.records)} />
              <Mini label="Latency" value={`${fmtNum(s.latency_ms)} ms`} />
              <Mini label="Fetched" value={s.fetched_at ? fmtAgo(Date.parse(s.fetched_at)) : "—"} />
            </dl>
            {s.error && <p className="mt-3 bg-[color-mix(in_oklab,var(--bad)_8%,transparent)] px-3 py-2 font-mono text-[11.5px] text-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--bad)_40%,transparent)]">{s.error}</p>}
          </Card>
        ))}
      </div>

      {snap.gibs && (
        <>
          <SectionTitle aside={<span className="tag">NASA GIBS · {snap.gibs.layers[0]?.date}</span>}>India from orbit, yesterday</SectionTitle>
          <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-3">
            {snap.gibs.layers.map((l, i) => (
              <Card key={l.id} i={i} className="overflow-hidden">
                <div className="relative aspect-[900/940] bg-surface-3">
                  {l.transparent && <img src={snap.gibs!.layers.find((x) => x.id === "truecolor-modis")?.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-35 grayscale" />}
                  <img src={l.url} alt={`${l.title} over India`} loading="lazy" className="absolute inset-0 size-full object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="text-[15px] font-normal tracking-[-0.01em] text-ink">{l.title}</h3>
                  <p className="text-[12.5px] text-ink-2">{l.subtitle}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle aside={<span className="tag">{t.file}</span>}>The unified tensor</SectionTitle>
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card i={0}>
          <CardHeader eyebrow={`Shape [${t.shape.join(", ")}] · ${t.dims.join(" × ")}`} title="Today's slice: 33 cities × 20 features">
            Each cell is the latest value, scaled against the other cities. Empty cells are gaps the sources left.
          </CardHeader>
          <CardBody>
            <TensorGrid snap={snap} />
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader eyebrow={`${Math.round(t.coverage * 100)}% coverage`} title="The 20 features" />
          <CardBody>
            <ul className="grid max-h-[460px] gap-0 overflow-y-auto pr-1 text-[13px]">
              {t.features.map((f) => (
                <li key={f.key} className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-line py-2 last:border-0">
                  <span className="text-ink">{f.label}</span>
                  <span className="mono text-right text-[11.5px] text-ink-2">{f.unit || "—"}</span>
                  <span className="mono col-span-2 text-[11px] text-ink-3">
                    {f.key} · {f.source}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card i={0}>
          <CardHeader eyebrow="CPCB via XKDR" title="The station archive" />
          <CardBody>
            {archive.data ? (
              <>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Big label="Readings" value={`${(archive.data.meta.measurements.rows / 1e6).toFixed(0)} M`} />
                  <Big label="Stations" value={fmtNum(archive.data.meta.stations)} />
                  <Big label="Months" value={fmtNum(archive.data.meta.measurements.n_months)} />
                  <Big label="Size" value={`${(archive.data.meta.measurements.bytes / 1e9).toFixed(1)} GB`} />
                </dl>
                <p className="mt-4 text-[13px] text-ink-2">
                  {archive.data.meta.measurements.first_month} to {archive.data.meta.measurements.last_month}. Pollutants measured, by number of stations:
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                  {archive.data.parameters.slice(0, 12).map((p) => (
                    <li key={p.parameter_name} className="flex justify-between gap-2 text-[12.5px]">
                      <span className="text-ink">{p.parameter_name}</span>
                      <span className="mono text-ink-3">{p.n_stations}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : archive.error ? (
              <p className="text-sm text-ink-2">The archive service didn't answer ({archive.error}).</p>
            ) : (
              <PulsatingLoader label="Asking the archive" />
            )}
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader eyebrow="From today's winds" title="Who blows on whom">
            The strongest links: where the wind at one city points at another nearby. Hover a city.
          </CardHeader>
          <CardBody>
            <WindGraph snap={snap} className="mx-auto max-w-[460px]" />
          </CardBody>
        </Card>
      </div>

      <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card i={0}>
          <CardHeader eyebrow="Roadmap" title="Ready, and not yet" />
          <CardBody>
            <ul className="grid gap-2.5 text-[13.5px]">
              {[
                [true, "Six live sources, refreshed every 12 hours"],
                [true, "Fusion into one tensor for 33 cities"],
                [true, "AI insights and chat, with a fallback model"],
                [true, "CPCB station archive (196 million readings)"],
                [false, "Our own forecast model, trained on the tensor"],
                [false, "Measured accuracy against stations, published"],
                [false, "More cities, and hourly refresh"],
              ].map(([done, text]) => (
                <li key={String(text)} className="flex items-start gap-2.5">
                  <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center", done ? "bg-ink text-canvas" : "shadow-[inset_0_0_0_1px_var(--line-2)]")}>{done && <Check className="size-3" strokeWidth={3} />}</span>
                  <span className={done ? "text-ink" : "text-ink-2"}>{text}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader eyebrow="Honesty notes" title="What this can't tell you" />
          <CardBody>
            <ul className="grid gap-3 text-[13.5px] leading-relaxed text-ink-2">
              <li>
                <strong className="font-semibold text-ink">PM2.5 is modelled.</strong> Live values are Copernicus CAMS estimates on a ~40 km grid, not station readings. They smooth out local hotspots.
              </li>
              <li>
                <strong className="font-semibold text-ink">Source shares are estimates.</strong> The fire share comes from a simple rule on upwind fire counts; the rest uses published averages for Indian cities.
              </li>
              <li>
                <strong className="font-semibold text-ink">AI text can be wrong.</strong> It is written from today's numbers but can misread them. The charts are the record.
              </li>
              <li>
                <strong className="font-semibold text-ink">What if is a sensitivity model.</strong> It compares options; it doesn't predict.
              </li>
              <li>
                <strong className="font-semibold text-ink">No accuracy is claimed.</strong> We haven't trained or validated a forecast model of our own yet.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4 p-6 sm:p-8">
        <div className="tag mb-3">Credits and attributions</div>
        <div className="grid gap-x-10 gap-y-3 text-[13px] leading-relaxed text-ink-2 sm:grid-cols-2">
          <p>
            <strong className="font-semibold text-ink">Copernicus Atmosphere Monitoring Service</strong>, via Open-Meteo's air-quality API. Contains modified Copernicus information.
          </p>
          <p>
            <strong className="font-semibold text-ink">Open-Meteo</strong> weather (ECMWF and GFS), with MET Norway as a fallback. CC BY 4.0.
          </p>
          <p>
            <strong className="font-semibold text-ink">NASA FIRMS</strong> (VIIRS fire detections) and <strong className="font-semibold text-ink">NASA GIBS / Worldview</strong> imagery. We acknowledge NASA's EOSDIS.
          </p>
          <p>
            <strong className="font-semibold text-ink">CPCB CAAQMS</strong> station data via the <strong className="font-semibold text-ink">XKDR India Air Quality API</strong>.
          </p>
          <p>
            AI by <strong className="font-semibold text-ink">Amazon Nova Micro</strong> on Bedrock and <strong className="font-semibold text-ink">GPT-OSS</strong> on Groq.
          </p>
          <p>
            Line figures: <strong className="font-semibold text-ink">Hairline</strong> by Lucas Marques (MIT). Type: Inter, JetBrains Mono.
          </p>
        </div>
        <SourceNote>India's boundaries are shown as published by the Survey of India where available; city locations are approximate centres.</SourceNote>
      </Card>
    </div>
  );
}

/** A hairline that carries the flow from one stage to the next: right on a wide screen, down on a phone. */
function Connector() {
  return (
    <div aria-hidden className="flex items-center justify-center py-2 lg:py-0">
      <svg className="hidden h-6 w-10 lg:block" viewBox="0 0 40 24">
        <path d="M0 12 H40" stroke="var(--line-2)" strokeWidth="1" fill="none" />
        <path d="M0 12 H40" stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="4 10" className="motion-safe:animate-[flow_1.2s_linear_infinite]" fill="none" />
        <path d="M36 9 L40 12 L36 15" stroke="var(--ink)" strokeWidth="1" fill="none" />
      </svg>
      <svg className="h-10 w-6 lg:hidden" viewBox="0 0 24 40">
        <path d="M12 0 V40" stroke="var(--line-2)" strokeWidth="1" fill="none" />
        <path d="M12 0 V40" stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="4 10" className="motion-safe:animate-[flow_1.2s_linear_infinite]" fill="none" />
        <path d="M9 36 L12 40 L15 36" stroke="var(--ink)" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className="mono truncate text-[12.5px] text-ink">{value}</dd>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="tag">{label}</dt>
      <dd className="num mt-1 text-[1.9rem]">{value}</dd>
    </div>
  );
}

function TensorGrid({ snap }: { snap: LiveSnapshot }) {
  const t = snap.tensor;
  const color = (z: number | null) => {
    if (z === null) return "transparent";
    const a = Math.min(1, Math.abs(z) / 2.5);
    return z >= 0 ? `rgb(var(--ember-rgb) / ${0.1 + a * 0.8})` : `color-mix(in oklab, var(--moon) ${Math.round(10 + a * 68)}%, transparent)`;
  };
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="grid min-w-[640px] gap-[2px]" style={{ gridTemplateColumns: `7rem repeat(${t.features.length}, minmax(0,1fr))` }} role="img" aria-label="Heatmap of the tensor's latest slice: cities by features">
        <span />
        {t.features.map((f) => (
          <span key={f.key} title={f.label} className="truncate pb-1 text-center font-mono text-[9.5px] text-ink-3">
            {f.key.replace("_", " ").slice(0, 6)}
          </span>
        ))}
        {t.cities.map((slug, r) => (
          <div key={slug} className="contents">
            <span className="truncate pr-2 text-[11.5px] text-ink-2">{CITY_BY_SLUG[slug]?.name ?? slug}</span>
            {t.features.map((f, k) => {
              const z = t.z[r]?.[k] ?? null;
              return <span key={f.key} title={`${CITY_BY_SLUG[slug]?.name} · ${f.label}: ${z === null ? "missing" : `z ${z.toFixed(2)}`}`} className={cn("h-3.5 rounded-[1px]", z === null && "shadow-[inset_0_0_0_1px_var(--line-2)]")} style={{ background: color(z) }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
