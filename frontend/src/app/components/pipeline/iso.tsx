import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A small isometric line-drawing kit in Hairline's manner (lucasmarkes/hairline): true isometric
 * projection, plates filled with the colour they sit on (so a plate hides what is behind it),
 * strokes in four tones (--hairline-hi / edge / mid / lo) at hairline width. Each part carries a
 * numbered marker with its name; what it does opens on hover.
 *
 * World axes: x runs right-down, y runs left-down, z up. Anything with a larger x + y is nearer.
 */

export type P3 = [number, number, number];
export type P2 = [number, number];
export type Tone = "hi" | "edge" | "mid" | "lo" | "ember";

const C = Math.cos(Math.PI / 6);
export const iso = (p: P3): P2 => [(p[0] - p[1]) * C, (p[0] + p[1]) * 0.5 - p[2]];
/** The ground point (or the point at height z) that lands on screen point (sx, sy). */
export const W = (sx: number, sy: number, z = 0): P3 => {
  const a = sx / C;
  const b = 2 * (sy + z);
  return [(a + b) / 2, (b - a) / 2, z];
};
export const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const up = (a: P3, h: number): P3 => [a[0], a[1], a[2] + h];
const r1 = (n: number) => Math.round(n * 10) / 10;
export const d2 = (pts: P2[], close = false) => (pts.length ? "M" + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L") + (close ? "Z" : "") : "");
export const d3 = (pts: P3[], close = false) => d2(pts.map(iso), close);
const isP3 = (p: P2 | P3): p is P3 => p.length === 3;
export const toScreen = (p: P2 | P3): P2 => (isP3(p) ? iso(p) : p);

/* ------------------------------------------------------------------ strokes and plates ---------- */

export function Line({ pts, tone = "mid", close, dash, className, width }: { pts: (P2 | P3)[]; tone?: Tone; close?: boolean; dash?: string; className?: string; width?: number }) {
  return <path d={d2(pts.map(toScreen), close)} className={`ln t-${tone} ${className ?? ""}`} strokeDasharray={dash} style={width ? { strokeWidth: width } : undefined} />;
}

/** A filled plate (polygon in 3D) outlined in `tone`. */
export function Face({ pts, tone = "edge", className }: { pts: P3[]; tone?: Tone; className?: string }) {
  return <path d={d3(pts, true)} className={`ln plate t-${tone} ${className ?? ""}`} />;
}

/** Map a face's local (u, v) to 3D. */
export type FaceMap = (u: number, v: number) => P3;

/**
 * A box from corner `at` with size [w (x), d (y), h (z)]: its three visible faces filled and
 * outlined. `top`, `left` (the +y face) and `right` (the +x face) draw on those faces in local
 * coordinates (u along the face left to right as seen, v up / back).
 */
export function Box({
  at,
  size,
  tone = "edge",
  top,
  left,
  right,
  className,
}: {
  at: P3;
  size: P3;
  tone?: Tone;
  top?: (m: FaceMap) => ReactNode;
  left?: (m: FaceMap) => ReactNode;
  right?: (m: FaceMap) => ReactNode;
  className?: string;
}) {
  const [x, y, z] = at;
  const [w, d, h] = size;
  const P = (a: number, b: number, c: number): P3 => [x + a, y + b, z + c];
  const mTop: FaceMap = (u, v) => P(u, v, h);
  const mLeft: FaceMap = (u, v) => P(u, d, v);
  const mRight: FaceMap = (u, v) => P(w, d - u, v);
  return (
    <g className={className}>
      <Face pts={[P(w, 0, 0), P(w, d, 0), P(w, d, h), P(w, 0, h)]} tone={tone} />
      <Face pts={[P(0, d, 0), P(w, d, 0), P(w, d, h), P(0, d, h)]} tone={tone} />
      <Face pts={[P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)]} tone={tone} />
      {left?.(mLeft)}
      {right?.(mRight)}
      {top?.(mTop)}
    </g>
  );
}

const ELL_RX = Math.SQRT2 * C;
const ELL_RY = Math.SQRT2 * 0.5;

/** A flat disc (circle in the ground plane) at height c[2]. */
export function Disc({ c, r, tone = "edge", fill = true, dash, className }: { c: P3; r: number; tone?: Tone; fill?: boolean; dash?: string; className?: string }) {
  const [sx, sy] = iso(c);
  return <ellipse cx={sx} cy={sy} rx={r * ELL_RX} ry={r * ELL_RY} className={`ln ${fill ? "plate" : ""} t-${tone} ${className ?? ""}`} strokeDasharray={dash} />;
}

