import type { ReactNode } from "react";
import { CITIES } from "@/lib/cities";
import { add, Box, Cyl, d2, Dish, Disc, Face, iso, Line, ring3, up, type P2, type P3, type Tone } from "./iso";
import { MODEL_NODES } from "./model-nodes";

/* The parts of the pipeline drawings, each placed by a base point `o` (its near ground corner or
   centre). Proportions are illustrative; what they stand for is in each scene's legend. */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ space and ground stations ---- */

/** An Earth-observation satellite: bus, two solar wings, an instrument looking down, an antenna. */
export function Satellite({ o, wing = 70, bob = 0 }: { o: P3; wing?: number; bob?: number }) {
  const b = 26;
  const wingFace = (y0: number, y1: number) => {
    const cells: ReactNode[] = [];
    const z = o[2] + b * 0.55;
    const pts = (x0: number, x1: number): P3[] => [
      [o[0] + x0, o[1] + y0, z],
      [o[0] + x1, o[1] + y0, z],
      [o[0] + x1, o[1] + y1, z],
      [o[0] + x0, o[1] + y1, z],
    ];
    const x0 = -wing - 6;
    cells.push(<Face key="l" pts={pts(x0, -6)} tone="edge" />);
    cells.push(<Face key="r" pts={pts(b + 6, b + 6 + wing)} tone="edge" />);
    for (let k = 1; k < 4; k++) {
      const xl = lerp(x0, -6, k / 4);
      const xr = lerp(b + 6, b + 6 + wing, k / 4);
      cells.push(<Line key={`a${k}`} pts={[[o[0] + xl, o[1] + y0, z], [o[0] + xl, o[1] + y1, z]]} tone="lo" />);
      cells.push(<Line key={`b${k}`} pts={[[o[0] + xr, o[1] + y0, z], [o[0] + xr, o[1] + y1, z]]} tone="lo" />);
    }
    cells.push(<Line key="ym" pts={[[o[0] + x0, o[1] + (y0 + y1) / 2, z], [o[0] - 6, o[1] + (y0 + y1) / 2, z]]} tone="lo" />);
    cells.push(<Line key="ym2" pts={[[o[0] + b + 6, o[1] + (y0 + y1) / 2, z], [o[0] + b + 6 + wing, o[1] + (y0 + y1) / 2, z]]} tone="lo" />);
    cells.push(<Line key="arm" pts={[[o[0] - 6, o[1] + b / 2, z], [o[0], o[1] + b / 2, z]]} tone="mid" />);
    cells.push(<Line key="arm2" pts={[[o[0] + b, o[1] + b / 2, z], [o[0] + b + 6, o[1] + b / 2, z]]} tone="mid" />);
    return cells;
  };
  return (
    <g className="pl-bob" style={{ animationDelay: `${bob}s` }}>
      {wingFace(2, b - 2)}
      <Cyl c={[o[0] + b / 2, o[1] + b / 2, o[2] - 10]} r={6} h={10} />
      <Box at={o} size={[b, b, b]} left={(m) => <Line pts={[m(4, b * 0.3), m(b - 4, b * 0.3)]} tone="lo" />} right={(m) => <Line pts={[m(4, b * 0.3), m(b - 4, b * 0.3)]} tone="lo" />} />
      <Line pts={[[o[0] + 6, o[1] + 6, o[2] + b], [o[0] + 6, o[1] + 6, o[2] + b + 16]]} tone="mid" />
      <Dish c={[o[0] + b * 0.65, o[1] + b * 0.6, o[2] + b + 10]} R={8} n={[0.3, 0.6, 1]} />
    </g>
  );
}

/** The ground receiving station: a pad, a pedestal and a tracking dish (it slews slowly). */
export function GroundDish({ o, R = 34 }: { o: P3; R?: number }) {
  return (
    <g>
      <Box at={add(o, [-34, -34, 0])} size={[68, 68, 8]} top={(m) => <Line pts={[m(6, 6), m(62, 6), m(62, 62), m(6, 62), m(6, 6)]} tone="lo" />} />
      <Cyl c={up(o, 8)} r={11} h={34} />
      <Box at={add(o, [-9, -9, 42])} size={[18, 18, 10]} />
      <g className="pl-slew" style={{ transformOrigin: `${iso(up(o, 70))[0]}px ${iso(up(o, 70))[1]}px` }}>
        <Dish c={up(add(o, [-6, -10, 0]), 72)} R={R} n={[-0.55, -0.9, 0.75]} />
      </g>
    </g>
  );
}

