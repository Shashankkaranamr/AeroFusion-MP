import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { HotContext, MarkerContext, NamesContext } from "@/components/pipeline/iso";
import { SCENES, TRUNK_Y, VB_W, VB_X, type Scene } from "@/components/pipeline/scenes";
import { useLive } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { href } from "@/lib/router";
import { cn } from "@/lib/utils";

/**
 * The pipeline as a demo (#/data/sources … #/data/explanation): it opens over the whole screen and
 * does not scroll. The four drawings ride one track, each a screen wide, and each is scaled and
 * placed so its trunk wire lands on the same line: the wire leaves on the right and comes back in
 * on the left, and moving to the next stage slides the track along it. Hovering a part shows what
 * it is and what it does; the stage's own description sits at the bottom.
 */
export function PipelineView({ stage }: { stage: string }) {
  const idx = Math.max(0, SCENES.findIndex((s) => s.id === stage));
  const scene = SCENES[idx];
  const { snap } = useLive();
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [hot, setHot] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // The demo owns the screen: no page scroll while it is open.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => void (html.style.overflow = prev);
  }, []);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Arrow keys travel the wire; Escape goes back.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight" && idx < SCENES.length - 1) window.location.hash = href("data", SCENES[idx + 1].id);
      if (e.key === "ArrowLeft" && idx > 0) window.location.hash = href("data", SCENES[idx - 1].id);
      if (e.key === "Escape") window.location.hash = href("data");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [idx]);

  useEffect(() => setHot(null), [idx]);

  // One trunk line for all four, near the bottom (every scene stands above its wire); each scene
  // as large as fits with its trunk on that line. Each page clips at the screen's edges.
  const pad = 24;
  const yT = box.h - 90;
  const fit = (s: Scene) => {
    const above = TRUNK_Y - s.top;
    const below = s.top + s.height - TRUNK_Y;
    const k = Math.max(0.1, Math.min((box.w - 2 * 72) / VB_W, (yT - pad) / above, (box.h - yT - pad) / below));
    return { k, top: yT - above * k };
  };

  const item = hot != null ? scene.legend.find((l) => l.n === hot) : undefined;
  const live = item?.source ? snap?.sources.find((x) => x.id === item.source) : undefined;

  // Portalled to <body>: the view's entry animation transforms its ancestors, which would pin a
  // fixed box to them instead of to the screen.
  return createPortal(
    <HotContext.Provider value={{ hot, setHot }}>
      <div
        className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg)] [--hairline-plate:var(--bg)]"
        role="dialog"
        aria-modal="true"
        aria-label={`The data pipeline, stage ${scene.step}: ${scene.title}`}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      >
        <div ref={area} className="relative min-h-0 flex-1 overflow-hidden">
          <div className="pl-track absolute inset-y-0 left-0 flex" style={{ width: `${SCENES.length * 100}%`, transform: `translateX(-${(idx * 100) / SCENES.length}%)` }}>
            {SCENES.map((s, i) => {
              const { k, top } = fit(s);
              return (
                <div key={s.id} className="relative h-full shrink-0 overflow-hidden" style={{ width: `${100 / SCENES.length}%` }} aria-hidden={i !== idx} inert={i !== idx}>
                  {box.w > 0 && (
                    <svg
                      className="iso absolute left-1/2 overflow-visible"
                      style={{ top, width: VB_W * k, height: s.height * k, transform: "translateX(-50%)", ["--pl-name" as string]: `${11.5 / k}px`, ["--pl-num" as string]: `${9 / k}px` }}
                      viewBox={`${VB_X} ${s.top} ${VB_W} ${s.height}`}
                      role="img"
                      aria-label={`Stage ${s.step}, ${s.title}: a line drawing of its parts. Hover a part to read what it does.`}
                    >
                      <SceneBody scene={s} k={k} />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          <a href={href("data")} className="tag press absolute left-[var(--gutter)] top-5 z-10 inline-flex items-center gap-2 bg-[var(--bg)] px-3 py-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-press-2 hover:text-ink">
            <ArrowLeft className="size-3.5" /> Back
          </a>

          <SideArrow dir="prev" to={SCENES[idx - 1]} />
          <SideArrow dir="next" to={SCENES[idx + 1]} />
        </div>

        <StageName scene={scene} />

        {item && (
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[80] w-[min(320px,calc(100vw-32px))] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line-2),0_18px_40px_-18px_rgb(0_0_0/0.6)]"
            style={{
              left: Math.max(16, Math.min(pos.x + 18, window.innerWidth - 336)),
              top: pos.y + 18 + 230 > window.innerHeight ? Math.max(16, pos.y - 18 - 210) : pos.y + 18,
            }}
          >
            <div className="tag mb-1.5 flex items-center gap-2">
              <span className="text-ember">{String(item.n).padStart(2, "0")}</span>
              <span aria-hidden className="h-px w-3 bg-line-2" />
              <span>{scene.title}</span>
            </div>
            <div className="text-[15px] tracking-[-0.01em] text-ink">{item.title}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{item.body}</p>
            {(item.spec?.length || live) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {live && (
                  <span className={cn("chip", live.ok ? "text-good" : "text-bad")}>
                    {live.ok ? "Live" : "Failed"} · {fmtNum(live.records)} records
                  </span>
                )}
                {item.spec?.map((t) => (
                  <span key={t} className="chip font-mono text-[10.5px]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </HotContext.Provider>,
    document.body,
  );
}

/** A scene's drawing, with its markers drawn last (on top) at one size on screen. */
function SceneBody({ scene, k }: { scene: Scene; k: number }) {
  const [layer, setLayer] = useState<SVGGElement | null>(null);
  return (
    <NamesContext.Provider value={Object.fromEntries(scene.legend.map((l) => [l.n, l.title]))}>
      <MarkerContext.Provider value={{ layer, u: 1 / k }}>
        {scene.draw(scene.id)}
        <g ref={setLayer} />
      </MarkerContext.Provider>
    </NamesContext.Provider>
  );
}

/** A large arrow at the screen's side: travel the wire to the previous or next stage. */
function SideArrow({ dir, to }: { dir: "prev" | "next"; to?: Scene }) {
  if (!to) return null;
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <a
      href={href("data", to.id)}
      aria-label={`${dir === "prev" ? "Back to" : "On to"} stage ${to.step}, ${to.title}`}
      className={cn("group absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-3", dir === "prev" ? "left-[var(--gutter)]" : "right-[var(--gutter)] flex-row-reverse")}
    >
      <span className="grid size-12 place-items-center bg-[var(--bg)] text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] transition-[box-shadow,color] group-hover:text-ink group-hover:shadow-[inset_0_0_0_1px_var(--ink)]">
        <Icon className="size-5" />
      </span>
      <span className="tag hidden bg-[var(--bg)] px-1 text-ink-3 group-hover:text-ink lg:block">
        {to.step} · {to.title}
      </span>
    </a>
  );
}

/** The current stage's name, at the bottom. */
function StageName({ scene }: { scene: Scene }) {
  return (
    <div className="pointer-events-none flex flex-col items-center pb-7 pt-2">
      {/* The same face as the part names in the drawing (Inter, medium), larger. */}
      <h1 className="font-sans text-[clamp(1.5rem,2.4vw,2rem)] font-medium leading-none tracking-[-0.01em] text-ink">{scene.title}</h1>
      <span aria-hidden className="mt-3 h-px w-10 bg-ink-3" />
    </div>
  );
}