/** An upright cylinder: base centre c, radius r, height h. */
export function Cyl({ c, r, h, tone = "edge", className, children }: { c: P3; r: number; h: number; tone?: Tone; className?: string; children?: ReactNode }) {
  const [bx, by] = iso(c);
  const ty = by - h;
  const rx = r * ELL_RX;
  const ry = r * ELL_RY;
  const side = `M${r1(bx - rx)} ${r1(ty)}L${r1(bx - rx)} ${r1(by)}A${r1(rx)} ${r1(ry)} 0 0 0 ${r1(bx + rx)} ${r1(by)}L${r1(bx + rx)} ${r1(ty)}Z`;
  return (
    <g className={className}>
      <path d={side} className={`ln plate t-${tone}`} />
      <ellipse cx={bx} cy={ty} rx={rx} ry={ry} className={`ln plate t-${tone}`} />
      {children}
    </g>
  );
}

/** Points on a circle in 3D: centre c, radius r, normal n. */
export function ring3(c: P3, r: number, n: P3, k = 48, a0 = 0, a1 = Math.PI * 2): P3[] {
  const len = Math.hypot(...n);
  const N: P3 = [n[0] / len, n[1] / len, n[2] / len];
  const ref: P3 = Math.abs(N[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const u0 = cross(N, ref);
  const ul = Math.hypot(...u0);
  const U: P3 = [u0[0] / ul, u0[1] / ul, u0[2] / ul];
  const V = cross(N, U);
  return Array.from({ length: k + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / k;
    return [c[0] + r * (Math.cos(a) * U[0] + Math.sin(a) * V[0]), c[1] + r * (Math.cos(a) * U[1] + Math.sin(a) * V[1]), c[2] + r * (Math.cos(a) * U[2] + Math.sin(a) * V[2])];
  });
}

/** A parabolic dish: rim centre c, radius R, facing n, with ribs and a feed on struts. */
export function Dish({ c, R, n, tone = "edge", className }: { c: P3; R: number; n: P3; tone?: Tone; className?: string }) {
  const len = Math.hypot(...n);
  const N: P3 = [n[0] / len, n[1] / len, n[2] / len];
  const back = (k: number): P3 => [c[0] - N[0] * k, c[1] - N[1] * k, c[2] - N[2] * k];
  const feed: P3 = [c[0] + N[0] * R * 0.75, c[1] + N[1] * R * 0.75, c[2] + N[2] * R * 0.75];
  const rim = ring3(c, R, N, 48);
  const depth = R * 0.32;
  return (
    <g className={className}>
      <Face pts={rim} tone={tone} />
      {[0.66, 0.33].map((f) => (
        <Line key={f} pts={ring3(back(depth * (1 - f) * 0.5), R * f, N, 36)} tone="lo" />
      ))}
      {[0, 12, 24, 36].map((i) => (
        <Line key={i} pts={[rim[i], back(depth * 0.2), rim[(i + 24) % 48]]} tone="lo" />
      ))}
      {[6, 22, 38].map((i) => (
        <Line key={`s${i}`} pts={[rim[i], feed]} tone="mid" />
      ))}
      <circle cx={iso(feed)[0]} cy={iso(feed)[1]} r={2.4} className="ln plate t-hi" />
    </g>
  );
}

/** A sphere (globe) with meridians and parallels. */
export function Globe({ c, r, tone = "edge", spin = true }: { c: P3; r: number; tone?: Tone; spin?: boolean }) {
  const [sx, sy] = iso(c);
  return (
    <g>
      <circle cx={sx} cy={sy} r={r} className={`ln plate t-${tone}`} />
      {[-0.55, 0, 0.55].map((k) => (
        <ellipse key={k} cx={sx} cy={sy - k * r} rx={r * Math.sqrt(1 - k * k)} ry={r * Math.sqrt(1 - k * k) * 0.28} className="ln t-lo" />
      ))}
      <g className={spin ? "pl-spin-x" : undefined} style={{ transformOrigin: `${sx}px ${sy}px` }}>
        {[0.25, 0.6, 0.9].map((k) => (
          <ellipse key={k} cx={sx} cy={sy} rx={r * k} ry={r} className="ln t-lo" />
        ))}
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ wires and what travels ------- */

/** An iso-aligned route on a level: along x first, then y (or y first). */
export function route(a: P3, b: P3, yFirst = false): P3[] {
  return yFirst ? [a, [a[0], b[1], a[2]], b] : [a, [b[0], a[1], a[2]], b];
}

/**
 * A wire: a quiet base line, a flowing dash over it, and packets riding it (SMIL animateMotion, so
 * they follow any path). `packets` = how many ride at once; `dur` = seconds end to end.
 */
export function Wire({ id, pts, packets = 2, dur = 4, tone = "mid", dashed, ember, reverse }: { id: string; pts: (P2 | P3)[]; packets?: number; dur?: number; tone?: Tone; dashed?: boolean; ember?: boolean; reverse?: boolean }) {
  const s = (reverse ? [...pts].reverse() : pts).map(toScreen);
  const d = d2(s);
  return (
    <g className="wire">
      <path id={id} d={d} className="ln t-lo" strokeDasharray={dashed ? "3 5" : undefined} />
      {!dashed && <path d={d} className={`ln t-${tone} pl-flow`} strokeDasharray="2 12" />}
      {Array.from({ length: packets }, (_, i) => (
        <Rider key={i} id={id} dur={dur} begin={(-dur * i) / packets} shape={`<path d="M-3.2 0L0 -1.85L3.2 0L0 1.85Z" class="ln plate ${ember ? "t-ember packet-ember" : "t-hi"}"/>`} />
      ))}
    </g>
  );
}

/** Something riding a path (SMIL animateMotion, written as markup: React has no animateMotion element). */
function Rider({ id, dur, begin, shape }: { id: string; dur: number; begin: number; shape: string }) {
  return (
    <g
      className="pl-packet"
      dangerouslySetInnerHTML={{
        __html: `${shape}<animateMotion dur="${dur}s" repeatCount="indefinite" begin="${begin.toFixed(2)}s" rotate="0"><mpath href="#${id}"/></animateMotion>`,
      }}
    />
  );
}

/** Radio waves leaving `from` toward `to` (downlinks, uplinks): dashed beam plus travelling arcs. */
export function Beam({ id, from, to, dur = 2.6 }: { id: string; from: P3; to: P3; dur?: number }) {
  const a = iso(from);
  const b = iso(to);
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return (
    <g className="wire">
      <path id={id} d={d2([a, b])} className="ln t-lo" strokeDasharray="1 5" />
      {[0, 1, 2].map((i) => (
        <Rider key={i} id={id} dur={dur} begin={(-dur * i) / 3} shape={`<path d="M-2 -6Q3 0 -2 6" class="ln t-hi" transform="rotate(${ang.toFixed(1)})"/>`} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ parts and their markers ------ */

export const HotContext = createContext<{ hot: number | null; setHot: (n: number | null) => void }>({ hot: null, setHot: () => {} });
/** Each scene's part names, by number, so a part can write its name beside its marker. */
export const NamesContext = createContext<Record<number, string>>({});
/** The layer the markers are drawn into (above every part, so no part hides a name), and the
 *  marker scale `u` that keeps them one size on screen however large the drawing is. */
export const MarkerContext = createContext<{ layer: SVGGElement | null; u: number }>({ layer: null, u: 1 });

/**
 * A numbered part: hovering it lights it (and opens its description). Its marker is a numeral on a
 * short leader above `at`, with the part's name beside it. `quiet` drops the name (a repeat of the
 * same part, like the second and third station).
 */
export function Part({ n, at, children, lead = 34, side = 0, quiet = false, nameLeft = false }: { n: number; at: P3 | P2; children: ReactNode; lead?: number; side?: number; quiet?: boolean; nameLeft?: boolean }) {
  const { hot, setHot } = useContext(HotContext);
  const names = useContext(NamesContext);
  const { layer, u } = useContext(MarkerContext);
  const [x, y] = toScreen(at);
  const mx = x + side;
  const my = y - lead;
  const name = quiet ? undefined : names[n];
  const state = `part ${hot === n ? "hot" : hot != null ? "dim" : ""}`;
  const r = 8.5 * u;
  const marker = (
    <g className={state} onMouseEnter={() => setHot(n)} onMouseLeave={() => setHot(null)}>
      <g className="marker">
        <path d={`M${r1(x)} ${r1(y)}L${r1(mx)} ${r1(my + r)}`} className="ln t-lo" />
        <circle cx={mx} cy={my} r={r} className="ln plate t-edge" />
        <text x={mx} y={my + 3.3 * u} textAnchor="middle">
          {n}
        </text>
        {name && (
          <text className="name" x={nameLeft ? mx - r - 5 * u : mx + r + 5 * u} y={my + 3.8 * u} textAnchor={nameLeft ? "end" : "start"}>
            {name}
          </text>
        )}
      </g>
    </g>
  );
  return (
    <>
      <g className={state} onMouseEnter={() => setHot(n)} onMouseLeave={() => setHot(null)}>
        {children}
      </g>
      {layer ? createPortal(marker, layer) : marker}
    </>
  );
}