/** A server: a cabinet with unit lines and blinking lights on its right face. */
export function Server({ o, w = 44, d = 44, h = 90, units = 6, tone = "edge", lights = true }: { o: P3; w?: number; d?: number; h?: number; units?: number; tone?: Tone; lights?: boolean }) {
  return (
    <Box
      at={o}
      size={[w, d, h]}
      tone={tone}
      right={(m) => (
        <g>
          {Array.from({ length: units }, (_, i) => {
            const v = 8 + ((h - 16) * (i + 0.5)) / units;
            return (
              <g key={i}>
                <Line pts={[m(5, v - (h - 16) / units / 2 + 2), m(d - 5, v - (h - 16) / units / 2 + 2)]} tone="lo" />
                {lights && <circle cx={iso(m(d - 9, v))[0]} cy={iso(m(d - 9, v))[1]} r={1.5} className="ln plate t-hi pl-blink" style={{ animationDelay: `${(i * 0.37) % 1.9}s` }} />}
                <Line pts={[m(6, v), m(d * 0.5, v)]} tone="lo" />
              </g>
            );
          })}
        </g>
      )}
      left={(m) => <Line pts={[m(6, 8), m(6, h - 8)]} tone="lo" />}
      top={(m) => <Line pts={[m(6, d / 2), m(w - 6, d / 2)]} tone="lo" />}
    />
  );
}

/** A supercomputer hall: three tall racks in a row. */
export function Supercomputer({ o }: { o: P3 }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <Server key={i} o={add(o, [i * 30, 0, 0])} w={26} d={40} h={84} units={7} />
      ))}
    </g>
  );
}

/** A CPCB continuous ambient air-quality station: shelter, mast with a PM2.5 inlet and a wind vane. */
export function Station({ o }: { o: P3 }) {
  const top = up(add(o, [30, 12, 0]), 34);
  return (
    <g>
      <Box at={o} size={[40, 26, 30]} left={(m) => <Line pts={[m(14, 0), m(14, 20), m(24, 20), m(24, 0)]} tone="lo" />} right={(m) => <Line pts={[m(6, 12), m(20, 12), m(20, 22), m(6, 22), m(6, 12)]} tone="lo" />} />
      <Box at={add(o, [-2, -2, 30])} size={[44, 30, 4]} />
      <Line pts={[top, up(top, 40)]} tone="edge" />
      <Cyl c={up(top, 40)} r={4} h={9} />
      <Line pts={[up(top, 52), up(top, 66)]} tone="mid" />
      <g className="pl-vane" style={{ transformOrigin: `${iso(up(top, 66))[0]}px ${iso(up(top, 66))[1]}px` }}>
        <Line pts={[up(add(top, [-10, 0, 0]), 66), up(add(top, [10, 0, 0]), 66)]} tone="edge" />
        <Line pts={[up(add(top, [10, 0, 0]), 66), up(add(top, [6, 0, 0]), 70), up(add(top, [6, 0, 0]), 62), up(add(top, [10, 0, 0]), 66)]} tone="edge" />
      </g>
      <Line pts={[up(add(o, [8, 8, 0]), 34), up(add(o, [8, 8, 0]), 52)]} tone="mid" />
      <Face pts={[up(add(o, [0, 0, 0]), 52), up(add(o, [18, 0, 0]), 52), up(add(o, [18, 14, 0]), 46), up(add(o, [0, 14, 0]), 46)]} tone="mid" />
    </g>
  );
}

/** A padlock: an API key guards the door. */
export function Padlock({ o, s = 1 }: { o: P3; s?: number }) {
  const [x, y] = iso(o);
  return (
    <g>
      <path d={`M${x - 5 * s} ${y - 9 * s}L${x - 5 * s} ${y - 14 * s}A${5 * s} ${5 * s} 0 0 1 ${x + 5 * s} ${y - 14 * s}L${x + 5 * s} ${y - 9 * s}`} className="ln t-edge" />
      <rect x={x - 8 * s} y={y - 9 * s} width={16 * s} height={12 * s} className="ln plate t-edge" />
      <circle cx={x} cy={y - 4 * s} r={1.6 * s} className="ln t-mid" />
    </g>
  );
}

