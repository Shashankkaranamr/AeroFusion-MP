import { motion } from "motion/react";
import { href, type ViewId } from "@/lib/router";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

export const NAV: { id: ViewId; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "map", label: "Map" },
  { id: "city", label: "City" },
  { id: "why", label: "Why" },
  { id: "what-if", label: "What if" },
  { id: "history", label: "History" },
  { id: "data", label: "Behind the data" },
];

/** The view's place in the rail, as the two-digit index the view headers repeat. */
export const navIndex = (id: ViewId) => String(NAV.findIndex((n) => n.id === id) + 1).padStart(2, "0");

/**
 * The navigation: a numbered rail — `01 NOW   02 MAP   03 CITY …` — in mono over a hairline, with
 * one bar that slides to the current view. These are links, not actions (HIG › Tab bars: tabs
 * navigate), so the current one is aria-current. On a phone the rail scrolls sideways and keeps the
 * current item in view.
 */
export function Nav({ current, city }: { current: ViewId; city: string }) {
  return (
    <nav aria-label="Dashboard" className="no-scrollbar -mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)]">
      <ul className="flex min-w-max items-stretch gap-x-7 sm:gap-x-9">
        {NAV.map(({ id, label }, i) => {
          const active = id === current;
          return (
            <li key={id} className="relative">
              <a
                href={href(id, id === "city" ? city : undefined)}
                aria-current={active ? "page" : undefined}
                onClick={() => sound.tick()}
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
                  "group flex h-11 items-center gap-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] transition-colors duration-200",
                  active ? "text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                <span className={cn("transition-colors", active ? "text-ink-2" : "text-ink-3/70 group-hover:text-ink-2")}>{String(i + 1).padStart(2, "0")}</span>
                {label}
              </a>
              {active && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute inset-x-0 -bottom-px h-px bg-ink"
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
