import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { AetherField } from "@/components/aether-field";
import { Figure } from "@/components/figure";
import { Button } from "@/components/ui/button";
import { PulsatingLoader } from "@/components/ui/loader";
import { useLive } from "@/lib/api";

/**
 * Before the first data arrives. The API runs on a free server that sleeps after 15 idle minutes
 * and takes about a minute to wake, so this says exactly that, counts the seconds, and retries on
 * its own (HIG › Loading: show something immediately, say what's happening). Hairline's Plug draws
 * the plug toward its socket; the particle field behind it is the air we're about to read.
 */
export function ColdStart() {
  const { phase, error, reload } = useLive();
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const failed = phase === "offline" || (phase === "waking" && t > 100);
  return (
    <section className="view-enter relative mx-auto mt-6 w-full max-w-[1320px] px-[var(--gutter)]" aria-live="polite">
      <div className="card relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
        <AetherField className="opacity-70" />
        <div className="relative grid items-center gap-10 md:grid-cols-[1fr_minmax(0,360px)]">
          <div className="max-w-xl">
            <div className="tag mb-4">{failed ? "No connection" : phase === "waking" ? `Waking the server · ${t} s` : "Connecting"}</div>
            <h1 className="display text-[clamp(2.2rem,5vw,3.6rem)]">{failed ? "We can't reach the air right now." : "Reading the air over 33 cities."}</h1>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-ink-2">
              {failed
                ? `The AeroFusion API didn't answer${error ? ` (${error})` : ""}. It may be restarting. Try again in a minute; nothing you chose is lost.`
                : "The data server sleeps when nobody is looking and takes about a minute to wake. It is fetching six sources — the CAMS model, the weather, NASA's fire satellites and the CPCB archive — and fusing them into one snapshot."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {failed ? (
                <Button variant="primary" size="lg" onClick={() => reload()}>
                  <RotateCw /> Try again
                </Button>
              ) : (
                <PulsatingLoader label={phase === "waking" ? "Usually under a minute" : "Connecting"} />
              )}
            </div>
          </div>
          <Figure name="plug" play={!failed} intensity={0.7} label="A plug being drawn toward its socket: the server waking up" className="mx-auto w-full max-w-[340px]" />
        </div>
      </div>
    </section>
  );
}
