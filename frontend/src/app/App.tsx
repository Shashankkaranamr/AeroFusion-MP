import { lazy, Suspense, useEffect, useState } from "react";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { ColdStart } from "@/components/shell/cold-start";
import { ChatDrawer } from "@/components/shell/chat-drawer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PulsatingLoader } from "@/components/ui/loader";
import { LiveProvider, useLive } from "@/lib/api";
import { PrefsProvider, usePrefs } from "@/lib/prefs";
import { useRoute, type ViewId } from "@/lib/router";
import { useDashMode } from "@/lib/site";
import { NowView } from "@/views/now";
import { CityView } from "@/views/city";
import { WhyView } from "@/views/why";
import { WhatIfView } from "@/views/what-if";
import { HistoryView } from "@/views/history";
import { DataView } from "@/views/data";

// The map pulls in MapLibre (the heaviest part), so it loads only when opened.
const MapView = lazy(() => import("@/views/map").then((m) => ({ default: m.MapView })));

const TITLES: Record<ViewId, string> = {
  now: "Now",
  map: "Map",
  city: "City",
  why: "Why",
  "what-if": "What if",
  history: "History",
  data: "Behind the data",
};

function Shell() {
  const route = useRoute();
  const { snap } = useLive();
  const { city, setCity } = usePrefs();
  const [ask, setAsk] = useState(false);
  // Waiting under the story, or locked in (the page is only the dashboard)?
  const dash = useDashMode();
  // Each lock replays the view's arrival.
  const [arrivals, setArrivals] = useState(0);
  useEffect(() => {
    if (dash) setArrivals((n) => n + 1);
  }, [dash]);

  // A city in the address wins, and becomes the remembered one.
  useEffect(() => {
    if (route.view === "city" && route.slug && route.slug !== city) setCity(route.slug);
    if (route.city && route.city !== city) setCity(route.city);
  }, [route.view, route.slug, route.city, city, setCity]);

  // Arriving with ?ask=1 (from the story's "Ask the data"): open the chat once.
  useEffect(() => {
    if (route.ask) {
      setAsk(true);
      history.replaceState(null, "", window.location.pathname + window.location.hash.replace(/\?ask=1/, ""));
    }
  }, [route.ask]);

  // Only once it has the page: under the story, it must not retitle or move the page.
  useEffect(() => {
    if (!dash) return;
    document.title = `${TITLES[route.view]} · AeroFusion`;
    window.scrollTo({ top: 0 });
  }, [route.view, dash]);

  // "Ask the data" from anywhere: a link with #ask, or the A key when not typing.
  useEffect(() => {
    const open = () => document.documentElement.classList.contains("mode-dash") && setAsk(true);
    window.addEventListener("aerofusion:ask", open);
    return () => window.removeEventListener("aerofusion:ask", open);
  }, []);

  return (
    <>
      <a
        href="#/"
        onClick={(e) => {
          // The hash is the router, so move focus instead of jumping to an anchor.
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas">
        Skip to content
      </a>
      <Header view={route.view} onAsk={() => setAsk(true)} />
      <main id="main" tabIndex={-1} className="min-h-[60vh] outline-none">
        {!snap ? (
          <ColdStart />
        ) : (
          <div key={`${route.view}:${arrivals}`} className="view-enter mx-auto w-full max-w-[1320px] px-[var(--gutter)] pt-8 sm:pt-10">
            {route.view === "now" && <NowView />}
            {route.view === "map" && (
              <Suspense fallback={<PulsatingLoader label="Loading the map" className="py-24" />}>
                <MapView fromStory={route.fromStory} />
              </Suspense>
            )}
            {route.view === "city" && <CityView slug={route.slug ?? city} />}
            {route.view === "why" && <WhyView />}
            {route.view === "what-if" && <WhatIfView />}
            {route.view === "history" && <HistoryView />}
            {route.view === "data" && <DataView />}
          </div>
        )}
      </main>
      <Footer />
      <ChatDrawer open={ask} onOpenChange={setAsk} />
    </>
  );
}

export function App() {
  return (
    <LiveProvider>
      <PrefsProvider>
        <TooltipProvider>
          <Shell />
        </TooltipProvider>
      </PrefsProvider>
    </LiveProvider>
  );
}
