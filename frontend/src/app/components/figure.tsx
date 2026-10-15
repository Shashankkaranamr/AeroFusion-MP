import { useEffect, useRef, useState } from "react";
import * as hairline from "@lucasmarkes/hairline";
import { cn } from "@/lib/utils";

/**
 * A Hairline figure (lucasmarkes/hairline): an isometric line drawing that answers the pointer.
 * The figures are fixed illustrations, never data — so they stand for *stages* and *states*
 * (the pipeline's steps, a server waking, an empty chat), and every word stays outside the figure
 * (Hairline rule 10: no words inside; names go to the read-out). Colours come from --hairline-*
 * (app.css), set to the card it sits on.
 */
export type FigureName =
  | "dish" | "sieve" | "terrain" | "relay" | "plug" | "query" | "settle" | "cabinet" | "drawer"
  | "plot" | "rebuild" | "hub" | "basket" | "router" | "stack" | "phosphor" | "loupe" | "padlock";

type Mounted = { update: (o: Record<string, unknown>) => void; destroy: () => void };
type Factory = (el: HTMLElement, opts?: Record<string, unknown>) => Mounted;

export function Figure({
  name,
  label,
  intensity = 0.5,
  play = false,
  className,
  onRead,
}: {
  name: FigureName;
  label: string;
  intensity?: number;
  play?: boolean;
  className?: string;
  onRead?: (text: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const fig = useRef<Mounted | null>(null);
  const [read, setRead] = useState("");

  useEffect(() => {
    const el = host.current;
    const make = (hairline as unknown as Record<string, Factory>)[name];
    if (!el || !make) return;
    fig.current = make(el, {
      intensity,
      play,
      label,
      onRead: (t: string) => {
        setRead(t);
        onRead?.(t);
      },
    });
    return () => {
      fig.current?.destroy();
      fig.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    fig.current?.update({ intensity, play, label });
  }, [intensity, play, label]);

  return (
    <div className={cn("relative", className)}>
      <div ref={host} className="w-full" />
      {read && (
        <span aria-hidden className="pointer-events-none absolute bottom-1 right-2 font-mono text-[10.5px] tracking-[0.06em] text-ink-3">
          {read}
        </span>
      )}
    </div>
  );
}
