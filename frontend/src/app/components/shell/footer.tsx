import { Info } from "lucide-react";
import { AnimatedLink } from "@/components/ui/animated-link";
import { InteractiveHoverButton } from "@/components/ui/button";
import { AqiLegend } from "@/components/aqi";
import { href } from "@/lib/router";
import { toStory } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The CAMS disclaimer, said plainly wherever a PM2.5 number is the main thing on screen. */
export function CamsNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2", className)}>
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        PM2.5 here is a <strong className="font-semibold text-ink">model estimate</strong> from Copernicus CAMS, not a station reading. Station history comes from CPCB. The model can be off by a lot near
        a fire or on a still night.
      </span>
    </p>
  );
}

export function Footer() {
  return (
    <footer className="no-print mx-auto mt-28 w-full max-w-[1320px] px-[var(--gutter)] pb-[max(32px,env(safe-area-inset-bottom))]">
      {/* The invitation: one question away from the data. */}
      <div className="grid items-end gap-8 border-t border-line pb-16 pt-14 md:grid-cols-[1fr_auto]">
        <div>
          <div className="tag eyebrow-rule mb-6">
            <span>Ask the data</span>
          </div>
          <p className="display text-[clamp(2.2rem,5.4vw,5rem)]">
            Bring the question.
            <br />
            <strong>We&rsquo;ll read the air.</strong>
          </p>
        </div>
        <InteractiveHoverButton text="Ask the data" onClick={() => window.dispatchEvent(new Event("aerofusion:ask"))} className="w-full md:w-72" />
      </div>
      <div className="grid gap-10 border-t border-line pt-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-6">
          <CamsNote />
          <AqiLegend />
        </div>
        <div className="grid content-start gap-4 text-[13px] text-ink-2 lg:justify-items-end lg:text-right">
          <p className="max-w-md leading-relaxed">
            Data: Copernicus Atmosphere Monitoring Service (via Open-Meteo), Open-Meteo weather, NASA FIRMS and GIBS, CPCB via the XKDR India Air Quality API. AI text by Amazon Nova Micro or GPT-OSS, and it can
            be wrong.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.16em] lg:justify-end">
            <AnimatedLink
              href="./"
              onClick={(e) => {
                e.preventDefault();
                toStory();
              }}
            >
              Back to the story
            </AnimatedLink>
            <AnimatedLink href={href("data")}>Credits and honesty notes</AnimatedLink>
          </div>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap justify-between gap-4 border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
        <span>AeroFusion · Air over North India</span>
        <span>
          PM2.5 · <span className="unit">µg/m³</span> · IST
        </span>
      </div>
    </footer>
  );
}