/** A clock face lying on a plinth, its hand going round (the hour, encoded as sin and cos). */
export function Clock({ o, r = 26 }: { o: P3; r?: number }) {
  const c = up(o, 14);
  const [cx, cy] = iso(c);
  return (
    <g>
      <Cyl c={o} r={r + 4} h={14} />
      <Disc c={c} r={r} tone="edge" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const p = (k: number): P3 => [c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k, c[2]];
        return <Line key={i} pts={[p(0.82), p(0.95)]} tone={i % 3 ? "lo" : "mid"} />;
      })}
      <g className="pl-hand" style={{ transformOrigin: `${cx}px ${cy}px`, transform: "scaleY(0.577)" }}>
        <g className="pl-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M${cx} ${cy}L${cx} ${cy - r * 1.05}`} className="ln t-hi" />
        </g>
      </g>
      <circle cx={cx} cy={cy} r={2} className="ln plate t-hi" />
    </g>
  );
}

/** The fetch hub: one box with a port per source on its left face and a turning refresh ring on top. */
export function Hub({ o, ports = 5, w = 110, d = 80, h = 56 }: { o: P3; ports?: number; w?: number; d?: number; h?: number }) {
  const c = up(add(o, [w / 2, d / 2, 0]), h);
  const [cx, cy] = iso(c);
  return (
    <g>
      <Box
        at={o}
        size={[w, d, h]}
        left={(m) => (
          <g>
            {Array.from({ length: ports }, (_, i) => {
              const u = 12 + ((w - 24) * i) / Math.max(1, ports - 1);
              return <Face key={i} pts={[m(u - 4, 14), m(u + 4, 14), m(u + 4, 24), m(u - 4, 24)]} tone="mid" />;
            })}
            <Line pts={[m(8, h - 10), m(w - 8, h - 10)]} tone="lo" />
          </g>
        )}
        right={(m) => (
          <g>
            <Face pts={[m(d / 2 - 6, 16), m(d / 2 + 6, 16), m(d / 2 + 6, 28), m(d / 2 - 6, 28)]} tone="hi" />
            <Line pts={[m(8, h - 10), m(d - 8, h - 10)]} tone="lo" />
          </g>
        )}
      />
      <Disc c={c} r={24} tone="mid" fill={false} />
      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: "scaleY(0.577)" }}>
        <g className="pl-spin-slow" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M${cx + 34} ${cy}A34 34 0 1 1 ${cx} ${cy - 34}`} className="ln t-hi" />
          <path d={`M${cx - 4} ${cy - 38}L${cx} ${cy - 34}L${cx - 4} ${cy - 30}`} className="ln t-hi" />
        </g>
      </g>
    </g>
  );
}

/** A cabinet of drawers, one sliding out and back (the last good copy of each source). */
export function Cabinet({ o, n = 4 }: { o: P3; n?: number }) {
  const w = 54;
  const d = 44;
  const h = 18 * n + 8;
  return (
    <g>
      <Box at={o} size={[w, d, h]} />
      {Array.from({ length: n }, (_, i) => {
        const z = 4 + i * 18;
        const out = i === 1;
        return (
          <g key={i} className={out ? "pl-drawer" : undefined}>
            <Box
              at={add(o, [w - 2, 4, z])}
              size={[out ? 22 : 4, d - 8, 14]}
              right={(m) => <Line pts={[m(d / 2 - 12, 7), m(d / 2 + 4, 7)]} tone="mid" />}
            />
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ maps, frames, the tensor ----- */

const LON0 = 67.5;
const LON1 = 97.5;
const LAT0 = 7;
const LAT1 = 36;

/** India on a plate: east along +x, north along −y. Returns the plate and a lat/lon → 3D mapper. */
export function mapper(o: P3, w: number, d: number) {
  return (lat: number, lon: number, z = 0): P3 => [o[0] + ((lon - LON0) / (LON1 - LON0)) * w, o[1] + ((LAT1 - lat) / (LAT1 - LAT0)) * d, o[2] + z];
}

/** A rough outline of India (decoration; city positions are real). */
const INDIA: [number, number][] = [
  [35.5, 74.5], [34.5, 78.5], [32.5, 79], [30.5, 81], [28.5, 84], [27, 88.5], [27.5, 92], [28, 96], [26, 95], [23.5, 93.5], [22, 92.5],
  [22.5, 89], [21.5, 87.5], [20, 86.5], [17.5, 83], [15.5, 80.5], [13, 80.3], [10, 79.5], [8.1, 77.5], [9.5, 76.3], [12, 75], [15, 74],
  [18.5, 72.9], [21, 72.6], [22.3, 69.5], [23.6, 68.3], [24.5, 71], [27.5, 70.5], [29.5, 73.5], [32, 74.8], [35.5, 74.5],
];

export function MapPlate({ o, w, d, cities = true, outline = true, children }: { o: P3; w: number; d: number; cities?: boolean; outline?: boolean; children?: (m: ReturnType<typeof mapper>) => ReactNode }) {
  const m = mapper(o, w, d);
  return (
    <g>
      <Box at={add(o, [0, 0, -6])} size={[w, d, 6]} />
      {outline && <Line pts={INDIA.map(([la, lo]) => m(la, lo))} tone="lo" close />}
      {cities &&
        CITIES.map((c) => {
          const [x, y] = iso(m(c.lat, c.lon));
          return <circle key={c.slug} cx={x} cy={y} r={1.7} className="ln plate t-edge" />;
        })}
      {children?.(m)}
    </g>
  );
}

/** One frame: a 33 × 20 grid on a thin slab. `holes` marks gaps (cells drawn hollow and dashed). */
export function Slab({ o, w = 120, d = 80, rows = 11, cols = 10, h = 5, holes = [] as number[], tone = "edge" as Tone, className }: { o: P3; w?: number; d?: number; rows?: number; cols?: number; h?: number; holes?: number[]; tone?: Tone; className?: string }) {
  return (
    <Box
      at={o}
      size={[w, d, h]}
      tone={tone}
      className={className}
      top={(m) => (
        <g>
          {Array.from({ length: cols - 1 }, (_, i) => (
            <Line key={`c${i}`} pts={[m(((i + 1) * w) / cols, 0), m(((i + 1) * w) / cols, d)]} tone="lo" />
          ))}
          {Array.from({ length: rows - 1 }, (_, i) => (
            <Line key={`r${i}`} pts={[m(0, ((i + 1) * d) / rows), m(w, ((i + 1) * d) / rows)]} tone="lo" />
          ))}
          {holes.map((k) => {
            const i = k % cols;
            const j = Math.floor(k / cols) % rows;
            const u0 = (i * w) / cols + 2;
            const v0 = (j * d) / rows + 2;
            return <Line key={k} pts={[m(u0, v0), m(u0 + w / cols - 4, v0), m(u0 + w / cols - 4, v0 + d / rows - 4), m(u0, v0 + d / rows - 4)]} close tone="mid" dash="2 2" />;
          })}
        </g>
      )}
    />
  );
}

/** A storage drum (a file on disk). */
export function Drum({ o, r = 22, h = 34, bands = 2 }: { o: P3; r?: number; h?: number; bands?: number }) {
  const [x, y] = iso(o);
  const rx = r * Math.SQRT2 * Math.cos(Math.PI / 6);
  const ry = r * Math.SQRT2 * 0.5;
  return (
    <Cyl c={o} r={r} h={h}>
      {Array.from({ length: bands }, (_, i) => {
        const yy = y - ((i + 1) * h) / (bands + 1);
        return <path key={i} d={`M${x - rx} ${yy}A${rx} ${ry} 0 0 0 ${x + rx} ${yy}`} className="ln t-lo" />;
      })}
    </Cyl>
  );
}

/** A sheet of paper standing up: a document (a JSON context, a CSV, a card). */
export function Sheet({ o, w = 46, h = 60, lines = 6, tone = "edge" as Tone }: { o: P3; w?: number; h?: number; lines?: number; tone?: Tone }) {
  const P = (u: number, v: number): P3 => [o[0] + u, o[1], o[2] + v];
  return (
    <g>
      <Face pts={[P(0, 0), P(w, 0), P(w, h - 10), P(w - 10, h), P(0, h)]} tone={tone} />
      <Line pts={[P(w - 10, h), P(w - 10, h - 10), P(w, h - 10)]} tone="lo" />
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} pts={[P(6, h - 14 - i * ((h - 20) / lines)), P(w - 8 - ((i * 7) % 15), h - 14 - i * ((h - 20) / lines))]} tone="lo" />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ the model -------------------- */

/** The model's graph on a plate: its 138 station nodes, each joined to its 8 nearest within 600 km. */
export function ModelGraph({ o, w, d, flow = true }: { o: P3; w: number; d: number; flow?: boolean }) {
  const m = mapper(o, w, d);
  const km = (a: [number, number], b: [number, number]) => {
    const r = Math.PI / 180;
    const x = (b[1] - a[1]) * r * Math.cos(((a[0] + b[0]) / 2) * r);
    const y = (b[0] - a[0]) * r;
    return 6371 * Math.hypot(x, y);
  };
  const edges = new Set<string>();
  MODEL_NODES.forEach((a, i) => {
    MODEL_NODES.map((b, j) => [j, km(a, b)] as const)
      .filter(([j, dk]) => j !== i && dk <= 600)
      .sort((p, q) => p[1] - q[1])
      .slice(0, 8)
      .forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`));
  });
  const pts = MODEL_NODES.map(([la, lo]) => iso(m(la, lo, 0)));
  const segs = [...edges].map((e) => e.split("-").map(Number));
  return (
    <g>
      <Box at={add(o, [0, 0, -6])} size={[w, d, 6]} />
      <Line pts={INDIA.map(([la, lo]) => m(la, lo))} tone="lo" close />
      <path d={segs.map(([i, j]) => d2([pts[i], pts[j]])).join("")} className="ln t-lo" />
      {flow && <path d={segs.filter((_, k) => k % 3 === 0).map(([i, j]) => d2([pts[i], pts[j]])).join("")} className="ln t-mid pl-flow" strokeDasharray="2 9" />}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} className="ln plate t-edge" />
      ))}
    </g>
  );
}

