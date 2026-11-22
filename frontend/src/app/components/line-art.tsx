import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The line-art backdrops behind the City header (the PJ Block and the city landmarks): thin strokes
 * in the ink colour, faded into the page. Decoration only, never data, so it is hidden from
 * assistive technology.
 *
 * The landmarks are small 3D scenes seen from a three-quarter angle: box faces carry their
 * elevation drawings in perspective, domes and minarets are solids of revolution, and each part
 * is painted over the ones behind it (a fill in the page colour, then its lines).
 */

export const W = 900;
export const H = 900;
export type Pt = [number, number];
export type V3 = [number, number, number];

/** One painted part: its fill (hides what is behind) and its lines. */
export interface Layer {
  fill?: string;
  faint?: string;
  strong?: string;
  /** "front": a little stronger (trees before a building). "reflect": faint and dashed (in water). */
  tone?: "front" | "reflect";
}
export interface Art {
  layers: Layer[];
  viewBox?: string;
}

const n = (v: number) => (Math.round(v * 10) / 10).toString();
export const poly = (pts: Pt[], close = false) => (pts.length < 2 ? "" : "M" + pts.map((p) => `${n(p[0])} ${n(p[1])}`).join("L") + (close ? "Z" : ""));

/** A scalloped crown around an ellipse: trees and bushes. */
export function crown(cx: number, cy: number, rx: number, ry: number, bumps: number, seed = 0): string {
  let p = "";
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 + seed;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) p += `M${n(x)} ${n(y)}`;
    else {
      const am = ((i - 0.5) / bumps) * Math.PI * 2 + seed;
      const k = 1.22 + 0.08 * Math.sin(i * 2.3 + seed);
      p += `Q${n(cx + Math.cos(am) * rx * k)} ${n(cy + Math.sin(am) * ry * k)} ${n(x)} ${n(y)}`;
    }
  }
  return p;
}

/* ------------------------------------------------------------------ 2D elevations ---------------- */
// An elevation is drawn in face coordinates (u along the face, left to right as seen from outside;
// v up from the face's foot), as polylines, then mapped onto the face in 3D.

const cubic = (a: Pt, b: Pt, c: Pt, d: Pt, k = 14): Pt[] =>
  Array.from({ length: k + 1 }, (_, i) => {
    const t = i / k;
    const s = 1 - t;
    return [s * s * s * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t * t * t * d[0], s * s * s * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t * t * t * d[1]];
  });

export class Elev {
  strong: Pt[][] = [];
  faint: Pt[][] = [];
  private to(faint: boolean) {
    return faint ? this.faint : this.strong;
  }
  line(pts: Pt[], faint = false) {
    this.to(faint).push(pts);
    return this;
  }
  h(u0: number, u1: number, v: number, faint = false) {
    return this.line([[u0, v], [u1, v]], faint);
  }
  v(u: number, v0: number, v1: number, faint = false) {
    return this.line([[u, v0], [u, v1]], faint);
  }
  rect(u0: number, v0: number, u1: number, v1: number, faint = false) {
    return this.line([[u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]], faint);
  }
  /** Round arch: jambs from `vb` up to the springing `vs`, then a semicircle. */
  roundArch(u0: number, u1: number, vb: number, vs: number, faint = false) {
    const r = (u1 - u0) / 2;
    const arc: Pt[] = Array.from({ length: 19 }, (_, i) => {
      const a = Math.PI - (i / 18) * Math.PI;
      return [u0 + r + Math.cos(a) * r, vs + Math.sin(a) * r];
    });
    return this.line([[u0, vb], ...arc, [u1, vb]], faint);
  }
  /** Pointed (Mughal) arch from `vb`, springing at `vs`, apex at `va`. */
  pointedArch(u0: number, u1: number, vb: number, vs: number, va: number, faint = false) {
    const w = u1 - u0;
    const c = (u0 + u1) / 2;
    const h = va - vs;
    const left = cubic([u0, vs], [u0, vs + h * 0.6], [c - w * 0.22, va - h * 0.18], [c, va]);
    const right = cubic([c, va], [c + w * 0.22, va - h * 0.18], [u1, vs + h * 0.6], [u1, vs]);
    return this.line([[u0, vb], ...left, ...right.slice(1), [u1, vb]], faint);
  }
  circle(cu: number, cv: number, r: number, faint = false) {
    return this.line(Array.from({ length: 25 }, (_, i) => [cu + Math.cos((i / 24) * Math.PI * 2) * r, cv + Math.sin((i / 24) * Math.PI * 2) * r] as Pt), faint);
  }
}

/** A dome's profile, base to apex, as [radius, height]: `bulge` > 0 swells it into an onion. */
export function domeProfile(r: number, h: number, bulge = 0, k = 16): [number, number][] {
  const c1: Pt = bulge ? [r + 2 * r * bulge, h * 0.5] : [r, h * 0.6];
  const c2: Pt = bulge ? [0.08 * r, h * 0.7] : [0.6 * r, h];
  return cubic([r, 0], c1, c2, [0, h], k);
}

/* ------------------------------------------------------------------ the 3D scene ----------------- */

