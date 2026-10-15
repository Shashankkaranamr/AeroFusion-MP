import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { FileJson, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { axis, ChartContainer, ChartLegend, ChartTooltipContent } from "@/components/charts/chart";
import { CityPicker } from "@/components/shell/header";
import { Figure } from "@/components/figure";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { ConfirmIcon } from "@/components/ui/confirm-icon";
import { PulsatingLoader } from "@/components/ui/loader";
import { InlineError, SectionLabel, SectionTitle, ViewHeader } from "@/components/view-header";
import { useApi } from "@/lib/api";
import { categoryForPm, NAAQS_PM25_24H } from "@/lib/aqi";
import { CITY_BY_SLUG } from "@/lib/cities";
import { fmtDate } from "@/lib/format";
import { fmtPeriod, mean, type AllHistory, type CityHistory } from "@/lib/live";
import { usePrefs } from "@/lib/prefs";
import { sound } from "@/lib/sound";
import { cn, downloadFile } from "@/lib/utils";

const PALETTE = ["var(--ember)", "var(--moon)", "var(--lamp)", "var(--clinical)"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m: string) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

export function HistoryView() {
  const { city } = usePrefs();
  const one = useApi<CityHistory>(`/api/history/${city}`);
  const all = useApi<AllHistory>("/api/history");
  const name = CITY_BY_SLUG[city]?.name ?? city;
  const [compare, setCompare] = useState<string[]>(["delhi", "mumbai", "kolkata"]);
  const [saved, setSaved] = useState<string | null>(null);

  const h = one.data;
  const worst = useMemo(() => (h?.days.length ? h.days.reduce((m, d) => (d.pm25 > m.pm25 ? d : m)) : null), [h]);
  const best = useMemo(() => (h?.days.length ? h.days.reduce((m, d) => (d.pm25 < m.pm25 ? d : m)) : null), [h]);
  const over = h?.days.filter((d) => d.pm25 > NAAQS_PM25_24H).length ?? 0;

  const save = (kind: "csv" | "json" | "md") => {
    if (!h) return;
    sound.tick();
    const base = `aerofusion-${city}-cpcb`;
    if (kind === "json") downloadFile(`${base}.json`, JSON.stringify(h, null, 2), "application/json");
    if (kind === "csv")
      downloadFile(
        `${base}.csv`,
        ["kind,period,pm25_ugm3,stations", ...h.months.map((m) => `month,${m.month},${m.pm25.toFixed(1)},${m.stations}`), ...h.days.map((d) => `day,${d.date},${d.pm25.toFixed(1)},${d.stations}`)].join("\n"),
        "text/csv",
      );
    if (kind === "md")
      downloadFile(
        `${base}.md`,
        [
          `# ${name} — CPCB PM2.5 history`,
          "",
          `Source: CPCB CAAQMS via the XKDR India Air Quality API. ${h.stations.length} stations.`,
          "",
          `- Worst day of 2024: ${worst ? `${worst.date}, ${worst.pm25.toFixed(0)} µg/m³` : "—"}`,
          `- Days above the 24-hour limit (60) in 2024: ${over} of ${h.days.length}`,
          "",
          "| Month | PM2.5 (µg/m³) | Stations |",
          "|---|---:|---:|",
          ...h.months.map((m) => `| ${m.month} | ${m.pm25.toFixed(1)} | ${m.stations} |`),
        ].join("\n"),
        "text/markdown",
      );
    setSaved(kind);
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div>
      <ViewHeader
        eyebrow="History · CPCB stations, 2022–2024"
        title={
          <>
            What {name}
            <br />
            <strong>has been breathing.</strong>
          </>
        }
        actions={
          <>
            <CityPicker />
            <Button variant="tinted" onClick={() => window.print()} className="no-print">
              <Printer /> Print
            </Button>
          </>
        }
      >
        Measured, not modelled: daily averages from the Central Pollution Control Board's ground stations.
      </ViewHeader>

      {one.loading && <PulsatingLoader label="Reading the station archive" className="py-10" />}
      {one.error && (
        <Card className="grid justify-items-center gap-3 p-10 text-center">
          <Figure name="basket" label="An empty wire basket" className="w-44" />
          <p className="max-w-md text-sm text-ink-2">The CPCB archive has no station history for {name}. Pick another city, or compare cities below.</p>
        </Card>
      )}

      {h && (
        <>
          <SectionLabel className="mt-0">2024 in four numbers</SectionLabel>
          <div className="stagger grid grid-cols-2 gap-px bg-line shadow-[0_0_0_1px_var(--line)] lg:grid-cols-4">
            <Fact i={0} label="Worst day, 2024" value={worst ? Math.round(worst.pm25) : null} unit="µg/m³" note={worst ? fmtDate(Date.parse(worst.date)) : ""} ember />
            <Fact i={1} label="Cleanest day, 2024" value={best ? Math.round(best.pm25) : null} unit="µg/m³" note={best ? fmtDate(Date.parse(best.date)) : ""} />
            <Fact i={2} label="Days over the limit" value={over} unit={`of ${h.days.length}`} note={`${Math.round((over / Math.max(1, h.days.length)) * 100)}% of 2024`} />
            <Fact i={3} label="2024 average" value={Math.round(mean(h.days.map((d) => d.pm25)) ?? 0)} unit="µg/m³" note={`${h.stations.length} stations`} />
          </div>

          <SectionLabel>Every day, measured</SectionLabel>
          <Card>
            <CardHeader index={1} eyebrow="Every day of 2024" title="The year, day by day" action={<span className="tag hidden sm:block">colour = AQI category</span>} />
            <CardBody>
              <Calendar days={h.days} />
            </CardBody>
          </Card>

          <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card i={0}>
              <CardHeader index={2} eyebrow="Monthly mean" title={`${name} against all cities`} />
              <CardBody>
                <MonthlyChart h={h} all={all.data} name={name} />
              </CardBody>
            </Card>
            <Card i={1}>
              <CardHeader index={3} eyebrow={`${h.stations.length} stations`} title="Where it was measured" />
              <CardBody>
                <ul className="grid max-h-[280px] gap-1 overflow-y-auto pr-2 text-[13px]">
                  {h.stations.map((s) => (
                    <li key={s} className="flex items-center gap-2 border-b border-line py-1.5 text-ink-2 last:border-0">
                      <span className="size-1 bg-ink-3" aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(
                    [
                      ["csv", "CSV", <FileSpreadsheet key="c" />],
                      ["json", "JSON", <FileJson key="j" />],
                      ["md", "Markdown", <FileText key="m" />],
                    ] as const
                  ).map(([k, label, icon]) => (
                    <Button key={k} size="sm" variant="tinted" onClick={() => save(k)}>
                      {saved === k ? <ConfirmIcon className="text-good" /> : icon} {saved === k ? "Saved" : label}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <SectionTitle>Compare cities</SectionTitle>
      <Card>
        <CardHeader index={4} eyebrow="Monthly mean, 2022–2024" title="Pick up to four" />
        <CardBody>
          {all.data ? (
            <Compare all={all.data} picked={compare} setPicked={setCompare} />
          ) : all.error ? (
            <InlineError>The archive didn't answer: {all.error}</InlineError>
          ) : (
            <PulsatingLoader label="Loading every city's history" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Fact({ label, value, unit, note, ember, i }: { label: string; value: number | null; unit: string; note: string; ember?: boolean; i: number }) {
  return (
    <Card i={i} className="flex flex-col justify-between gap-8 p-5 shadow-none sm:p-6">
      <div className="tag flex items-start justify-between gap-3">
        <span>{label}</span>
        <span className="text-ink-3">{String(i + 1).padStart(2, "0")}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-2.5">
          <span className={cn("num text-[clamp(2.75rem,4.4vw,3.75rem)]", ember && "text-ember-ink")}>{value ?? "—"}</span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">{unit}</span>
        </div>
        <div className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-2">{note}</div>
      </div>
    </Card>
  );
}

/** A year of days as weeks × weekdays, coloured by AQI category (the label is in each cell's title). */
function Calendar({ days }: { days: { date: string; pm25: number }[] }) {
  const byDate = new Map(days.map((d) => [d.date, d.pm25]));
  const year = days[0]?.date.slice(0, 4) ?? "2024";
  const start = new Date(`${year}-01-01T00:00:00Z`);
  const lead = start.getUTCDay(); // empty cells before 1 Jan
  const cells: ({ date: string; pm: number | undefined } | null)[] = Array.from({ length: lead }, () => null);
  for (let d = new Date(start); d.getUTCFullYear() === Number(year); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, pm: byDate.get(iso) });
  }
  const weeks = Math.ceil(cells.length / 7);
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="mb-1 grid text-[10.5px] text-ink-3" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0,1fr))` }}>
          {Array.from({ length: weeks }, (_, w) => {
            const c = cells[w * 7 + 6] ?? cells[w * 7];
            const first = c && Number(c.date.slice(8)) <= 7;
            return (
              <span key={w} className="font-mono">
                {first ? MON[Number(c!.date.slice(5, 7)) - 1] : ""}
              </span>
            );
          })}
        </div>
        <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, minmax(0,1fr))", gridTemplateColumns: `repeat(${weeks}, minmax(0,1fr))` }} role="img" aria-label={`Daily PM2.5 for ${year}, coloured by AQI category`}>
          {cells.map((c, i) =>
            c ? (
              <span
                key={c.date}
                title={c.pm === undefined ? `${c.date}: no data` : `${c.date}: ${Math.round(c.pm)} µg/m³ · ${categoryForPm(c.pm).label}`}
                className="aspect-square rounded-[1px] transition-transform duration-150 hover:scale-150"
                style={{ background: c.pm === undefined ? "var(--press)" : categoryForPm(c.pm).color }}
              />
            ) : (
              <span key={`e${i}`} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function MonthlyChart({ h, all, name }: { h: CityHistory; all: AllHistory | null; name: string }) {
  const data = h.months.map((m) => ({
    month: m.month,
    city: m.pm25,
    national: all ? mean(Object.values(all.cities).map((rows) => rows.find((r) => r.month === m.month)?.pm25 ?? null)) : null,
  }));
  return (
    <>
      <ChartContainer label={`Monthly PM2.5 for ${name} and the average of all cities, 2022 to 2024`} className="h-[280px]" config={{ city: { label: name, color: "var(--ember)", unit: "µg/m³" }, national: { label: "All cities", color: "var(--moon)", unit: "µg/m³" } }}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="month" tickFormatter={monthLabel} interval={5} {...axis} />
          <YAxis {...axis} width={44} />
          <ReferenceLine y={NAAQS_PM25_24H} strokeDasharray="4 4" />
          <Tooltip content={<ChartTooltipContent labelFormatter={(m) => fmtPeriod(String(m))} />} />
          <Line type="monotone" dataKey="national" stroke="var(--moon)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="city" stroke="var(--ember)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <ChartLegend className="mt-3" items={[{ label: name, color: "var(--ember)" }, { label: "All cities", color: "var(--moon)", dashed: true }]} />
      <SourceNote>Winter months are worst everywhere in the north: cold, still air holds smoke from the harvest fires.</SourceNote>
    </>
  );
}

function Compare({ all, picked, setPicked }: { all: AllHistory; picked: string[]; setPicked: (v: string[]) => void }) {
  const slugs = Object.keys(all.cities).filter((s) => CITY_BY_SLUG[s]);
  const months = [...new Set(Object.values(all.cities).flatMap((r) => r.map((x) => x.month)))].sort();
  const data = months.map((m) => Object.fromEntries([["month", m], ...picked.map((s) => [s, all.cities[s]?.find((r) => r.month === m)?.pm25 ?? null])]));
  const config = Object.fromEntries(picked.map((s, i) => [s, { label: CITY_BY_SLUG[s]?.name ?? s, color: PALETTE[i], unit: "µg/m³" }]));
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Cities to compare">
        {slugs
          .sort((a, b) => CITY_BY_SLUG[a].name.localeCompare(CITY_BY_SLUG[b].name))
          .map((s) => {
            const on = picked.includes(s);
            const i = picked.indexOf(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                disabled={!on && picked.length >= 4}
                onClick={() => {
                  sound.tick();
                  setPicked(on ? picked.filter((x) => x !== s) : [...picked, s]);
                }}
                className={cn("chip press disabled:opacity-40", on ? "bg-ink text-canvas shadow-none" : "hover:bg-press-2 hover:text-ink")}
              >
                {on && <span className="size-1.5" style={{ background: PALETTE[i] }} aria-hidden />}
                {CITY_BY_SLUG[s].name}
              </button>
            );
          })}
      </div>
      <ChartContainer label={`Monthly PM2.5 compared for ${picked.map((s) => CITY_BY_SLUG[s]?.name).join(", ")}`} className="h-[300px]" config={config}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="month" tickFormatter={monthLabel} interval={5} {...axis} />
          <YAxis {...axis} width={44} />
          <ReferenceLine y={NAAQS_PM25_24H} strokeDasharray="4 4" />
          <Tooltip content={<ChartTooltipContent labelFormatter={(m) => fmtPeriod(String(m))} />} />
          {picked.map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} stroke={PALETTE[i]} strokeWidth={i === 0 ? 2 : 1.6} dot={false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ChartContainer>
      <ChartLegend className="mt-3" items={picked.map((s, i) => ({ label: CITY_BY_SLUG[s]?.name ?? s, color: PALETTE[i] }))} />
    </>
  );
}

