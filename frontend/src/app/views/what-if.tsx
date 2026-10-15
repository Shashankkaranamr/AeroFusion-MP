import { useDeferredValue, useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Car, Construction, Droplets, Factory, RotateCcw, Thermometer, Wheat, Wind } from "lucide-react";
import { AqiBadge } from "@/components/aqi";
import { axis, ChartContainer, ChartLegend, ChartTooltipContent } from "@/components/charts/chart";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { SectionLabel, ViewHeader } from "@/components/view-header";
import { CityPicker } from "@/components/shell/header";
import { useLive } from "@/lib/api";
import { NAAQS_PM25_24H } from "@/lib/aqi";
import { fmtDay, fmtHour, fmtPct, fmtPop } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { PRESETS, runScenario, ZERO_SCENARIO, type ScenarioInput } from "@/lib/scenario";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const LEVERS: { key: keyof ScenarioInput; label: string; min: number; max: number; step: number; unit: string; icon: React.ReactNode; group: "Emissions" | "Weather" }[] = [
  { key: "vehicles", label: "Vehicles", min: -100, max: 50, step: 5, unit: "%", icon: <Car />, group: "Emissions" },
  { key: "industry", label: "Industry", min: -100, max: 50, step: 5, unit: "%", icon: <Factory />, group: "Emissions" },
  { key: "construction", label: "Construction & road dust", min: -100, max: 50, step: 5, unit: "%", icon: <Construction />, group: "Emissions" },
  { key: "cropBurning", label: "Crop burning", min: -100, max: 100, step: 5, unit: "%", icon: <Wheat />, group: "Emissions" },
  { key: "wind", label: "Wind", min: -2, max: 4, step: 0.5, unit: "m/s", icon: <Wind />, group: "Weather" },
  { key: "temperature", label: "Temperature", min: -5, max: 5, step: 0.5, unit: "°C", icon: <Thermometer />, group: "Weather" },
  { key: "humidity", label: "Humidity", min: -30, max: 30, step: 5, unit: "%RH", icon: <Droplets />, group: "Weather" },
];

const HORIZONS = [
  { value: "24", label: "24 h" },
  { value: "48", label: "48 h" },
  { value: "72", label: "72 h" },
  { value: "96", label: "96 h" },
];

