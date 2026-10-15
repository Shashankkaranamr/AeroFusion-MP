import type { ReactNode } from "react";
import { navIndex } from "@/components/shell/nav";
import { useRoute } from "@/lib/router";
import { cn } from "@/lib/utils";

/**
 * Each view opens the same way: `03 / CITY · …` in mono with its rule, a large light title whose
 * key words are set heavy (wrap them in <strong>), and one plain sentence.
 */
export function ViewHeader({
  eyebrow,
  title,
  children,
  actions,
  hero = false,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** The front view's form: ultra-thin caps over heavy caps, the sentence under it in mono. */
  hero?: boolean;
  className?: string;
}) {
  const { view } = useRoute();
  return (
    <div className={cn("mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pt-4 sm:mb-14 sm:pt-8", className)}>
      <div className={cn("min-w-0", hero ? "w-full" : "max-w-4xl")}>
        <div className="tag eyebrow-rule mb-6">
          <span>
            <span className="text-ink">{navIndex(view)}</span> / {eyebrow}
          </span>
        </div>
        <h1 className={cn("display text-balance", hero ? "display-caps text-[clamp(2.75rem,7.2vw,7.6rem)]" : "text-[clamp(2.4rem,5.4vw,4.6rem)]")}>{title}</h1>
        {children && (
          <p className={cn("mt-8 max-w-2xl text-pretty", hero ? "font-mono text-[12.5px] uppercase leading-[1.7] tracking-[0.1em] text-ink-2" : "text-[16px] leading-relaxed text-ink-2")}>
            {children}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A section label: `ALL 33 CITIES ──────────`, the rhythm between groups of panels. */
export function SectionLabel({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 mt-14 flex items-center justify-between gap-4", className)}>
      <div className="tag eyebrow-rule min-w-0 flex-1 [&::after]:flex-1">
        <span className="shrink-0">{children}</span>
      </div>
      {aside}
    </div>
  );
}

/** A section heading inside a view: a hairline across, then a light title. */
export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 mt-16 flex items-end justify-between gap-4 border-t border-line pt-6", className)}>
      <h2 className="display text-[clamp(1.7rem,2.6vw,2.3rem)]">{children}</h2>
      {aside}
    </div>
  );
}

/** Missing value: a dash with a reason for screen readers and on hover. */
export function Missing({ why = "No reading from the source" }: { why?: string }) {
  return (
    <span title={why} aria-label={why} className="text-ink-3">
      —
    </span>
  );
}

/** An inline error: what went wrong and what to do, in the interface's voice (HIG › Writing). */
export function InlineError({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 bg-[color-mix(in_oklab,var(--bad)_8%,transparent)] px-4 py-3 text-[13.5px] text-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--bad)_40%,transparent)]">
      <span className="size-1.5 shrink-0 rounded-full bg-bad" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
