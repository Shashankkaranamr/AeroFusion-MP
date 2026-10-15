import { AQI_CATEGORIES, categoryForPm, onSwatch, pmToAqi, type AqiCategory } from "@/lib/aqi";
import { cn } from "@/lib/utils";

/**
 * The AQI legend (CPCB, PM2.5 24-h). Safe in Dusk and Dawn: each swatch carries its own label and
 * range, so the meaning never rests on colour alone (HIG › Color, Accessibility).
 */
export function AqiLegend({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-1 gap-px overflow-hidden" aria-hidden>
        {AQI_CATEGORIES.map((c) => (
          <span key={c.key} className="h-full flex-1" style={{ background: c.color }} />
        ))}
      </div>
      <ul className={cn("mt-3 grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-6", compact && "sm:grid-cols-6")} aria-label="AQI categories for PM2.5">
        {AQI_CATEGORIES.map((c) => (
          <li key={c.key} className="min-w-0">
            <div className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink">{compact ? c.short : c.label}</div>
            <div className="mono mt-0.5 text-[10.5px] text-ink-3">
              {c.pm[0]}–{c.key === "severe" ? "" : c.pm[1]} µg
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A category badge: the swatch colour with text that reads on it, plus the AQI number. */
export function AqiBadge({ pm, className, showAqi = true }: { pm: number | null | undefined; className?: string; showAqi?: boolean }) {
  if (pm === null || pm === undefined || !Number.isFinite(pm)) return <span className={cn("chip", className)}>No reading</span>;
  const c = categoryForPm(pm);
  return (
    <span className={cn("inline-flex h-7 items-center gap-2 px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em]", className)} style={{ background: c.color, color: onSwatch(c) }}>
      {c.label}
      {showAqi && <span className="font-medium opacity-75">AQI {pmToAqi(pm)}</span>}
    </span>
  );
}

/** A dot in the category's colour (always beside a number or a name). */
export function AqiDot({ pm, className }: { pm: number | null | undefined; className?: string }) {
  const c: AqiCategory | null = pm === null || pm === undefined ? null : categoryForPm(pm);
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: c?.color ?? "var(--ink-3)" }} />;
}
