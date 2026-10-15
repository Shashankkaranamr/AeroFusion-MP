import { useMemo } from "react";
import { Area, AreaChart, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AqiBadge, AqiDot } from "@/components/aqi";
import { ChartContainer, ChartTooltipContent } from "@/components/charts/chart";
import { Stat } from "@/components/stat";
import { AnimatedLink } from "@/components/ui/animated-link";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { ArrowUpRightMark, InteractiveHoverButton } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { SectionLabel, ViewHeader } from "@/components/view-header";
import { useLive, type LiveCity, type LiveSnapshot } from "@/lib/api";
import { AQI_CATEGORIES, categoryForPm, NAAQS_PM25_24H } from "@/lib/aqi";
import { CITY_BY_SLUG } from "@/lib/cities";
import { fmtDay, fmtHour, fmtNum, fmtPct, fmtPop, fmtTime } from "@/lib/format";
import { useInsights, TONE } from "@/lib/insights";
import { at, citySeries, national, peak, window as span } from "@/lib/live";
import { usePrefs } from "@/lib/prefs";
import { href, navigate } from "@/lib/router";
import { downloadFile } from "@/lib/utils";

/** Three-letter codes for the ranking strip; the full name is in the tooltip and the label. */
const code = (c: LiveCity) => c.name.slice(0, 3).toUpperCase();

/** A small mono link for panel headers. */
const headerLink = "font-mono text-[10.5px] uppercase tracking-[0.16em]";

