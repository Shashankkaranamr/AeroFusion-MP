import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Compare two aligned layers by dragging a divider (Emil › clip-path comparison sliders): the top
 * layer is clipped with inset(), no extra DOM, all on the compositor. Drag tracks 1:1 with pointer
 * capture (Apple › direct manipulation); the arrow keys move it too.
 */
export function CompareReveal({
  before,
  after,
  beforeLabel,
  afterLabel,
  className,
  label = "Compare",
}: {
  before: ReactNode;
  after: ReactNode;
  beforeLabel: string;
  afterLabel: string;
  className?: string;
  label?: string;
}) {
  const [at, setAt] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const move = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setAt(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);
  return (
    <div
      ref={box}
      className={cn("relative select-none overflow-hidden rounded-2xl", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && move(e.clientX)}
      style={{ touchAction: "pan-y" }}
    >
      <div className="absolute inset-0">{after}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }}>
        {before}
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-white/85 shadow-[0_0_8px_rgba(0,0,0,0.6)]" style={{ left: `${at}%` }} />
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(at)}
        aria-valuetext={`${Math.round(at)} percent ${beforeLabel}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setAt((v) => Math.max(0, v - 5));
          if (e.key === "ArrowRight") setAt((v) => Math.min(100, v + 5));
        }}
        className="absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-white/90 text-[#16121f] shadow-lg"
        style={{ left: `${at}%` }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M6 4 2 8l4 4M10 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="chip pointer-events-none absolute left-3 top-3 bg-black/50 text-white/90 shadow-none">{beforeLabel}</span>
      <span className="chip pointer-events-none absolute right-3 top-3 bg-black/50 text-white/90 shadow-none">{afterLabel}</span>
    </div>
  );
}
