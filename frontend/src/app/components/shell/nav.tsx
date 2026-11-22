import { motion } from "motion/react";
import { href, type ViewId } from "@/lib/router";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

export const NAV: { id: ViewId; label: string }[] = [
  { id: "now", label: "Overview" },
  { id: "map", label: "Spatial View" },
  { id: "city", label: "City Forecast" },
  { id: "why", label: "Insights" },
  { id: "what-if", label: "Projections" },
  { id: "history", label: "History" },
  { id: "data", label: "About the data" },
];

/** A view's name, as the navigation shows it (page titles use it too). */
export const navLabel = (id: ViewId) => NAV.find((n) => n.id === id)?.label ?? id;

/** The view's place in the rail, as the two-digit index the view headers repeat. */
export const navIndex = (id: ViewId) => String(NAV.findIndex((n) => n.id === id) + 1).padStart(2, "0");

/**
 * The navigation: a numbered rail — `01 NOW   02 MAP   03 CITY …` — in mono over a hairline, with
 * one bar that slides to the current view. These are links, not actions (HIG › Tab bars: tabs
 * navigate), so the current one is aria-current. On a phone the rail scrolls sideways and keeps the
 * current item in view.
 */
export function Nav({ current, city, inline }: { current: ViewId; city: string; inline?: boolean }) {
  return (
    <nav aria-label="Dashboard" className={cn("no-scrollbar overflow-x-auto", !inline && "-mx-[var(--gutter)] px-[var(--gutter)]")}>
      <ul className={cn("flex min-w-max items-stretch", inline ? "gap-x-6" : "gap-x-7 sm:gap-x-9")}>
        {NAV.map(({ id, label }, i) => {
          const active = id === current;
          return (
            <li key={id} className="relative">
              <a
                href={href(id, id === "city" ? city : undefined)}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  sound.tick();
                  // Overview opens on the hero above it (core/site.js), not on the page under it.
                  if (id === "now") {
                    e.preventDefault();
                    window.dispatchEvent(new Event("aerofusion:overview"));
                  }
                }}
                ref={(el) => {
                  // Sideways only, inside the rail: scrollIntoView would also move the page (and
                  // under the story, pull the reader down to the dashboard).
                  const rail = el?.closest("nav");
                  if (!active || !el || !rail || rail.scrollWidth <= rail.clientWidth) return;
                  const r = el.getBoundingClientRect();
                  const x = rail.scrollLeft + r.left - rail.getBoundingClientRect().left - rail.clientWidth / 2 + r.width / 2;
                  rail.scrollTo({ left: Math.max(0, x) });
                }}
                className={cn(
                  "group flex items-center gap-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] transition-colors duration-200",
                  inline ? "h-16" : "h-11",
                  active ? "text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                {/* The top row has no room for the indices; the row under the header keeps them. */}
                {!inline && <span className={cn("transition-colors", active ? "text-cream-ink" : "text-ink-3/70 group-hover:text-ink-2")}>{String(i + 1).padStart(2, "0")}</span>}
                {label}
              </a>
              {active && (
                <motion.span
                  // One id per copy (the top row and the row under it are both rendered): a shared id makes
                  // the line hand itself over to the hidden copy and fade out.
                  layoutId={inline ? "nav-underline-top" : "nav-underline"}
                  // The current view: a cream line just under its name (in the top row, under the
                  // word itself rather than at the header's edge).
                  className={cn("absolute inset-x-0 bg-cream", inline ? "bottom-[19px] h-[1.5px]" : "-bottom-px h-px")}
                  transition={{ type: "tween", ease: [0.19, 1, 0.22, 1], duration: 0.6 }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