/** Four stacked traces: a signal split by the causal wavelet into three detail bands and a trend. */
export function WaveletBands({ o, w = 120 }: { o: P3; w?: number }) {
  const rows: ReactNode[] = [];
  const freq = [9, 5, 2.6, 0.8];
  const amp = [3, 5, 7, 9];
  freq.forEach((f, k) => {
    const z = 8 + k * 18;
    const pts: P3[] = Array.from({ length: 41 }, (_, i) => {
      const u = (i / 40) * w;
      const v = Math.sin((i / 40) * Math.PI * 2 * f + k) * amp[k] * (k === 3 ? 0.5 : 0.8) + (k === 3 ? (i / 40) * 6 : 0);
      return [o[0] + u, o[1], o[2] + z + v * 0.8];
    });
    rows.push(<Face key={`p${k}`} pts={[[o[0], o[1], o[2] + z - 9], [o[0] + w, o[1], o[2] + z - 9], [o[0] + w, o[1], o[2] + z + 9], [o[0], o[1], o[2] + z + 9]]} tone="lo" />);
    rows.push(<Line key={`t${k}`} pts={pts} tone={k === 3 ? "hi" : "mid"} />);
  });
  return <g>{rows}</g>;
}

/** Self-attention: a row of tokens, each attending only to itself and the past (a causal triangle). */
export function Attention({ o, n = 7, w = 120, layers = 2 }: { o: P3; n?: number; w?: number; layers?: number }) {
  const out: ReactNode[] = [];
  for (let L = 0; L < layers; L++) {
    const z0 = o[2] + L * 46;
    out.push(<Box key={`b${L}`} at={[o[0], o[1], z0]} size={[w, 26, 6]} />);
    const tok = (i: number, z: number): P3 => [o[0] + 8 + ((w - 16) * i) / (n - 1), o[1] + 13, z];
    for (let i = 0; i < n; i++) {
      out.push(<Cyl key={`t${L}${i}`} c={tok(i, z0 + 6)} r={4} h={5} />);
      for (let j = 0; j <= i; j++) {
        if (i - j > 3) continue;
        out.push(<Line key={`a${L}${i}${j}`} pts={[tok(j, z0 + 11), [lerp(tok(j, 0)[0], tok(i, 0)[0], 0.5), o[1] + 13, z0 + 11 + 14 + (i - j) * 4], tok(i, z0 + 46)]} tone={j === i - 1 ? "mid" : "lo"} className={j === i - 1 ? "pl-flow" : undefined} dash={j === i - 1 ? "2 6" : undefined} />);
      }
    }
  }
  return <g>{out}</g>;
}

