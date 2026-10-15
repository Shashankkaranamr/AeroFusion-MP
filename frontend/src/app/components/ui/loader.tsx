import { cn } from "@/lib/utils";

/**
 * The loader: an ember dot with a live ring leaving it — the particle is the thing being waited
 * on. Status is always given in words beside it, never by motion alone. Reduced motion: no ring.
 */
export function PulsatingLoader({ label, className, size = 8 }: { label?: string; className?: string; size?: number }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-full bg-ember [--ring:var(--ember-rgb)] motion-safe:animate-[live-ring_1.4s_var(--ease-out)_infinite]"
        style={{ width: size, height: size }}
      />
      {label && <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">{label}</span>}
    </span>
  );
}
