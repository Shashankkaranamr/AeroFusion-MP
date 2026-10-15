import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChevronDown, RotateCw } from "lucide-react";
import { axis, ChartContainer, ChartLegend, ChartTooltipContent } from "@/components/charts/chart";
import { ModelPicker } from "@/components/shell/chat-drawer";
import { Figure } from "@/components/figure";
import { AttributionNote } from "@/components/model-status";
import { Button, InteractiveHoverButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { PulsatingLoader } from "@/components/ui/loader";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { InlineError, SectionLabel, SectionTitle, ViewHeader } from "@/components/view-header";
import { useLive, type LiveCity, type LiveSnapshot } from "@/lib/api";
import { categoryForPm } from "@/lib/aqi";
import { CITY_BY_SLUG } from "@/lib/cities";
import { fmtAgo } from "@/lib/format";
import { TONE, useInsights, type Insight } from "@/lib/insights";
import { citySeries, mean, spearman } from "@/lib/live";
import { usePrefs } from "@/lib/prefs";
import { href } from "@/lib/router";
import { cn } from "@/lib/utils";

/** Drivers we can test against PM2.5 across the 33 cities, with what a positive link would mean. */
const DRIVERS: { key: keyof LiveCity; label: string; unit: string }[] = [
  { key: "pblh", label: "Mixing height", unit: "m" },
  { key: "wind", label: "Wind speed", unit: "m/s" },
  { key: "rh", label: "Humidity", unit: "%" },
  { key: "temp", label: "Temperature", unit: "°C" },
  { key: "pressure", label: "Pressure", unit: "hPa" },
  { key: "fires_upwind", label: "Fires upwind", unit: "" },
  { key: "frp_300km", label: "Fire heat nearby", unit: "MW" },
  { key: "aod", label: "Aerosol depth", unit: "" },
  { key: "dust", label: "Dust", unit: "µg/m³" },
  { key: "no2", label: "NO₂", unit: "µg/m³" },
  { key: "co", label: "CO", unit: "µg/m³" },
];

const IST_HOUR = (ms: number) => (new Date(ms).getUTCHours() + 5 + (new Date(ms).getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;

export function WhyView() {
  const { snap } = useLive();
  const { provider, city } = usePrefs();
  const ins = useInsights(provider);
  const c = snap?.cities.find((x) => x.slug === city);
  if (!snap || !c) return null;
  const d = ins.data;

  return (
    <div>
      <ViewHeader
        eyebrow="Why · explainability"
        title={
          <>
            Why the air is
            <br />
            <strong>like this today.</strong>
          </>
        }
        actions={
          <>
            <ModelPicker />
            <Tip content="Ask the model to write a fresh set from the current data">
              <Button variant="tinted" onClick={ins.regenerate} disabled={ins.generating}>
                <RotateCw className={cn(ins.generating && "animate-spin")} /> Regenerate
              </Button>
            </Tip>
          </>
        }
      >
        A language model reads today's fused numbers and explains them. Under its cards, the same questions answered by plain statistics, so you can check it.
      </ViewHeader>

      {/* Status: what the AI is doing, honestly. */}
      <div className="mb-4 flex flex-wrap items-center gap-2" aria-live="polite">
        {ins.generating && <PulsatingLoader size={8} className="chip" label={`Writing new insights${d?.generating_for_s ? ` · ${Math.round(d.generating_for_s)} s` : ""}`} />}
        {d?.model && <span className="chip">By {d.model}</span>}
        {d?.updated_at && <span className="chip">Written {fmtAgo(Date.parse(d.updated_at))}</span>}
        {d?.stale && <span className="chip text-warn">From an earlier snapshot</span>}
      </div>
      {ins.error && (
        <div className="mb-4">
          <InlineError action={<Button size="sm" onClick={ins.regenerate}>Try again</Button>}>The AI couldn't write insights: {ins.error} The charts below don't depend on it.</InlineError>
        </div>
      )}

      {d?.headline && (
        <blockquote className="mb-8 mt-10 max-w-5xl border-l border-ink pl-6">
          <div className="tag mb-3">The model&rsquo;s headline</div>
          <p className="display text-[clamp(1.6rem,3vw,2.6rem)] leading-[1.12] text-ink">{d.headline}</p>
        </blockquote>
      )}

      <SectionLabel>Insights</SectionLabel>
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!d && !ins.error && [0, 1, 2].map((i) => <div key={i} className="card h-48 p-6"><div className="skeleton mb-3 h-4 w-1/3" /><div className="skeleton mb-2 h-5 w-3/4" /><div className="skeleton h-16 w-full" /></div>)}
        {d?.insights.map((x, i) => <InsightCard key={x.title + i} x={x} i={i} />)}
        {d && !d.insights.length && !ins.generating && (
          <Card className="col-span-full grid place-items-center gap-3 p-8 text-center">
            <Figure name="settle" label="Tiles settling into a tree" play className="w-48" />
            <p className="text-sm text-ink-2">No insights yet for this snapshot. Regenerate to ask the model now.</p>
          </Card>
        )}
      </div>

      <SectionTitle aside={<span className="tag hidden sm:block">Spearman rank correlation · 33 cities</span>}>What moves with PM2.5</SectionTitle>
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card i={0}>
          <CardHeader index={1} eyebrow="Across cities, right now" title="Drivers">
            Bars to the right: where this is higher, PM2.5 tends to be higher too. To the left: the opposite. Correlation, not cause.
          </CardHeader>
          <CardBody>
            <DriversChart snap={snap} />
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader index={2} eyebrow={`${c.name}, hour by hour`} title="Hourly drivers">
            The same test across {c.name}'s hourly series, from two days ago to four days ahead.
          </CardHeader>
          <CardBody>
            <HourlyDrivers c={c} />
          </CardBody>
        </Card>
      </div>

      <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <ScatterCard snap={snap} />
        <Card i={1}>
          <CardHeader index={4} eyebrow="India time" title="The daily cycle">
            Average PM2.5 by hour of day. Nights trap particles under a low ceiling; afternoon sun lifts it.
          </CardHeader>
          <CardBody>
            <DailyCycle snap={snap} c={c} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader index={5} eyebrow="Unified tensor · z-scores" title="How unusual each city is today">
          Each cell compares a city with the other 32: ember is well above the average, blue well below.
        </CardHeader>
        <CardBody>
          <ZHeat snap={snap} />
        </CardBody>
      </Card>

      <AttributionNote />

      <Card className="mt-4 overflow-hidden">
        <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <div className="tag mb-4">Streamed · grounded in this snapshot</div>
            <h2 className="display text-[clamp(2rem,3.4vw,3rem)]">
              Still wondering <strong>why?</strong>
            </h2>
            <p className="mt-3 max-w-xl text-[14.5px] text-ink-2">Ask in your own words. The answer streams in as the model writes it, using only today's data.</p>
          </div>
          <InteractiveHoverButton text="Ask the data" className="md:w-64" onClick={() => window.dispatchEvent(new Event("aerofusion:ask"))} />
        </div>
      </Card>
    </div>
  );
}

function InsightCard({ x, i }: { x: Insight; i: number }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[x.tone] ?? TONE.info;
  const cities = (x.cities ?? []).map((n) => Object.values(CITY_BY_SLUG).find((c) => c.name.toLowerCase() === n.toLowerCase()));
  return (
    <Card i={i} className="flex flex-col p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="tag text-ink">{String(i + 1).padStart(2, "0")}</span>
        <span aria-hidden className="h-px w-3 bg-line-2" />
        <span className="size-1.5" style={{ background: tone.color }} aria-hidden />
        <span className="tag">{tone.label}</span>
        {x.confidence && <span className="tag ml-auto text-ink-3">{x.confidence} confidence</span>}
      </div>
      <h3 className="text-[20px] font-normal leading-tight tracking-[-0.025em] text-ink">{x.title}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{x.finding}</p>
      {x.cities?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {x.cities.map((n, k) =>
            cities[k] ? (
              <a key={n} href={href("city", cities[k]!.slug)} className="chip press hover:bg-press-2 hover:text-ink">
                {n}
              </a>
            ) : (
              <span key={n} className="chip">
                {n}
              </span>
            ),
          )}
        </div>
      ) : null}
      {x.reasoning && (
        <div className="mt-auto pt-5">
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="press inline-flex items-center gap-1.5 border-t border-line pt-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2 hover:text-ink">
            <ChevronDown className={cn("size-3.5 transition-transform duration-500 ease-[var(--ease-out)]", open && "rotate-180")} /> {open ? "Hide the reasoning" : "Show the reasoning"}
          </button>
          <div className="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out)]" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
            <p className="overflow-hidden text-[13.5px] leading-relaxed text-ink-2">
              <span className="block pt-2">{x.reasoning}</span>
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function corrColor(r: number) {
  return r >= 0 ? "var(--ember)" : "var(--moon)";
}

function DriversChart({ snap }: { snap: LiveSnapshot }) {
  const data = useMemo(
    () =>
      DRIVERS.map((d) => ({ label: d.label, r: spearman(snap.cities.map((c) => c.pm25), snap.cities.map((c) => c[d.key] as number | null)) }))
        .filter((x): x is { label: string; r: number } => x.r !== null)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r)),
    [snap],
  );
  return <CorrBars data={data} label="Rank correlation of PM2.5 with each driver across 33 cities" />;
}

function CorrBars({ data, label }: { data: { label: string; r: number }[]; label: string }) {
  return (
    <ChartContainer label={label} className="h-[330px]" config={{ r: { label: "Correlation ρ", color: "var(--ink)" } }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="2 4" />
        <XAxis type="number" domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} {...axis} />
        <YAxis type="category" dataKey="label" {...axis} width={118} />
        <ReferenceLine x={0} stroke="var(--line-2)" />
        <Tooltip cursor={{ fill: "var(--press)" }} content={<ChartTooltipContent valueFormatter={(v) => v.toFixed(2)} />} />
        <Bar dataKey="r" barSize={12} radius={0} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={corrColor(d.r)} fillOpacity={0.35 + Math.abs(d.r) * 0.65} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function HourlyDrivers({ c }: { c: LiveCity }) {
  const data = useMemo(() => {
    const pts = citySeries(c);
    const pm = pts.map((p) => p.pm25);
    const rows: [string, (number | null)[]][] = [
      ["Mixing height", pts.map((p) => p.pblh)],
      ["Wind speed", pts.map((p) => p.wind)],
      ["Humidity", pts.map((p) => p.rh)],
      ["Temperature", pts.map((p) => p.temp)],
      ["Aerosol depth", pts.map((p) => p.aod)],
      ["PM10", pts.map((p) => p.pm10)],
    ];
    return rows
      .map(([label, xs]) => ({ label, r: spearman(pm, xs) }))
      .filter((x): x is { label: string; r: number } => x.r !== null)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }, [c]);
  return <CorrBars data={data} label={`Rank correlation of PM2.5 with each driver over ${c.name}'s hourly series`} />;
}

function ScatterCard({ snap }: { snap: LiveSnapshot }) {
  const [key, setKey] = useState<keyof LiveCity>("pblh");
  const d = DRIVERS.find((x) => x.key === key)!;
  const data = snap.cities.filter((c) => c.pm25 != null && c[key] != null).map((c) => ({ x: c[key] as number, y: c.pm25 as number, name: c.name, fill: categoryForPm(c.pm25!).color }));
  const r = spearman(data.map((p) => p.y), data.map((p) => p.x));
  return (
    <Card i={0}>
      <CardHeader index={3} eyebrow={`ρ = ${r === null ? "—" : r.toFixed(2)}`} title={`PM2.5 against ${d.label.toLowerCase()}`} />
      <CardBody>
        <Segmented
          size="sm"
          label="Driver"
          value={key as string}
          onChange={(v) => setKey(v as keyof LiveCity)}
          options={DRIVERS.slice(0, 6).map((x) => ({ value: x.key as string, label: x.label }))}
          className="mb-4"
        />
        <ChartContainer label={`Scatter of PM2.5 against ${d.label} for 33 cities`} className="h-[280px]" config={{ x: { label: d.label, color: "var(--ink)", unit: d.unit }, y: { label: "PM2.5", color: "var(--ember)", unit: "µg/m³" } }}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="2 4" />
            <XAxis type="number" dataKey="x" name={d.label} {...axis} />
            <YAxis type="number" dataKey="y" name="PM2.5" {...axis} width={44} />
            <ZAxis range={[70, 70]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent labelFormatter={(_, p) => String(p[0]?.payload?.name ?? "")} />} />
            <Scatter data={data} isAnimationActive={false}>
              {data.map((p) => (
                <Cell key={p.name} fill={p.fill} stroke="var(--surface)" strokeWidth={1.5} />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </CardBody>
    </Card>
  );
}

function DailyCycle({ snap, c }: { snap: LiveSnapshot; c: LiveCity }) {
  const data = useMemo(() => {
    const by = (cities: LiveCity[]) => {
      const bins: number[][] = Array.from({ length: 24 }, () => []);
      for (const city of cities) for (const p of citySeries(city)) if (p.pm25 != null) bins[IST_HOUR(p.ms)].push(p.pm25);
      return bins.map((b) => mean(b));
    };
    const all = by(snap.cities);
    const one = by([c]);
    return all.map((v, h) => ({ h, national: v, city: one[h] }));
  }, [snap, c]);
  return (
    <>
      <ChartContainer label={`Average PM2.5 by hour of day for ${c.name} and all cities`} className="h-[250px]" config={{ city: { label: c.name, color: "var(--ember)", unit: "µg/m³" }, national: { label: "All 33 cities", color: "var(--moon)", unit: "µg/m³" } }}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="h" ticks={[0, 6, 12, 18, 23]} tickFormatter={(h) => (h === 0 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`)} {...axis} />
          <YAxis {...axis} width={44} />
          <Tooltip content={<ChartTooltipContent labelFormatter={(h) => `${Number(h) % 12 || 12} ${Number(h) < 12 ? "AM" : "PM"} IST`} />} />
          <Line type="monotone" dataKey="national" stroke="var(--moon)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="city" stroke="var(--ember)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>
      <ChartLegend className="mt-3" items={[{ label: c.name, color: "var(--ember)" }, { label: "All 33 cities", color: "var(--moon)", dashed: true }]} />
    </>
  );
}

const Z_FEATURES = ["pm25", "pm10", "aod", "dust", "no2", "co", "temp", "rh", "wind", "pblh", "fires_upwind", "frp_300km"];

function ZHeat({ snap }: { snap: LiveSnapshot }) {
  const t = snap.tensor;
  const cols = Z_FEATURES.map((k) => ({ k, i: t.features.findIndex((f) => f.key === k), label: t.features.find((f) => f.key === k)?.label.replace(/\s*\(.*\)/, "") ?? k })).filter((c) => c.i >= 0);
  const rows = t.cities
    .map((slug, r) => ({ slug, name: CITY_BY_SLUG[slug]?.name ?? slug, z: t.z[r] ?? [] }))
    .sort((a, b) => (b.z[cols[0].i] ?? 0) - (a.z[cols[0].i] ?? 0));
  const color = (z: number | null) => {
    if (z === null) return "transparent";
    const a = Math.min(1, Math.abs(z) / 2.5);
    return z >= 0 ? `rgb(var(--ember-rgb) / ${0.08 + a * 0.82})` : `color-mix(in oklab, var(--moon) ${Math.round(8 + a * 70)}%, transparent)`;
  };
  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-[2px] text-[11.5px]">
        <caption className="sr-only">Z-scores of each feature for each city</caption>
        <thead>
          <tr>
            <th className="w-28" />
            {cols.map((c) => (
              <th key={c.k} scope="col" className="h-16 px-1 pb-1 align-bottom font-mono font-normal text-ink-3">
                <span className="block origin-bottom-left translate-x-3 -rotate-45 whitespace-nowrap">{c.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug}>
              <th scope="row" className="truncate pr-2 text-left font-normal text-ink-2">
                <a href={href("city", r.slug)} className="hover:text-ink">
                  {r.name}
                </a>
              </th>
              {cols.map((c) => {
                const z = r.z[c.i] ?? null;
                return (
                  <td key={c.k} title={`${r.name} · ${c.label}: z = ${z === null ? "—" : z.toFixed(2)}`} className="h-5 rounded-[1px] text-center font-mono text-[10px] text-transparent hover:text-ink" style={{ background: color(z) }}>
                    {z === null ? "" : z.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote>Hover a cell for its value. z = how many standard deviations a city sits from the 33-city average for that feature.</SourceNote>
    </div>
  );
}
