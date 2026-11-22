import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Nav } from "./nav";
import { ArrowUpRightMark, Button } from "@/components/ui/button";
import { ConfirmIcon } from "@/components/ui/confirm-icon";
import { Select } from "@/components/ui/select";
import { Tip } from "@/components/ui/tooltip";
import { useLive, type LiveSnapshot } from "@/lib/api";
import { categoryForPm } from "@/lib/aqi";
import { CITIES } from "@/lib/cities";
import { usePrefs } from "@/lib/prefs";
import { href, type ViewId } from "@/lib/router";
import { isDash } from "@/lib/site";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** The snapshot is stale once it is older than its refresh interval plus an hour. */
export function isStale(snap: LiveSnapshot | null) {
  if (!snap) return false;
  return Date.now() - Date.parse(snap.updated_at) > (snap.interval_s + 3600) * 1000;
}

/** Fetch every source again now (it sits in the footer). */
export function RefreshButton() {
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

/**
 * The header: the logo, the views (in the top row from xl up, under it below that) and Ask the
 * data. (Refresh is in the footer.)
 *
 * It is also the end of the story's bar: under the story (html:not(.mode-dash)) it is fixed over
 * the closing hero and comes in in parts (src/styles/base.css, "the site's header over the hero"):
 * data-fade="nav" with the dots gathering, "ask" exactly where the story's button turned into it,
 * "late" (the logo and the glass) as the hero scrolls away. When the dashboard
 * locks it is simply the header, in the same place.
 */
export function Header({ view, onAsk }: { view: ViewId; onAsk: () => void }) {
  const { city } = usePrefs();
  const ref = useRef<HTMLElement>(null);
  // Under the story the header is fixed (out of the flow); the page keeps its room (--app-header-h).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--app-header-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Under the story, Ask glides into the dashboard first and opens there (src/main.js).
  const ask = () => (isDash() ? onAsk() : window.dispatchEvent(new CustomEvent("aerofusion:ask-from-story")));
  return (
    <header ref={ref} className="glass no-print sticky top-0 z-50 shadow-[inset_0_-1px_0_var(--line)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-[1320px] px-[var(--gutter)]">
        <div className="flex h-16 items-center gap-3">
          <div data-fade="late" className="shrink-0">
            <Logo />
          </div>
          <div data-fade="nav" className="hidden min-w-0 flex-1 xl:block xl:pl-4">
            <Nav current={view} city={city} inline />
          </div>
          <div className="ml-auto flex shrink-0 items-center">
            <div data-fade="ask">
              <Button variant="primary" size="md" onClick={ask} aria-label="Ask the data" className="group gap-3 px-5 max-sm:gap-2 max-sm:px-3 sm:ml-1">
                <span className="sm:hidden">Ask</span>
                <span className="max-sm:hidden">Ask the data</span>
                <ArrowUpRightMark />
              </Button>
            </div>
          </div>
        </div>
        <div data-fade="nav" className="border-t border-line xl:hidden">
          <Nav current={view} city={city} />
        </div>
      </div>
    </header>
  );
}
