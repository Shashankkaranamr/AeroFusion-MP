import { useEffect, useState } from "react";
import { RefreshCw, Undo2, Volume2, VolumeX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Nav } from "./nav";
import { ArrowUpRightMark, Button } from "@/components/ui/button";
import { ConfirmIcon } from "@/components/ui/confirm-icon";
import { PulsatingLoader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Tip } from "@/components/ui/tooltip";
import { useLive, type LiveSnapshot } from "@/lib/api";
import { categoryForPm } from "@/lib/aqi";
import { CITIES } from "@/lib/cities";
import { fmtAgo, fmtCountdown } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { href, type ViewId } from "@/lib/router";
import { toStory } from "@/lib/site";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** The snapshot is stale once it is older than its refresh interval plus an hour. */
export function isStale(snap: LiveSnapshot | null) {
  if (!snap) return false;
  return Date.now() - Date.parse(snap.updated_at) > (snap.interval_s + 3600) * 1000;
}

/** Live status: last updated and the next refresh, in words; a coloured dot only doubles them. */
function StatusPill() {
  const { snap, phase, countdown } = useLive();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (phase === "connecting" || phase === "waking") return <PulsatingLoader size={8} label={phase === "waking" ? "Waking the server" : "Connecting"} className="chip" />;
  const updated = snap ? Date.parse(snap.updated_at) : null;
  const stale = isStale(snap);
  const tone = phase === "offline" ? "var(--bad)" : stale ? "var(--warn)" : "var(--good)";
  const text = phase === "offline" ? "Offline" : stale ? "Stale" : "Live";
  return (
    <Tip
      content={
        <div className="grid gap-1">
          <span>{phase === "offline" ? "Can't reach the AeroFusion API. Showing the last data received." : "All six sources are fused into one snapshot."}</span>
          {updated && <span className="mono text-ink-2">Updated {new Date(updated).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>}
          {countdown !== null && phase !== "offline" && <span className="mono text-ink-2">Next refresh in {fmtCountdown(countdown)}</span>}
        </div>
      }
    >
      <span className="chip cursor-default" tabIndex={0}>
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", phase === "live" && !stale && "[--ring:59_178_122] motion-safe:animate-[live-ring_1.6s_var(--ease-out)_infinite]")}
          style={{ background: tone }}
        />
        <span className="text-ink">{text}</span>
        {updated && <span className="hidden sm:inline">· {fmtAgo(updated)}</span>}
        {countdown !== null && phase === "live" && <span className="hidden xl:inline">· next in {fmtCountdown(countdown)}</span>}
      </span>
    </Tip>
  );
}

/** The six sources as six dots: green when the last fetch worked. Opens Behind the data. */
function SourceHealth() {
  const { snap } = useLive();
  if (!snap) return null;
  const ok = snap.sources.filter((s) => s.ok).length;
  return (
    <Tip
      content={
        <ul className="grid gap-1">
          {snap.sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full" style={{ background: s.ok ? "var(--good)" : "var(--bad)" }} />
              <span>{s.name}</span>
              <span className="mono ml-auto pl-3 text-ink-2">{s.ok ? `${s.records.toLocaleString("en-IN")}` : "failed"}</span>
            </li>
          ))}
        </ul>
      }
    >
      <a href={href("data")} className="chip press hover:bg-press-2 hover:text-ink" aria-label={`Sources: ${ok} of ${snap.sources.length} healthy. Open Behind the data.`}>
        <span className="flex gap-[3px]" aria-hidden>
          {snap.sources.map((s) => (
            <span key={s.id} className="h-2.5 w-[3px]" style={{ background: s.ok ? "var(--good)" : "var(--bad)" }} />
          ))}
        </span>
        <span className="hidden md:inline">
          {ok}/{snap.sources.length} sources
        </span>
      </a>
    </Tip>
  );
}

