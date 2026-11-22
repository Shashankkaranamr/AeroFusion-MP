import { useState, type ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** When the first tiles appeared: the numbers roll only on the page's first load, not on every visit. */
let firstShown: number | null = null;
const firstLoad = () => {
  firstShown ??= performance.now();
  return performance.now() - firstShown < 1500;
};

/**
 * One headline number, the dashboard's KPI tile: a mono label with the tile's index, the number in
 * thin Inter rolling on the odometer (CountUp, digitEffect "slide"), its unit, and one line of
 * context under a hairline.
 */
export function Stat({
  label,
  value,
  decimals = 0,
  unit,
  context,
  tone,
  i,
  className,
  children,
}: {
  label: string;
  value: number | null;
  decimals?: number;
  unit?: string;
  context?: ReactNode;
  /** "ember" for pollution numbers; plain ink otherwise. */
  tone?: "ember";
  i?: number;
  className?: string;
  children?: ReactNode;
}) {
  // On a later visit the odometer starts at its value (no roll); it still rolls when the value changes.
  const [from] = useState(() => (firstLoad() || value === null ? 0 : Number(value.toFixed(decimals))));
  return (
    <Card i={i} className={cn("group flex flex-col justify-between gap-10 p-5 transition-shadow duration-500 ease-[var(--ease-out)] hover:shadow-[inset_0_0_0_1px_var(--line-2)] sm:p-6", className)}>
      <div className="tag flex items-start justify-between gap-4">
        <span>{label}</span>
        {i !== undefined && <span className="text-cream-ink">{String(i + 1).padStart(2, "0")}</span>}
      </div>
      <div>
        <div className={cn("flex items-baseline gap-2.5", tone === "ember" ? "text-ember-ink" : "text-ink")}>
          {value === null ? (
            <span className="num text-[clamp(3rem,5vw,4.25rem)] text-ink-3">—</span>
          ) : (
            <CountUp from={from} to={Number(value.toFixed(decimals))} separator="," digitEffect="slide" duration={1.4} className="num text-[clamp(3rem,5vw,4.25rem)]" />
          )}
          {unit && <span className="font-mono text-[11px] tracking-[0.06em] text-ink-2">{unit}</span>}
        </div>
        {context && <div className="mt-4 border-t border-line pt-3 text-[13px] leading-snug text-ink-2">{context}</div>}
        {children}
      </div>
    </Card>
  );
}