/** Cities whose next 24 h peak lands in a worse category than now. */
function alerts(snap: LiveSnapshot, now: number) {
  const idx = (pm: number) => AQI_CATEGORIES.indexOf(categoryForPm(pm));
  return snap.cities
    .map((c) => {
      const pts = citySeries(c, now);
      const cur = at(pts, 0)?.pm25 ?? c.pm25;
      const pk = peak(span(pts, 1, 24));
      if (cur == null || pk?.pm25 == null) return null;
      const jump = idx(pk.pm25) - idx(cur);
      return jump > 0 ? { c, cur, pk, jump, to: categoryForPm(pk.pm25) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.pk.pm25! - a.pk.pm25!);
}

export function NowView() {
  const { snap } = useLive();
  const { city, provider } = usePrefs();
  const { data: ai } = useInsights(provider);
  const now = Date.now();
  const n = useMemo(() => (snap ? national(snap) : null), [snap]);
  const warn = useMemo(() => (snap ? alerts(snap, now) : []), [snap]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!snap || !n) return null;

  const worst = n.sorted[0];
  const mine = snap.cities.find((c) => c.slug === city) ?? worst;
  const updated = Date.parse(snap.updated_at);
  const exposedShare = n.popTotal ? (n.exposedM / n.popTotal) * 100 : 0;

  const exportToday = () => {
    const rows = [["city", "state", "pm25_ugm3", "category", "pm10", "no2", "co", "aod", "temp_c", "rh_pct", "wind_ms", "fires_upwind"]];
    for (const c of n.sorted) rows.push([c.name, c.state, String(c.pm25 ?? ""), c.pm25 == null ? "" : categoryForPm(c.pm25).label, String(c.pm10 ?? ""), String(c.no2 ?? ""), String(c.co ?? ""), String(c.aod ?? ""), String(c.temp ?? ""), String(c.rh ?? ""), String(c.wind ?? ""), String(c.fires_upwind ?? "")]);
    downloadFile(`aerofusion-${snap.updated_at.slice(0, 10)}.csv`, rows.map((r) => r.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n"), "text/csv");
  };

  return (
    <div>
      <ViewHeader
        hero
        eyebrow={`Now · ${fmtDay(updated)} · ${fmtTime(updated)} IST`}
        title={
          worst?.pm25 == null ? (
            <>
              The air over
              <br />
              <strong>33 cities.</strong>
            </>
          ) : n.aboveNaaqs === 0 ? (
            <>
              Every city is
              <br />
              <strong>within the limit.</strong>
            </>
          ) : (
            <>
              {n.aboveNaaqs} of {n.count} cities
              <br />
              <strong>above the limit.</strong>
            </>
          )
        }
      >
        {worst?.pm25 != null && (
          <>
            The worst is{" "}
            <a className="text-ink underline decoration-line-2 underline-offset-[5px] hover:decoration-ink" href={href("city", worst.slug)}>
              {worst.name}
            </a>{" "}
            at{" "}
            <span className="text-ember-ink">
              {Math.round(worst.pm25)} <span className="unit">µg/m³</span>
            </span>
            . India&rsquo;s 24-hour safe limit for PM2.5 is {NAAQS_PM25_24H}.
          </>
        )}
      </ViewHeader>

      {/* The headline numbers: four panels sharing their hairlines. */}
      <SectionLabel>The numbers</SectionLabel>
      <div className="stagger grid grid-cols-1 gap-px bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          i={0}
          className="shadow-none"
          label="National average PM2.5"
          value={n.avg}
          unit="µg/m³"
          tone="ember"
          context={
            <span className="inline-flex items-center gap-1">
              {n.change24 >= 0 ? <ArrowUpRight className="size-3.5 text-bad" aria-hidden /> : <ArrowDownRight className="size-3.5 text-good" aria-hidden />}
              {fmtPct(n.change24)} against 24 hours ago
            </span>
          }
        />
        <Stat i={1} className="shadow-none" label="Cities above the limit (60)" value={n.aboveNaaqs} unit={`of ${n.count}`} context={n.aboveNaaqs ? `Worst: ${n.sorted.slice(0, 3).map((c) => c.name).join(", ")}` : "None today"} />
        <Stat i={2} className="shadow-none" label="People exposed" value={n.exposedM} decimals={1} unit="million" context={`${Math.round(exposedShare)}% of the ${fmtPop(n.popTotal)} people in these cities`} />
        <Stat
          i={3}
          className="shadow-none"
          label="Fires seen today"
          value={snap.fires.total}
          tone="ember"
          context={snap.fires.regions[0] ? `Most in ${snap.fires.regions.slice(0, 2).map((r) => r.region).join(" and ")} · NASA FIRMS` : "NASA FIRMS, last 24 h"}
        />
      </div>

      {/* 33-city ranking strip */}
      <SectionLabel>All 33 cities</SectionLabel>
      <Card className="overflow-hidden">
        <CardHeader
          index={1}
          eyebrow="PM2.5 now"
          title="Ranking, worst to cleanest"
          action={
            <AnimatedLink href={href("map")} className={headerLink}>
              On the map
            </AnimatedLink>
          }
        />
        <CardBody>
          <RankingStrip cities={n.sorted} />
        </CardBody>
      </Card>

      <SectionLabel>Where you breathe · what&rsquo;s next</SectionLabel>
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
        <YourCity i={0} c={mine} />
        <Card i={1}>
          <CardHeader index={3} eyebrow="Next 24 hours" title={warn.length ? `${warn.length} ${warn.length === 1 ? "city gets" : "cities get"} worse` : "No city changes category"} />
          <CardBody>
            {warn.length === 0 ? (
              <p className="text-[13.5px] text-ink-2">CAMS expects every city to stay in its current AQI category for the next day.</p>
            ) : (
              <ul className="grid border-t border-line">
                {warn.slice(0, 6).map(({ c, pk, to }) => (
                  <li key={c.slug}>
                    <a href={href("city", c.slug)} className="press group -mx-2 flex items-center gap-3 border-b border-line px-2 py-2.5 hover:bg-press">
                      <AqiDot pm={pk.pm25} />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{c.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3 group-hover:text-ink-2">
                        {to.label} · {fmtHour(pk.ms)}
                      </span>
                      <span className="mono w-9 text-right text-[12.5px] text-ember-ink">{Math.round(pk.pm25!)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card i={2}>
          <CardHeader index={4} eyebrow="NASA FIRMS · last 24 h" title="Where the fires are" />
          <CardBody>
            <FireRegions snap={snap} />
          </CardBody>
        </Card>
      </div>

      {/* The AI's read, with its model named, and the way into the rest. */}
      <SectionLabel>The model&rsquo;s read</SectionLabel>
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card i={0} className="lg:col-span-2">
          <CardHeader
            index={5}
            eyebrow={ai?.model ? `AI read · ${ai.model}` : "AI read"}
            title="What the model sees"
            action={
              <AnimatedLink href={href("why")} className={headerLink}>
                All insights
              </AnimatedLink>
            }
          />
          <CardBody>
            {ai?.headline ? <p className="display text-[clamp(1.6rem,2.4vw,2.1rem)] leading-[1.15] text-ink">{ai.headline}</p> : <div className="skeleton h-8 w-4/5" />}
            <div className="mt-6 grid gap-px bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-2">
              {(ai?.insights ?? []).slice(0, 2).map((x) => (
                <div key={x.title} className="bg-surface p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="size-1.5" style={{ background: TONE[x.tone]?.color }} aria-hidden />
                    <span className="tag">{TONE[x.tone]?.label}</span>
                  </div>
                  <div className="text-[15px] font-medium tracking-[-0.01em] text-ink">{x.title}</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{x.finding}</p>
                </div>
              ))}
            </div>
            <SourceNote>Written by a language model from today&rsquo;s numbers. Check anything important against the charts.</SourceNote>
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader index={6} eyebrow="Go further" title="Quick actions" />
          <CardBody>
            <ol className="grid border-t border-line">
              <QuickAction n={1} title="See where it comes from" text="Fires, wind and transport on the map" onClick={() => navigate("map")} />
              <QuickAction n={2} title="What would change it" text="Try cleaner transport or no stubble burning" onClick={() => navigate("what-if")} />
              <QuickAction n={3} title="Ask the data" text="A question, answered from today's numbers" onClick={() => window.dispatchEvent(new Event("aerofusion:ask"))} />
              <QuickAction n={4} title="Download today" text="All 33 cities as a CSV file" onClick={exportToday} />
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/** A numbered row with the ↗ mark: `01  See where it comes from  ↗`. */
function QuickAction({ n, title, text, onClick }: { n: number; title: string; text: string; onClick: () => void }) {
  return (
    <li className="border-b border-line">
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 py-3.5 text-left">
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-ink-3 transition-colors group-hover:text-ink">{String(n).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] text-ink">{title}</span>
          <span className="block truncate text-[12.5px] text-ink-3 transition-colors group-hover:text-ink-2">{text}</span>
        </span>
        <ArrowUpRightMark className="text-ink-2 group-hover:text-ink" />
      </button>
    </li>
  );
}

/** 33 bars, worst first, the limit drawn across them. Each bar opens its city. */
function RankingStrip({ cities }: { cities: LiveCity[] }) {
  const max = Math.max(120, ...cities.map((c) => c.pm25 ?? 0));
  const limit = (NAAQS_PM25_24H / max) * 100;
  return (
    <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <ol className="relative flex h-[228px] min-w-[760px] items-end gap-[3px]" aria-label="Cities ranked by PM2.5, worst first">
        {/* bar zone: 184 px between a 16 px value row and a 24 px code row */}
        <li aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: 24 + (limit / 100) * 184 }}>
          <span className="tag absolute -top-5 right-0 text-[10px]">Safe limit · 60</span>
        </li>
        {cities.map((c, i) => {
          const pm = c.pm25 ?? 0;
          const cat = categoryForPm(pm);
          return (
            <li key={c.slug} className="min-w-0 flex-1">
              <Tip
                content={
                  <span>
                    <strong className="font-semibold">
                      {i + 1}. {c.name}
                    </strong>{" "}
                    · {Math.round(pm)} µg/m³ · {cat.label}
                  </span>
                }
              >
                <a href={href("city", c.slug)} aria-label={`${i + 1}. ${c.name}, ${Math.round(pm)} micrograms, ${cat.label}`} className="group flex flex-col items-center">
                  <span className="flex h-[204px] w-full flex-col items-center justify-end">
                    <span className="mono mb-1 h-4 text-[10px] leading-4 text-ink-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{Math.round(pm)}</span>
                    <span
                      className="block w-full max-w-[18px] origin-bottom transition-[filter] duration-200 group-hover:brightness-125 motion-safe:animate-[grow_900ms_var(--ease-out)_both]"
                      style={{ height: Math.max(3, (pm / max) * 184), background: cat.color, animationDelay: `${i * 18}ms` }}
                    />
                  </span>
                  <span className="mono flex h-6 items-end text-[9.5px] tracking-[0.08em] text-ink-3 transition-colors group-hover:text-ink">{code(c)}</span>
                </a>
              </Tip>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function YourCity({ c, i }: { c: LiveCity; i: number }) {
  const now = Date.now();
  const pts = span(citySeries(c, now), -24, 24).map((p) => ({ lead: p.lead, ms: p.ms, pm25: p.pm25 }));
  const meta = CITY_BY_SLUG[c.slug];
  return (
    <Card i={i} className="flex flex-col">
      <CardHeader index={2} eyebrow="Where you breathe" title={c.name} action={<AqiBadge pm={c.pm25} />}>
        {meta?.state}
      </CardHeader>
      <CardBody className="flex flex-1 flex-col">
        <div className="flex items-baseline gap-2.5">
          <span className="num text-[4.25rem] text-ember-ink">{c.pm25 == null ? "—" : Math.round(c.pm25)}</span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">µg/m³ PM2.5</span>
        </div>
        <ChartContainer label={`${c.name} PM2.5 from 24 hours ago to 24 hours ahead`} className="mt-4 h-28" config={{ pm25: { label: "PM2.5", color: "var(--ember)", unit: "µg/m³" } }}>
          <AreaChart data={pts} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="yc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ember)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="lead" hide />
            <YAxis hide domain={[0, "dataMax + 10"]} />
            <ReferenceLine x={0} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <Tooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p[0]?.payload?.ms ? `${fmtHour(p[0].payload.ms as number)} · ${fmtNum(p[0].payload.lead as number)} h` : "")} />} />
            <Area type="monotone" dataKey="pm25" stroke="var(--ember)" strokeWidth={1.25} fill="url(#yc)" isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          <span>−24 h</span>
          <span>now</span>
          <span>+24 h</span>
        </div>
        <div className="mt-auto pt-6">
          <InteractiveHoverButton text={`Open ${c.name}`} onClick={() => navigate("city", c.slug)} className="w-full" />
        </div>
      </CardBody>
    </Card>
  );
}

function FireRegions({ snap }: { snap: LiveSnapshot }) {
  const top = snap.fires.regions.slice(0, 6);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <div>
      <div className="flex items-baseline gap-2.5">
        <span className="num text-[4.25rem] text-ember-ink">{fmtNum(snap.fires.total)}</span>
        <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">active fires</span>
      </div>
      <ul className="mt-6 grid gap-3">
        {top.map((r) => (
          <li key={r.region} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate text-ink">{r.region}</span>
            <span className="h-[3px] overflow-hidden bg-press-2">
              <span className="block h-full bg-ember" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="mono w-12 text-right text-[12px] text-ink-2">{r.count}</span>
          </li>
        ))}
      </ul>
      <SourceNote>Fire count by state. Fire radiative power (heat) totals are on the map.</SourceNote>
    </div>
  );
}