export function WhatIfView() {
  const { snap } = useLive();
  const { city } = usePrefs();
  const [input, setInput] = useState<ScenarioInput>(ZERO_SCENARIO);
  const [preset, setPreset] = useState<string | null>(null);
  const [horizon, setHorizon] = useState("72");
  // Sliders stay at 60 fps; the forecast catches up a beat later (React › useDeferredValue).
  const deferred = useDeferredValue(input);
  const c = snap?.cities.find((x) => x.slug === city);
  const now = useMemo(() => Date.now(), [snap?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const res = useMemo(() => (c ? runScenario(c, now, Number(horizon), deferred) : null), [c, now, horizon, deferred]);
  if (!snap || !c || !res) return null;
  const s = res.summary;
  const touched = Object.values(input).some((v) => v !== 0);

  const set = (k: keyof ScenarioInput, v: number) => {
    setPreset(null);
    setInput((p) => ({ ...p, [k]: v }));
  };

  return (
    <div>
      <ViewHeader
        eyebrow="What if · illustrative heuristic on the live forecast"
        title={
          <>
            What would clear
            <br />
            <strong>{c.name}&rsquo;s air?</strong>
          </>
        }
        actions={
          <>
            <CityPicker />
            <Button
              variant="tinted"
              disabled={!touched}
              onClick={() => {
                sound.tick();
                setInput(ZERO_SCENARIO);
                setPreset(null);
              }}
            >
              <RotateCcw /> Reset
            </Button>
          </>
        }
      >
        Move the levers to change emissions or the weather. The CAMS forecast is the baseline; the scenario scales it by each sector's share of {c.name}'s particles.
      </ViewHeader>

      {/* Presets */}
      <SectionLabel>Policy presets</SectionLabel>
      <div className="no-scrollbar -mx-[var(--gutter)] mb-4 flex gap-3 overflow-x-auto px-[var(--gutter)] pb-1" role="radiogroup" aria-label="Policy presets">
        {PRESETS.map((p, k) => {
          const on = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                sound.tick();
                setPreset(on ? null : p.id);
                setInput(on ? ZERO_SCENARIO : p.input);
              }}
              className={cn("press card w-64 shrink-0 p-5 text-left transition-[background-color,box-shadow] duration-500 ease-[var(--ease-out)]", on ? "bg-surface-2 shadow-[inset_0_0_0_1px_var(--ink)]" : "hover:bg-surface-2 hover:shadow-[inset_0_0_0_1px_var(--line-2)]")}
            >
              <div className="tag flex items-center justify-between">
                <span className={cn(on && "text-ink")}>{String(k + 1).padStart(2, "0")}</span>
                <span className={cn("size-1.5 transition-colors", on ? "bg-ember" : "bg-line-2")} aria-hidden />
              </div>
              <div className="mt-5 text-[17px] font-normal tracking-[-0.02em] text-ink">{p.label}</div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{p.description}</p>
            </button>
          );
        })}
      </div>

      <SectionLabel>Your scenario</SectionLabel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* Levers */}
        <Card className="lg:sticky lg:top-[128px] lg:self-start">
          <CardHeader index={1} eyebrow="Levers" title="Change the inputs" />
          <CardBody className="grid gap-6">
            {(["Emissions", "Weather"] as const).map((g) => (
              <fieldset key={g} className="grid gap-4">
                <legend className="tag mb-3">{g}</legend>
                {LEVERS.filter((l) => l.group === g).map((l) => {
                  const v = input[l.key];
                  return (
                    <div key={l.key}>
                      <div className="mb-1.5 flex items-center gap-2 text-[13.5px]">
                        <span className="text-ink-2 [&_svg]:size-4" aria-hidden>
                          {l.icon}
                        </span>
                        <span className="text-ink">{l.label}</span>
                        <span className={cn("mono ml-auto text-[12.5px]", v === 0 ? "text-ink-3" : "text-ink")}>
                          {v > 0 ? "+" : v < 0 ? "−" : ""}
                          {Math.abs(v)}
                          {l.unit === "%" ? "%" : ` ${l.unit}`}
                        </span>
                      </div>
                      <Slider centered label={`${l.label}, change in ${l.unit}`} min={l.min} max={l.max} step={l.step} value={v} onValueChange={(x) => set(l.key, x)} />
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </CardBody>
        </Card>

        <div className="grid min-w-0 content-start gap-4">
          {/* Before → after */}
          <div className="grid grid-cols-2 gap-px bg-line shadow-[0_0_0_1px_var(--line)] xl:grid-cols-4">
            <Delta label="Average PM2.5" before={`${Math.round(s.avgBaseline)}`} after={`${Math.round(s.avgScenario)}`} unit="µg/m³" note={fmtPct(s.change)} good={s.change < 0} />
            <Card className="p-5 shadow-none">
              <div className="tag">AQI category</div>
              <div className="mt-3 grid gap-2">
                <AqiBadge pm={s.avgBaseline} className="w-fit" />
                <ArrowRight className="size-4 text-ink-3" aria-label="becomes" />
                <AqiBadge pm={s.avgScenario} className="w-fit" />
              </div>
            </Card>
            <Delta label="Unhealthy hours (>90)" before={`${s.unhealthyBaseline}`} after={`${s.unhealthyScenario}`} unit={`of ${res.series.length} h`} good={s.unhealthyScenario < s.unhealthyBaseline} note={s.unhealthyScenario === s.unhealthyBaseline ? "no change" : `${s.unhealthyScenario - s.unhealthyBaseline} h`} />
            <Delta label="People above the limit" before={fmtPop(s.exposedBaseline)} after={fmtPop(s.exposedScenario)} unit="avg over the hours" good={s.exposedScenario < s.exposedBaseline} note={s.exposedScenario === s.exposedBaseline ? "no change" : fmtPct(s.exposedBaseline ? ((s.exposedScenario - s.exposedBaseline) / s.exposedBaseline) * 100 : 0)} />
          </div>

          <Card>
            <CardHeader index={2} eyebrow={`${c.name} · next ${horizon} hours`} title="Baseline against your scenario" action={<Segmented size="sm" label="Horizon" value={horizon} onChange={setHorizon} options={HORIZONS} />} />
            <CardBody>
              <ChartContainer
                label={`PM2.5 baseline and scenario for ${c.name}`}
                className="h-[320px]"
                config={{ baseline: { label: "Baseline (CAMS)", color: "var(--ink-3)", unit: "µg/m³" }, scenario: { label: "Your scenario", color: "var(--ember)", unit: "µg/m³" } }}
              >
                <ComposedChart data={res.series} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--ember)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="lead" type="number" domain={[0, Number(horizon)]} tickFormatter={(v) => (v === 0 ? "now" : `+${v} h`)} {...axis} />
                  <YAxis {...axis} width={44} />
                  <ReferenceLine y={NAAQS_PM25_24H} strokeDasharray="4 4" label={{ value: "limit 60", position: "insideTopRight", fill: "var(--ink-3)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} />
                  <Tooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p[0]?.payload?.ms ? `${fmtDay(p[0].payload.ms as number)} · ${fmtHour(p[0].payload.ms as number)}` : "")} />} />
                  <Line type="monotone" dataKey="baseline" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="scenario" stroke="var(--ember)" strokeWidth={1.5} fill="url(#sc)" isAnimationActive={false} />
                </ComposedChart>
              </ChartContainer>
              <ChartLegend className="mt-3" items={[{ label: "Baseline (CAMS)", color: "var(--ink-3)", dashed: true }, { label: "Your scenario", color: "var(--ember)" }]} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader index={3} eyebrow={<>Average <span className="unit">µg/m³</span> by source</>} title="Where the change comes from">
              {c.name}'s fire share today is {Math.round(res.fireShare * 100)}%, from NASA's live count of fires upwind.
            </CardHeader>
            <CardBody>
              <ChartContainer label="PM2.5 contribution by sector, before and after" className="h-[260px]" config={{ base: { label: "Before", color: "var(--ink-3)", unit: "µg/m³" }, scen: { label: "After", color: "var(--ember)", unit: "µg/m³" } }}>
                <BarChart data={res.sectors} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid horizontal={false} strokeDasharray="2 4" />
                  <XAxis type="number" {...axis} />
                  <YAxis type="category" dataKey="label" {...axis} width={140} />
                  <Tooltip cursor={{ fill: "var(--press)" }} content={<ChartTooltipContent valueFormatter={(v) => v.toFixed(1)} />} />
                  <Bar dataKey="base" fill="var(--ink-3)" radius={0} barSize={9} isAnimationActive={false} />
                  <Bar dataKey="scen" fill="var(--ember)" radius={0} barSize={9} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
              <ChartLegend className="mt-3" items={[{ label: "Before", color: "var(--ink-3)" }, { label: "After", color: "var(--ember)" }]} />
              <SourceNote>
                An illustrative heuristic, not a model result or a chemistry simulation: sector shares are hand-set from published source-apportionment studies, and weather effects use simple dispersion rules. Use it to compare
                options, not to predict a number.
              </SourceNote>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Delta({ label, before, after, unit, note, good }: { label: string; before: string; after: string; unit: string; note: string; good: boolean }) {
  const same = before === after;
  return (
    <Card className="p-5 shadow-none">
      <div className="tag">{label}</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="num text-[1.75rem] text-ink-3 line-through decoration-1">{same ? "" : before}</span>
        <span className={cn("num text-[2.75rem]", same ? "text-ink" : good ? "text-good" : "text-bad")}>{after}</span>
      </div>
      <div className="mono mt-3 border-t border-line pt-2 text-[11px] text-ink-2">
        {unit} · <span className={cn(!same && (good ? "text-good" : "text-bad"))}>{note}</span>
      </div>
    </Card>
  );
}