export interface Camera {
  /** Degrees; negative turns the scene so its right side shows. */
  yaw: number;
  dist: number;
  /** Eye height above the ground. */
  eye: number;
  f: number;
  /** Turns about this point. */
  at?: V3;
}

export class Item {
  fill: string[] = [];
  strong: string[] = [];
  faint: string[] = [];
  constructor(
    public depth: number,
    public tone?: Layer["tone"],
    public frame = true,
  ) {}
}

export class Scene {
  items: Item[] = [];
  private cs: number;
  private sn: number;
  bbox = [Infinity, Infinity, -Infinity, -Infinity];
  /** Camera position in world coordinates. */
  eyePos: V3;
  /** While false, new parts are drawn but not counted in the framing (scenery). */
  framing = true;
  constructor(
    public cam: Camera,
    public reflect = false,
  ) {
    const a = (cam.yaw * Math.PI) / 180;
    this.cs = Math.cos(a);
    this.sn = Math.sin(a);
    const [ax, , az] = cam.at ?? [0, 0, 0];
    this.eyePos = [ax - cam.dist * this.sn, cam.eye, az - cam.dist * this.cs];
  }
  private rot(p: V3): [number, number, number] {
    const [ax, , az] = this.cam.at ?? [0, 0, 0];
    const dx = p[0] - ax;
    const dz = p[2] - az;
    return [dx * this.cs - dz * this.sn, this.reflect ? -p[1] : p[1], this.cam.dist + dx * this.sn + dz * this.cs];
  }
  depth(p: V3) {
    return this.rot(p)[2];
  }
  scaleAt(p: V3) {
    return this.cam.f / this.depth(p);
  }
  P(p: V3): Pt {
    const [x, y, d] = this.rot(p);
    return [(this.cam.f * x) / d, (-this.cam.f * (y - this.cam.eye)) / d];
  }
  item(at: V3, tone?: Layer["tone"], frame = true) {
    const it = new Item(this.depth(at), tone ?? (this.reflect ? "reflect" : undefined), frame && this.framing);
    this.items.push(it);
    return it;
  }
  path(it: Item, pts: V3[], close = false) {
    const q = pts.map((p) => this.P(p));
    if (it.frame) for (const [x, y] of q) this.grow(x, y);
    return poly(q, close);
  }
  grow(x: number, y: number) {
    const b = this.bbox;
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  line(it: Item, pts: V3[], faint = false) {
    (faint ? it.faint : it.strong).push(this.path(it, pts));
  }
  visible(normal: V3, at: V3) {
    const e = this.eyePos;
    return normal[0] * (e[0] - at[0]) + normal[2] * (e[2] - at[2]) > 0;
  }

  /**
   * A box: its visible side faces filled, outlined, and drawn on by `faces` (front −z, right +x,
   * back +z, left −x), each given an Elev and the face's width and height.
   */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, faces: Partial<Record<"front" | "right" | "back" | "left", (e: Elev, w: number, h: number) => void>> = {}, tone?: Layer["tone"]) {
    const it = this.item([(x0 + x1) / 2, y0, (z0 + z1) / 2], tone);
    // Painted just after whatever stands on it at the same depth (a dome on its roof).
    it.depth -= 1;
    const sides = [
      { key: "front", n: [0, 0, -1], o: [x0, z0], u: [1, 0], w: x1 - x0 },
      { key: "right", n: [1, 0, 0], o: [x1, z0], u: [0, 1], w: z1 - z0 },
      { key: "back", n: [0, 0, 1], o: [x1, z1], u: [-1, 0], w: x1 - x0 },
      { key: "left", n: [-1, 0, 0], o: [x0, z1], u: [0, -1], w: z1 - z0 },
    ] as const;
    for (const s of sides) {
      const mid: V3 = [s.o[0] + (s.u[0] * s.w) / 2, y0, s.o[1] + (s.u[1] * s.w) / 2];
      if (!this.visible(s.n as unknown as V3, mid)) continue;
      const map = (u: number, v: number): V3 => [s.o[0] + s.u[0] * u, y0 + v, s.o[1] + s.u[1] * u];
      const quad = [map(0, 0), map(s.w, 0), map(s.w, y1 - y0), map(0, y1 - y0)];
      it.fill.push(this.path(it, quad, true));
      it.strong.push(this.path(it, quad, true));
      const draw = faces[s.key];
      if (draw) {
        const e = new Elev();
        draw(e, s.w, y1 - y0);
        for (const l of e.strong) it.strong.push(this.path(it, l.map(([u, v]) => map(u, v))));
        for (const l of e.faint) it.faint.push(this.path(it, l.map(([u, v]) => map(u, v))));
      }
    }
    return it;
  }