function RefreshButton() {
  const { refresh, refreshing, phase } = useLive();
  const [done, setDone] = useState(false);
  const run = async () => {
    sound.tick();
    await refresh();
    setDone(true);
    sound.chime();
    setTimeout(() => setDone(false), 2200);
  };
  return (
    <Tip content={refreshing ? "Fetching all six sources… this takes about 20 seconds." : "Refresh all sources now"}>
      <Button size="icon" variant="tinted" onClick={run} disabled={refreshing || phase === "connecting" || phase === "waking"} aria-label="Refresh all sources now">
        {done ? <ConfirmIcon className="text-good" /> : <RefreshCw className={cn(refreshing && "animate-spin")} />}
      </Button>
    </Tip>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(sound.on);
  useEffect(() => {
    const off = sound.subscribe(setOn);
    return () => void off();
  }, []);
  return (
    <Tip content={on ? "Sound on" : "Sound off"}>
      <Button size="icon" variant="tinted" aria-pressed={on} aria-label={on ? "Turn sound off" : "Turn sound on"} onClick={() => sound.set(!on)}>
        {on ? <Volume2 /> : <VolumeX />}
      </Button>
    </Tip>
  );
}

/** Back to the story's animation, from the top (the story sits above the dashboard on one page). */
function StoryButton() {
  return (
    <Tip content="Back to the story, from the beginning">
      <Button
        variant="tinted"
        size="md"
        onClick={() => {
          sound.tick();
          toStory();
        }}
        aria-label="Back to the story"
        className="gap-2.5 px-3.5 font-mono text-[10.5px] uppercase tracking-[0.18em] max-xl:size-10 max-xl:px-0 [&_svg]:size-3.5"
      >
        <Undo2 />
        <span className="max-xl:hidden">The story</span>
      </Button>
    </Tip>
  );
}

/** "Where do you breathe?" — the city every view opens on, remembered on this device. */
export function CityPicker({ className }: { className?: string }) {
  const { city, setCity } = usePrefs();
  const { snap } = useLive();
  const live = Object.fromEntries((snap?.cities ?? []).map((c) => [c.slug, c.pm25]));
  const options = [...CITIES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const pm = live[c.slug];
      return { value: c.slug, label: c.name, hint: pm == null ? undefined : `${Math.round(pm)} µg`, dot: pm == null ? undefined : categoryForPm(pm).color };
    });
  return (
    <Select
      label="Where do you breathe? Choose your city"
      value={city}
      onValueChange={(v) => {
        sound.tick();
        setCity(v);
        if (window.location.hash.startsWith("#/city")) window.location.hash = href("city", v);
      }}
      options={options}
      className={className}
    />
  );
}

export function Header({ view, onAsk }: { view: ViewId; onAsk: () => void }) {
  const { city } = usePrefs();
  return (
    <header className="glass no-print sticky top-0 z-50 shadow-[inset_0_-1px_0_var(--line)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-[1320px] px-[var(--gutter)]">
        <div className="flex h-16 items-center gap-3">
          <Logo />
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <StoryButton />
            </div>
            <div className="hidden sm:block">
              <CityPicker />
            </div>
            <StatusPill />
            <div className="hidden md:block">
              <SourceHealth />
            </div>
            <RefreshButton />
            <div className="hidden sm:block">
              <SoundToggle />
            </div>
            <Button variant="primary" size="md" onClick={onAsk} aria-label="Ask the data" className="group gap-3 px-5 max-sm:gap-2 max-sm:px-3 sm:ml-1">
              <span className="sm:hidden">Ask</span>
              <span className="max-sm:hidden">Ask the data</span>
              <ArrowUpRightMark />
            </Button>
          </div>
        </div>
        <div className="mb-2 flex items-center gap-2 sm:hidden">
          <CityPicker className="min-w-[14rem]" />
          <SoundToggle />
          <StoryButton />
        </div>
        <div className="border-t border-line">
          <Nav current={view} city={city} />
        </div>
      </div>
    </header>
  );
}
