import { Ember } from "./ember";
import { toStory } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The logo: the ember, then a spaced wordmark over a mono sub-line, set like an engineering title
 * block. The story's ember flies into exactly this place at its end (src/core/brand.js), and the
 * logo leads back to the story, the site's front page.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <a
      href="./"
      data-logo
      aria-label="AeroFusion — back to the story"
      onClick={(e) => {
        e.preventDefault();
        toStory();
      }}
      className={cn("press group inline-flex h-10 items-center gap-3 text-ink sm:pr-2 no-underline", className)}
    >
      <Ember size={24} />
      <span className="grid gap-[3px] whitespace-nowrap leading-none">
        <span className="text-[13px] font-semibold uppercase tracking-[0.32em]">AeroFusion</span>
        <span className="hidden font-mono text-[8.5px] font-medium uppercase tracking-[0.34em] text-ink-3 transition-colors group-hover:text-ink-2 sm:block">Air · 33 cities · live</span>
      </span>
    </a>
  );
}