  /**
   * A solid of revolution about the vertical through `c`: `prof` is [radius, height] from the
   * bottom up. Its silhouette is filled and outlined; `rings` (profile indices) are drawn as the
   * visible half of their circles; `ribs` meridians go on the faint layer.
   */
  revolve(c: V3, prof: [number, number][], { rings = [] as number[], ribs = 0, ribStart = 0, tone }: { rings?: number[]; ribs?: number; ribStart?: number; tone?: Layer["tone"] } = {}) {
    const it = this.item(c, tone);
    const K = 72;
    const ang = (k: number) => (k / K) * Math.PI * 2;
    const at = (r: number, y: number, a: number): V3 => [c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r];
    const left: V3[] = [];
    const right: V3[] = [];
    for (const [r, y] of prof) {
      let lo = Infinity;
      let hi = -Infinity;
      let L: V3 = at(r, y, 0);
      let R: V3 = L;
      for (let k = 0; k < K; k++) {
        const p = at(r, y, ang(k));
        const x = this.P(p)[0];
        if (x < lo) [lo, L] = [x, p];
        if (x > hi) [hi, R] = [x, p];
      }
      left.push(L);
      right.push(R);
    }
    const outline = [...left, ...[...right].reverse()];
    it.fill.push(this.path(it, outline, true));
    it.strong.push(this.path(it, left), this.path(it, right));
    // Visible half of a ring: the points facing the eye.
    const facing = (a: number) => this.visible([Math.cos(a), 0, Math.sin(a)], c);
    const arcs = (r: number, y: number, faint: boolean) => {
      let run: V3[] = [];
      for (let k = 0; k <= K; k++) {
        const a = ang(k);
        if (facing(a)) run.push(at(r, y, a));
        else if (run.length) {
          this.line(it, run, faint);
          run = [];
        }
      }
      if (run.length) this.line(it, run, faint);
    };
    for (const i of rings) arcs(prof[i][0], prof[i][1], false);
    arcs(prof[0][0], prof[0][1], false);
    for (let m = 0; m < ribs; m++) {
      const a = ribStart + (m / ribs) * Math.PI * 2;
      if (!facing(a)) continue;
      this.line(it, prof.map(([r, y]) => at(r, y, a)), true);
    }
    return it;
  }

  /** A 2D shape standing at a 3D point: `draw` gets its screen position and the scale there. */
  sprite(at: V3, draw: (x: number, y: number, k: number) => { fill?: string; strong?: string; faint?: string }, tone?: Layer["tone"]) {
    const it = this.item(at, tone);
    const [x, y] = this.P(at);
    const g = draw(x, y, this.scaleAt(at));
    if (g.fill) it.fill.push(g.fill);
    if (g.strong) it.strong.push(g.strong);
    if (g.faint) it.faint.push(g.faint);
    return it;
  }

  /** Back to front, as layers; with the frame fitted so the subject sits low and to the right. */
  art(reflection?: Scene): Art {
    const sorted = (s: Scene) => [...s.items].sort((a, b) => b.depth - a.depth);
    const toLayer = (it: Item): Layer => ({ fill: it.fill.join("") || undefined, faint: it.faint.join("") || undefined, strong: it.strong.join("") || undefined, tone: it.tone });
    const layers = [...(reflection ? sorted(reflection).map(toLayer) : []), ...sorted(this).map(toLayer)];
    const [x0, y0, x1, y1] = this.bbox;
    const size = Math.max(x1 - x0, y1 - y0) * 1.1;
    const vx = x1 + size * 0.015 - size;
    const vy = Math.min(y1 - size * 0.87, y0 - size * 0.04);
    return { layers, viewBox: `${n(vx)} ${n(vy)} ${n(size)} ${n(size)}` };
  }
}

/* ------------------------------------------------------------------ rendering -------------------- */

const FADE_ALL =
  "linear-gradient(to right, transparent 0%, #000 16%, #000 96%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 8%, #000 78%, transparent 100%)";
/** Bleeding off the page's right edge: no fade on that side. */
const FADE_BLEED = "linear-gradient(to right, transparent 0%, #000 22%), linear-gradient(to bottom, transparent 0%, #000 8%, #000 80%, transparent 100%)";

export function LineArt({ art, className, style, bleed = false }: { art: Art; className?: string; style?: CSSProperties; bleed?: boolean }) {
  const nss = "non-scaling-stroke";
  const fade = bleed ? FADE_BLEED : FADE_ALL;
  return (
    <div
      aria-hidden
      className={cn("pj-backdrop pointer-events-none select-none", className)}
      style={{ maskImage: fade, WebkitMaskImage: fade, maskComposite: "intersect", WebkitMaskComposite: "source-in", ...style }}
    >
      <svg viewBox={art.viewBox ?? `0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMid meet" className="h-full w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="var(--ink)">
          {art.layers.map((l, i) => {
            const front = l.tone === "front";
            const refl = l.tone === "reflect";
            return (
              <g key={i} strokeDasharray={refl ? "6 5" : undefined}>
                {l.fill && <path d={l.fill} fill="var(--bg)" stroke="none" />}
                {l.faint && <path d={l.faint} strokeOpacity={refl ? 0.14 : front ? 0.6 : 0.45} strokeWidth={0.8} vectorEffect={nss} />}
                {l.strong && <path d={l.strong} strokeOpacity={refl ? 0.24 : 1} strokeWidth={front ? 1.1 : refl ? 0.8 : 1} vectorEffect={nss} />}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
