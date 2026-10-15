import { useMemo } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUp, Droplets, Flame, Gauge, Layers, Thermometer, Umbrella, Wind } from "lucide-react";
import { AqiBadge } from "@/components/aqi";
import { axis, ChartContainer, ChartLegend, ChartTooltipContent } from "@/components/charts/chart";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { CompareReveal } from "@/components/ui/compare-reveal";
import { InteractiveHoverButton } from "@/components/ui/button";
import { Missing, SectionLabel, ViewHeader } from "@/components/view-header";
import { useLive, type LiveCity, type LiveSnapshot } from "@/lib/api";
import { AQI_CATEGORIES, categoryForPm, NAAQS_PM25_24H, pmToAqi } from "@/lib/aqi";
import { CITY_BY_SLUG } from "@/lib/cities";
import { fmtDay, fmtHour, fmtNum, fmtPct } from "@/lib/format";
import { bestWindow, citySeries, compass, fmtPeriod, liveInsights, peak, ventilation, window as span, type SeriesPoint } from "@/lib/live";
import { fireShare, SECTOR_SHARE } from "@/lib/scenario";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

const FROM = -24;
const TO = 96;

export function CityView({ slug }: { slug: string }) {
  const { snap } = useLive();
  const c = snap?.cities.find((x) => x.slug === slug) ?? snap?.cities.find((x) => x.slug === "delhi");
  const now = useMemo(() => Date.now(), [snap?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const pts = useMemo(() => (c ? span(citySeries(c, now), FROM, TO) : []), [c, now]);
  if (!snap || !c) return null;

  const meta = CITY_BY_SLUG[c.slug];
  const cat = c.pm25 == null ? null : categoryForPm(c.pm25);
  const next24 = span(pts, 1, 24);
  const pk = peak(next24);
  const win = bestWindow(next24, 3);
  const insights = liveInsights(c, pts);

  return (
    <div>
      <ViewHeader
        eyebrow={`City · ${meta?.state ?? c.state}`}
        title={<strong>{c.name}.</strong>}
        actions={<InteractiveHoverButton text="What would change it" onClick={() => navigate("what-if")} />}
      >
        {c.pm25 == null ? (
          "The model has no reading for this city right now."
        ) : (
          <>
            {cat!.impact} {pk?.pm25 != null && <>The next 24 hours peak at <span className="mono text-[0.92em] text-ember-ink">{Math.round(pk.pm25)} µg/m³</span> around {fmtHour(pk.ms)}.</>}
          </>
        )}
      </ViewHeader>

      <SectionLabel>The air right now</SectionLabel>
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
        {/* Now */}
        <Card i={0} className="flex flex-col">
          <CardHeader index={1} eyebrow={c.observed_at ? `PM2.5 · ${fmtHour(Date.parse(c.observed_at + "Z"))} IST` : "PM2.5 now"} title="The air right now" action={<AqiBadge pm={c.pm25} />} />
          <CardBody className="flex flex-1 flex-col">
            <div className="flex items-baseline gap-2">
              <span className="num text-[clamp(4.5rem,9vw,7rem)] text-ember-ink">{c.pm25 == null ? "—" : Math.round(c.pm25)}</span>
              <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">µg/m³</span>
            </div>
            <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-2">
              CPCB AQI {c.pm25 == null ? "—" : pmToAqi(c.pm25)} · {c.pm25 == null ? "" : `${(c.pm25 / NAAQS_PM25_24H).toFixed(1)}× the limit`} · {c.pm25 == null ? "" : `${(c.pm25 / 15).toFixed(1)}× WHO`}
            </div>
            {cat && (
              <div className="mt-auto pt-6">
                <div className="tag mb-2">What to do</div>
                <ul className="grid border-t border-line text-[13.5px] text-ink">
                  {cat.advice.map((a) => (
                    <li key={a} className="flex gap-3 border-b border-line py-2">
                      <span aria-hidden className="mt-[7px] size-1.5 shrink-0" style={{ background: cat.color }} />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Pollutants */}
        <Card i={1}>
          <CardHeader index={2} eyebrow="CAMS model" title="What else is in the air" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Reading label="PM10" value={c.pm10} unit="µg/m³" />
              <Reading label="NO₂" value={c.no2} unit="µg/m³" />
              <Reading label="CO" value={c.co} unit="µg/m³" />
              <Reading label="Dust" value={c.dust} unit="µg/m³" />
              <Reading label="Aerosol depth" value={c.aod} digits={2} unit="AOD" />
              <Reading label="US AQI" value={c.us_aqi} unit="EPA" />
            </dl>
          </CardBody>
        </Card>

        {/* Weather */}
        <Card i={2}>
          <CardHeader index={3} eyebrow="Open-Meteo" title="The weather holding it" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Reading icon={<Thermometer />} label="Temperature" value={c.temp} digits={1} unit="°C" />
              <Reading icon={<Droplets />} label="Humidity" value={c.rh} unit="%" />
              <div>
                <dt className="tag flex items-center gap-1.5 [&_svg]:size-3.5">
                  <Wind /> Wind
                </dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="num text-[2.25rem]">{c.wind == null ? <Missing /> : c.wind.toFixed(1)}</span>
                  <span className="mono text-xs text-ink-2">m/s</span>
                  {c.wind_dir != null && (
                    <span className="mono ml-1 inline-flex items-center gap-1 text-xs text-ink-2" aria-label={`from the ${compass(c.wind_dir)}`}>
                      {/* The arrow points where the air is going. */}
                      <ArrowUp className="size-3.5" style={{ transform: `rotate(${(c.wind_dir + 180) % 360}deg)` }} aria-hidden />
                      from {compass(c.wind_dir)}
                    </span>
                  )}
                </dd>
              </div>
              <Reading icon={<Gauge />} label="Pressure" value={c.pressure} unit="hPa" />
              <Reading icon={<Umbrella />} label="Rain" value={c.precip} digits={1} unit="mm" />
              <Reading icon={<Layers />} label="Mixing height" value={c.pblh} unit="m" />
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* Forecast */}
      <SectionLabel>The next four days</SectionLabel>
      <Card>
        <CardHeader
          index={4}
          eyebrow="CAMS forecast · −24 h to +96 h"
          title="The next four days"
          action={
            <div className="hidden gap-2 sm:flex">
              {win.best && <span className="chip">Cleanest 3 h · {fmtHour(win.best.start.ms)}</span>}
              {win.worst && <span className="chip">Worst 3 h · {fmtHour(win.worst.start.ms)}</span>}
            </div>
          }
        />
        <CardBody>
          <ForecastChart c={c} pts={pts} best={win.best} worst={win.worst} />
          <ChartLegend
            className="mt-3"
            items={[
              { label: "PM2.5 (model)", color: "var(--ember)" },
              ...(c.cpcb ? [{ label: `CPCB stations, ${fmtPeriod(c.cpcb.period)}`, color: "var(--moon)", dashed: true }] : []),
              { label: "Cleanest 3 h", color: "var(--good)" },
              { label: "Worst 3 h", color: "var(--bad)" },
            ]}
          />
          <div className="mt-6 grid gap-px bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-3">
            <Window label="Peak, next 24 h" pt={pk} />
            <WindowSpan label="Best time to be outside" w={win.best} tone="var(--good)" />
            <WindowSpan label="Keep windows shut" w={win.worst} tone="var(--bad)" />
          </div>
        </CardBody>
      </Card>

      <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card i={0}>
          <CardHeader index={5} eyebrow="Wind × mixing height" title="Can the air clear?">
            Ventilation index. Below 6,000 m²/s the air can't carry pollution away, so it builds up near the ground.
          </CardHeader>
          <CardBody>
            <VentilationChart pts={pts} />
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader index={6} eyebrow="Against measured history" title="Compared with the same month before">
            {c.cpcb ? `What CPCB's ${c.cpcb.stations} stations measured in ${fmtPeriod(c.cpcb.period)}, against the model now.` : "No CPCB station history for this city."}
          </CardHeader>
          <CardBody>{c.cpcb ? <Baseline c={c} /> : <p className="text-sm text-ink-2">The CPCB archive has no stations for {c.name}.</p>}</CardBody>
        </Card>
      </div>

      <SectionLabel>Where it comes from</SectionLabel>
      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card i={0}>
          <CardHeader index={7} eyebrow="Estimated shares" title="Sources of the particles">
            Fire share from NASA's live fire count upwind; the rest split by published source studies for Indian cities.
          </CardHeader>
          <CardBody>
            <Sources c={c} />
          </CardBody>
        </Card>
        <Card i={1}>
          <CardHeader index={8} eyebrow="NASA FIRMS · last 24 h" title="Fires nearby" />
          <CardBody>
            <dl className="grid grid-cols-3 gap-4">
              <Reading icon={<Flame />} label="Within 300 km" value={c.fires_300km} ember />
              <Reading label="Upwind" value={c.fires_upwind} ember />
              <Reading label="Heat (FRP)" value={c.frp_300km} unit="MW" />
            </dl>
            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">
              {(c.fires_upwind ?? 0) > 0
                ? `${c.fires_upwind} fires are burning where today's wind blows from. Smoke from them can reach ${c.name} within a day or two.`
                : `No fires upwind of ${c.name} today, so its air is mostly its own.`}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="stagger mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card i={0}>
          <CardHeader index={9} eyebrow="Rule-based · live numbers only" title="What the numbers say" />
          <CardBody className="grid gap-3">
            {insights.map((x) => (
              <div key={x.title} className="p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                <div className="text-[15px] font-medium tracking-[-0.01em] text-ink">{x.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{x.body}</p>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card i={1} className="overflow-hidden">
          <CardHeader index={10} eyebrow={`NASA GIBS · ${snap.gibs?.cities.find((g) => g.city === c.slug)?.date ?? ""}`} title="From orbit">
            Drag to compare the true-colour image with the aerosol layer over it.
          </CardHeader>
          <CardBody>
            <Satellite snap={snap} c={c} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Reading({ label, value, unit, digits = 0, icon, ember }: { label: string; value: number | null; unit?: string; digits?: number; icon?: React.ReactNode; ember?: boolean }) {
  return (
    <div>
      <dt className="tag flex items-center gap-1.5 [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("num text-[2.25rem]", ember && "text-ember-ink")}>{value == null ? <Missing /> : fmtNum(value, digits)}</span>
        {unit && <span className="mono text-xs text-ink-2">{unit}</span>}
      </dd>
    </div>
  );
}

type Win = ReturnType<typeof bestWindow>["best"];

function Window({ label, pt }: { label: string; pt: SeriesPoint | null }) {
  return (
    <div className="bg-surface p-5">
      <div className="tag">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="num text-[2.25rem] text-ember-ink">{pt?.pm25 == null ? "—" : Math.round(pt.pm25)}</span>
        <span className="text-[13px] text-ink-2">{pt ? `${fmtDay(pt.ms)}, ${fmtHour(pt.ms)}` : ""}</span>
      </div>
    </div>
  );
}

function WindowSpan({ label, w, tone }: { label: string; w: Win; tone: string }) {
  return (
    <div className="bg-surface p-5">
      <div className="tag flex items-center gap-1.5">
        <span className="size-1.5" style={{ background: tone }} aria-hidden />
        {label}
      </div>
      <div className="mt-3 text-[17px] font-light tracking-[-0.02em] text-ink">{w ? `${fmtHour(w.start.ms)} – ${fmtHour(w.end.ms + 3_600_000)}` : "—"}</div>
      <div className="mono mt-1 text-[11px] text-ink-3">{w ? `average ${Math.round(w.mean)} µg/m³ · ${fmtDay(w.start.ms)}` : ""}</div>
    </div>
  );
}

function ForecastChart({ c, pts, best, worst }: { c: LiveCity; pts: SeriesPoint[]; best: Win; worst: Win }) {
  const data = pts.map((p) => ({ lead: p.lead, ms: p.ms, pm25: p.pm25 }));
  const top = Math.max(120, ...data.map((d) => d.pm25 ?? 0)) * 1.1;
  const pk = peak(span(pts, 1, 24));
  return (
    <ChartContainer label={`PM2.5 forecast for ${c.name}, from 24 hours ago to 96 hours ahead, with AQI bands`} className="h-[300px]" config={{ pm25: { label: "PM2.5", color: "var(--ember)", unit: "µg/m³" } }}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
        {AQI_CATEGORIES.map((cat) => (
          <ReferenceArea key={cat.key} y1={cat.pm[0]} y2={Math.min(cat.pm[1], top)} fill={cat.color} fillOpacity={0.07} stroke="none" ifOverflow="hidden" />
        ))}
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        {best && <ReferenceArea x1={best.start.lead} x2={best.end.lead} fill="var(--good)" fillOpacity={0.16} stroke="none" />}
        {worst && <ReferenceArea x1={worst.start.lead} x2={worst.end.lead} fill="var(--bad)" fillOpacity={0.16} stroke="none" />}
        <XAxis dataKey="lead" type="number" domain={[FROM, TO]} ticks={[-24, 0, 24, 48, 72, 96]} tickFormatter={(v) => (v === 0 ? "now" : `${v > 0 ? "+" : ""}${v} h`)} {...axis} />
        <YAxis domain={[0, Math.round(top)]} {...axis} width={44} />
        <ReferenceLine y={NAAQS_PM25_24H} strokeDasharray="4 4" label={{ value: "limit 60", position: "insideTopRight", fill: "var(--ink-3)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} />
        {c.cpcb && <ReferenceLine y={c.cpcb.pm25_mean} stroke="var(--moon)" strokeDasharray="6 4" />}
        <ReferenceLine x={0} stroke="var(--ink-2)" label={{ value: "now", position: "insideTopLeft", fill: "var(--ink-2)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} />
        <Tooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p[0]?.payload?.ms ? `${fmtDay(p[0].payload.ms as number)} · ${fmtHour(p[0].payload.ms as number)}` : "")} />} />
        <defs>
          <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ember)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="pm25" stroke="var(--ember)" strokeWidth={1.5} fill="url(#fc)" connectNulls isAnimationActive={false} />
        {pk?.pm25 != null && <ReferenceDot x={pk.lead} y={pk.pm25} r={3.5} fill="var(--ember)" stroke="var(--surface)" strokeWidth={2} label={{ value: `peak ${Math.round(pk.pm25)}`, position: "top", fill: "var(--ink)", fontSize: 11, fontFamily: "var(--font-mono)" }} />}
      </ComposedChart>
    </ChartContainer>
  );
}

function VentilationChart({ pts }: { pts: SeriesPoint[] }) {
  const data = pts.filter((p) => p.lead >= 0).map((p) => ({ lead: p.lead, ms: p.ms, vent: ventilation(p) }));
  return (
    <ChartContainer label="Ventilation index for the next four days, with the 6,000 threshold" className="h-[220px]" config={{ vent: { label: "Ventilation", color: "var(--moon)", unit: "m²/s" } }}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <ReferenceArea y1={0} y2={6000} fill="var(--bad)" fillOpacity={0.07} stroke="none" />
        <XAxis dataKey="lead" type="number" domain={[0, TO]} ticks={[0, 24, 48, 72, 96]} tickFormatter={(v) => (v === 0 ? "now" : `+${v} h`)} {...axis} />
        <YAxis {...axis} width={50} domain={[0, (max: number) => Math.max(7000, Math.ceil(max / 1000) * 1000)]} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(v))} />
        <ReferenceLine y={6000} strokeDasharray="4 4" label={{ value: "poor below 6,000", position: "insideTopRight", fill: "var(--ink-3)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} />
        <Tooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p[0]?.payload?.ms ? `${fmtDay(p[0].payload.ms as number)} · ${fmtHour(p[0].payload.ms as number)}` : "")} />} />
        <Line type="monotone" dataKey="vent" stroke="var(--moon)" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

function Baseline({ c }: { c: LiveCity }) {
  const cp = c.cpcb!;
  const data = [
    { k: "Model now", v: c.pm25 ?? 0, color: "var(--ember)" },
    { k: "CPCB average", v: cp.pm25_mean, color: "var(--moon)" },
    ...(cp.pm25_p90 ? [{ k: "CPCB bad days (90th %)", v: cp.pm25_p90, color: "var(--haze)" }] : []),
  ];
  const ratio = c.pm25 == null ? null : (c.pm25 - cp.pm25_mean) / cp.pm25_mean;
  return (
    <div>
      <ChartContainer label="PM2.5 now against CPCB's same-month history" className="h-[170px]" config={{ v: { label: "PM2.5", color: "var(--ink)", unit: "µg/m³" } }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="k" {...axis} width={150} />
          <Bar dataKey="v" radius={0} barSize={18} isAnimationActive={false} label={{ position: "right", fill: "var(--ink-2)", fontSize: 11, fontFamily: "var(--font-mono)", formatter: (v: unknown) => Math.round(Number(v)) }}>
            {data.map((d) => (
              <Cell key={d.k} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      {ratio !== null && (
        <p className="mt-3 text-[13.5px] text-ink-2">
          The model has today at <span className="mono text-ink">{fmtPct(ratio * 100)}</span> against what the stations measured in {fmtPeriod(cp.period)}, across {cp.n_days} days of readings.
        </p>
      )}
    </div>
  );
}

function Sources({ c }: { c: LiveCity }) {
  const fs = fireShare(c);
  const local = 1 - fs;
  const rows = [
    { key: "Vehicles", v: local * SECTOR_SHARE.vehicles, color: "var(--moon)" },
    { key: "Industry", v: local * SECTOR_SHARE.industry, color: "var(--distance)" },
    { key: "Dust & construction", v: local * SECTOR_SHARE.construction, color: "var(--lamp)" },
    { key: "Crop & forest fires", v: fs, color: "var(--ember)" },
    { key: "Other & background", v: local * SECTOR_SHARE.other, color: "var(--haze)" },
  ];
  return (
    <div>
      <div className="flex h-2 gap-px overflow-hidden" role="img" aria-label={rows.map((r) => `${r.key} ${Math.round(r.v * 100)}%`).join(", ")}>
        {rows.map((r) => (
          <span key={r.key} className="h-full transition-[flex-grow] duration-700 ease-[var(--ease-drawer)]" style={{ flexGrow: r.v, background: r.color }} />
        ))}
      </div>
      <ul className="mt-5 grid border-t border-line">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 border-b border-line py-2 text-[13.5px]">
            <span aria-hidden className="size-2" style={{ background: r.color }} />
            <span className="text-ink">{r.key}</span>
            <span className="mono ml-auto text-ink-2">{Math.round(r.v * 100)}%</span>
            <span className="mono w-16 text-right text-ink-3">{c.pm25 == null ? "" : `${Math.round(c.pm25 * r.v)} µg`}</span>
          </li>
        ))}
      </ul>
      <SourceNote>Approximate. A model of where today's particles likely came from, not a measurement.</SourceNote>
    </div>
  );
}

/** Re-point a GIBS WMS request at another box. */
function withBox(url: string, bbox: string, size = 480) {
  return url.replace(/BBOX=[^&]+/, `BBOX=${bbox}`).replace(/WIDTH=\d+/, `WIDTH=${size}`).replace(/HEIGHT=\d+/, `HEIGHT=${size}`);
}

function Satellite({ snap, c }: { snap: LiveSnapshot; c: LiveCity }) {
  const crop = snap.gibs?.cities.find((g) => g.city === c.slug);
  const aod = snap.gibs?.layers.find((l) => l.id === "aod");
  const smoke = snap.gibs?.layers.find((l) => l.id === "aerosol-index");
  if (!crop) return <p className="text-sm text-ink-2">No satellite image for {c.name} today.</p>;
  const bbox = crop.url.match(/BBOX=([^&]+)/)?.[1] ?? "";
  const overlay = aod ?? smoke;
  const img = (src: string, alt: string) => <img src={src} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" draggable={false} />;
  return (
    <div>
      <CompareReveal
        className="aspect-square w-full bg-surface-3"
        label="Compare true colour with aerosol"
        beforeLabel="True colour"
        afterLabel={overlay?.title ?? "Aerosol"}
        before={img(crop.url, `True-colour satellite image around ${c.name}`)}
        after={
          <>
            {img(crop.url, "")}
            {overlay && <img src={withBox(overlay.url, bbox)} alt={`${overlay.title} over ${c.name}`} loading="lazy" className="absolute inset-0 size-full object-cover opacity-90 mix-blend-screen" draggable={false} />}
          </>
        }
      />
      <SourceNote>
        A 240 km square centred on {c.name}. Red dots on the true colour are VIIRS fire detections. {overlay ? `${overlay.subtitle}.` : ""}
      </SourceNote>
    </div>
  );
}