/** ConvLSTM: a run of grid maps over time, a 3 × 3 kernel window sweeping the newest. */
export function ConvGrid({ o, steps = 5, w = 70, d = 70 }: { o: P3; steps?: number; w?: number; d?: number }) {
  return (
    <g>
      {Array.from({ length: steps }, (_, t) => {
        const at = add(o, [t * 16, -t * 16, t * 4]);
        const last = t === steps - 1;
        return (
          <g key={t}>
            <Slab o={at} w={w} d={d} rows={8} cols={8} h={3} tone={last ? "edge" : "mid"} />
            {last && (
              <g className="pl-kernel">
                <Line pts={[add(at, [0, 0, 3.5]), add(at, [26, 0, 3.5]), add(at, [26, 26, 3.5]), add(at, [0, 26, 3.5])]} close tone="hi" />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The decoder's 48 hourly leads as bars rising one after another. */
export function LeadBars({ o, n = 24, w = 130 }: { o: P3; n?: number; w?: number }) {
  return (
    <g>
      <Box at={add(o, [0, 0, -4])} size={[w, 14, 4]} />
      {Array.from({ length: n }, (_, i) => {
        const h = 10 + 26 * (0.5 + 0.5 * Math.sin(i / 3.2)) + i * 0.4;
        const x = o[0] + 3 + ((w - 8) * i) / (n - 1);
        return <Line key={i} pts={[[x, o[1] + 7, o[2]], [x, o[1] + 7, o[2] + h]]} tone={i % 4 === 0 ? "edge" : "mid"} className="pl-grow" />;
      })}
    </g>
  );
}

/** A chip: a square die with pins (the CPU that runs the ONNX seeds). */
export function Chip({ o, s = 34, tone = "edge" as Tone }: { o: P3; s?: number; tone?: Tone }) {
  return (
    <g>
      {Array.from({ length: 5 }, (_, i) => {
        const u = 5 + ((s - 10) * i) / 4;
        return (
          <g key={i}>
            <Line pts={[add(o, [u, s, 1]), add(o, [u, s + 6, 0])]} tone="mid" />
            <Line pts={[add(o, [s, u, 1]), add(o, [s + 6, u, 0])]} tone="mid" />
          </g>
        );
      })}
      <Box at={o} size={[s, s, 5]} tone={tone} top={(m) => <Line pts={[m(8, 8), m(s - 8, 8), m(s - 8, s - 8), m(8, s - 8)]} close tone="lo" />} />
    </g>
  );
}

/* ------------------------------------------------------------------ the people's end ------------- */

/** A laptop, open, its screen showing a map with a few points. */
export function Laptop({ o, w = 110, d = 76 }: { o: P3; w?: number; d?: number }) {
  const P = (u: number, v: number): P3 => [o[0] + u, o[1], o[2] + 6 + v];
  return (
    <g>
      <Box at={o} size={[w, d, 6]} top={(m) => <Line pts={[m(10, 18), m(w - 10, 18), m(w - 10, d - 22), m(10, d - 22)]} close tone="lo" />} />
      <Face pts={[P(0, 0), P(w, 0), P(w, 72), P(0, 72)]} />
      <Line pts={[P(6, 6), P(w - 6, 6), P(w - 6, 66), P(6, 66)]} close tone="mid" />
      <Line pts={[P(18, 16), P(36, 30), P(52, 22), P(70, 42), P(92, 34)]} tone="hi" className="pl-trace" />
      {[[30, 50], [58, 48], [80, 56]].map(([u, v]) => (
        <circle key={u} cx={iso(P(u, v))[0]} cy={iso(P(u, v))[1]} r={2} className="ln plate t-edge" />
      ))}
    </g>
  );
}

/** A phone standing up. */
export function Phone({ o }: { o: P3 }) {
  const P = (u: number, v: number): P3 => [o[0], o[1] + u, o[2] + v];
  return (
    <g>
      <Face pts={[P(0, 0), P(34, 0), P(34, 64), P(0, 64)]} />
      <Line pts={[P(3, 6), P(31, 6), P(31, 58), P(3, 58)]} close tone="lo" />
      {[14, 24, 34].map((v) => (
        <Line key={v} pts={[P(7, 58 - v), P(27 - (v % 3) * 4, 58 - v)]} tone="mid" />
      ))}
    </g>
  );
}

/** Speech bubbles rising (the chat, streamed). */
export function Bubbles({ o }: { o: P3 }) {
  const [x, y] = iso(o);
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} className="pl-rise" style={{ animationDelay: `${i * 1.2}s` }}>
          <path d={`M${x + (i % 2 ? 12 : -12) - 20} ${y - 10}h40v18h-${i % 2 ? 8 : 28}l-6 6v-6h-${i % 2 ? 26 : 6}z`} className="ln plate t-edge" />
          <path d={`M${x + (i % 2 ? 12 : -12) - 14} ${y - 1}h${18 + i * 5}`} className="ln t-mid" />
        </g>
      ))}
    </g>
  );
}

/** A scatter of ranks with its fitted rising line (Spearman's rank correlation). */
export function RankScatter({ o, w = 100, d = 100 }: { o: P3; w?: number; d?: number }) {
  const ranks = [3, 1, 4, 2, 6, 5, 8, 7, 9, 11, 10, 12];
  return (
    <g>
      <Box at={add(o, [0, 0, -5])} size={[w, d, 5]} top={(m) => <Line pts={[m(8, d - 8), m(w - 6, d - 8)]} tone="mid" />} />
      {ranks.map((r, i) => {
        const p: P3 = [o[0] + 10 + ((w - 20) * i) / 11, o[1] + d - 10 - ((d - 20) * (r - 1)) / 11, o[2]];
        const [x, y] = iso(p);
        return <circle key={i} cx={x} cy={y} r={2} className="ln plate t-edge" />;
      })}
      <Line pts={[[o[0] + 10, o[1] + d - 12, o[2]], [o[0] + w - 10, o[1] + 10, o[2]]]} tone="hi" />
    </g>
  );
}

/** Insight cards fanned on a tray (six of them). */
export function Cards({ o }: { o: P3 }) {
  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} className={i === 5 ? "pl-lift" : undefined}>
          <Box
            at={add(o, [i * 9, -i * 3, i * 7])}
            size={[60, 40, 3]}
            tone={i === 5 ? "hi" : "edge"}
            top={(m) => (
              <g>
                <Line pts={[m(6, 8), m(34, 8)]} tone="mid" />
                <Line pts={[m(6, 18), m(52, 18)]} tone="lo" />
                <Line pts={[m(6, 26), m(44, 26)]} tone="lo" />
              </g>
            )}
          />
        </g>
      ))}
    </g>
  );
}

/** A shield: per-IP rate limits on the endpoints that cost money. */
export function Shield({ o, s = 1 }: { o: P3; s?: number }) {
  const [x, y] = iso(o);
  return <path d={`M${x} ${y - 26 * s}L${x + 12 * s} ${y - 21 * s}L${x + 11 * s} ${y - 8 * s}Q${x + 7 * s} ${y - 1 * s} ${x} ${y + 2 * s}Q${x - 7 * s} ${y - 1 * s} ${x - 11 * s} ${y - 8 * s}L${x - 12 * s} ${y - 21 * s}Z`} className="ln plate t-edge" />;
}

/** A small person (the reader). */
export function Person({ o }: { o: P3 }) {
  const [x, y] = iso(o);
  return (
    <g>
      <ellipse cx={x} cy={y} rx={12} ry={5} className="ln t-lo" />
      <path d={`M${x - 9} ${y}Q${x - 10} ${y - 30} ${x} ${y - 32}Q${x + 10} ${y - 30} ${x + 9} ${y}`} className="ln plate t-edge" />
      <circle cx={x} cy={y - 40} r={7} className="ln plate t-edge" />
    </g>
  );
}

export { ring3 };
export type { P2 };
