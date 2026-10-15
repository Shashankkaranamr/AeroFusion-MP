"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useTheme } from "next-themes";
import { useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { Landmark } from "@/lib/cities";
import { fbm, mulberry32 } from "@/lib/rng";
import { clamp, cn } from "@/lib/utils";
import { mix, rgba } from "./color";
import { LandmarkGlyph } from "./landmarks";
import { PmParticles } from "./particles";

export type SkyVariant = "city" | "mountains" | "orbit";

const W = 1600;
const H = 400;
const GROUND = 362;

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

interface Palette {
  top: string;
  mid: string;
  horizon: string;
  sun: string;
  far: string;
  near: string;
  trees: string;
  treesBack: string;
}

function lightPalette(hour: number): Palette {
  if (hour >= 5 && hour < 8.5)
    return { top: "#7fb3e0", mid: "#cfe2f1", horizon: "#fcd9b4", sun: "#ffd9a0", far: "#a9bccb", near: "#6c8794", trees: "#1c4a37", treesBack: "#3f6f5c" };
  if (hour >= 8.5 && hour < 16)
    return { top: "#5aa6e4", mid: "#bfe0f6", horizon: "#eef7fb", sun: "#fff4d6", far: "#a8c2cf", near: "#67838f", trees: "#1b4a36", treesBack: "#3d705b" };
  if (hour >= 16 && hour < 19.5)
    return { top: "#7b9cd6", mid: "#e8c3bb", horizon: "#fdc995", sun: "#ffbe76", far: "#b3b5c3", near: "#6c7686", trees: "#1d4636", treesBack: "#4a6a5a" };
  return { top: "#6a7cb6", mid: "#b9b5d8", horizon: "#f0c8b2", sun: "#fff2e2", far: "#a5a9c4", near: "#636b86", trees: "#1c4034", treesBack: "#475f5c" };
}

const DARK: Palette = {
  top: "#030713",
  mid: "#0a1430",
  horizon: "#231a3a",
  sun: "#e6eeff",
  far: "#121b30",
  near: "#0b1222",
  trees: "#030c08",
  treesBack: "#08150f",
};

const SKIP: Record<Landmark, [number, number]> = {
  indiaGate: [-330, 90],
  gateway: [-90, 90],
  victoria: [-135, 135],
  charminar: [-70, 70],
  vidhana: [-160, 160],
  gopuram: [-65, 65],
  taj: [-125, 125],
  dome: [-85, 85],
  generic: [-85, 230],
};

interface Building {
  x: number;
  w: number;
  h: number;
  step: number;
  antenna: boolean;
  windows: { x: number; y: number }[];
}

function buildSkyline(seed: number, from: number, to: number, minH: number, maxH: number, skip?: [number, number]) {
  const rnd = mulberry32(seed);
  const out: Building[] = [];
  let x = from;
  while (x < to) {
    const w = 26 + rnd() * 52;
    if (skip && x + w > skip[0] && x < skip[1]) {
      x = skip[1] + 6;
      continue;
    }
    const center = (x - from) / (to - from);
    const envelope = 0.55 + 0.45 * Math.sin(center * Math.PI);
    const h = minH + (maxH - minH) * envelope * (0.35 + 0.65 * rnd());
    const windows: { x: number; y: number }[] = [];
    for (let wy = GROUND - h + 8; wy < GROUND - 8; wy += 10) {
      for (let wx = x + 5; wx < x + w - 6; wx += 8) {
        if (rnd() < 0.24) windows.push({ x: wx, y: wy });
      }
    }
    out.push({ x, w, h, step: rnd() < 0.35 ? 6 + rnd() * 14 : 0, antenna: rnd() < 0.18, windows });
    x += w + 2 + rnd() * 8;
  }
  return out;
}

function trees(seed: number, yBase: number, minR: number, maxR: number) {
  const rnd = mulberry32(seed);
  const out: { cx: number; cy: number; r: number }[] = [];
  let x = -30;
  while (x < W + 40) {
    const r = minR + rnd() * (maxR - minR);
    out.push({ cx: x, cy: yBase - r * 0.5 + rnd() * 10, r });
    x += r * (0.7 + rnd() * 0.6);
  }
  return out;
}

function ridge(seed: number, base: number, amp: number, scale: number) {
  const pts: string[] = [`M0,${H}`];
  for (let x = 0; x <= W; x += 16) {
    const y = base - amp * (0.5 + 0.5 * fbm(seed, x / scale, 4)) - 40 * Math.sin((x / W) * Math.PI) * (amp / 120);
    pts.push(`L${x},${y.toFixed(1)}`);
  }
  pts.push(`L${W},${H} Z`);
  return pts.join(" ");
}

function ridgeY(seed: number, base: number, amp: number, scale: number, x: number) {
  return base - amp * (0.5 + 0.5 * fbm(seed, x / scale, 4)) - 40 * Math.sin((x / W) * Math.PI) * (amp / 120);
}

export interface SkySceneProps {
  pm?: number;
  variant?: SkyVariant;
  landmark?: Landmark;
  hour?: number;
  seed?: number;
  className?: string;
  /** Labels for the "mountains" variant's network path. */
  pathLabels?: { title: string; subtitle: string }[];
  children?: ReactNode;
  particles?: boolean;
  /** Keep the right-hand side (landmark) in view when the container is tall. */
  align?: "center" | "right";
  /** Extra sky (viewBox units) above the scene, for tall hero containers. */
  extendTop?: number;
}

export function SkyScene({
  pm = 55,
  variant = "city",
  landmark = "generic",
  hour,
  seed = 7,
  className,
  pathLabels,
  children,
  particles = true,
  align = "center",
  extendTop = 0,
}: SkySceneProps) {
  const mounted = useMounted();
  const { resolvedTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const yFar = useTransform(scrollY, [0, 500], [0, 70]);
  const yMid = useTransform(scrollY, [0, 500], [0, 38]);
  const yNear = useTransform(scrollY, [0, 500], [0, 12]);

  const istHour = hour ?? (mounted ? (new Date().getUTCHours() + 5.5) % 24 : 11);
  const haze = clamp((pm - 22) / 175, 0, 1);

  const pal = useMemo(() => {
    const p = dark ? DARK : lightPalette(istHour);
    if (dark) {
      return {
        ...p,
        horizon: mix(p.horizon, "#5a3320", haze * 0.65),
        mid: mix(p.mid, "#2a2036", haze * 0.4),
        far: mix(p.far, "#3a2a2a", haze * 0.35),
      };
    }
    // Smog reads as a warm amber-brown veil (low sun through particulates), not flat grey.
    const dust = "#e2b98c";
    return {
      ...p,
      top: mix(p.top, "#c2b8a8", haze * 0.5),
      mid: mix(p.mid, "#e6cfae", haze * 0.6),
      horizon: mix(p.horizon, dust, haze * 0.75),
      far: mix(p.far, mix(dust, "#9a8f86", 0.4), 0.2 + haze * 0.45),
      near: mix(p.near, mix(p.horizon, "#7d7068", 0.5), haze * 0.3),
      treesBack: mix(p.treesBack, dust, haze * 0.2),
    };
  }, [dark, istHour, haze]);

  const sky = useMemo(() => {
    const lx = variant === "city" ? 1210 : 1200;
    const skip = SKIP[landmark];
    return {
      lx,
      far: buildSkyline(seed * 13 + 1, 360, W + 20, 26, 96),
      mid: buildSkyline(seed * 29 + 3, 640, W + 20, 40, 150, [lx + skip[0], lx + skip[1]]),
      treesBack: trees(seed * 7 + 5, 392, 18, 34),
      treesFront: trees(seed * 11 + 9, 418, 22, 46),
      stars: Array.from({ length: 70 + Math.round(extendTop / 4) }, (_, i) => {
        const r = mulberry32(seed * 101 + i);
        return { x: r() * W, y: -extendTop + r() * (230 + extendTop), r: 0.4 + r() * 1.1, d: r() * 4 };
      }),
    };
  }, [landmark, seed, variant, extendTop]);

  const id = `sky-${variant}-${seed}`;

  if (!mounted) {
    return <div className={cn("relative overflow-hidden", className)} aria-hidden />;
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className={cn("relative overflow-hidden", className)}
      aria-hidden
    >
      <svg
        viewBox={`0 ${-extendTop} ${W} ${H + extendTop}`}
        preserveAspectRatio={align === "right" ? "xMaxYMax slice" : "xMidYMax slice"}
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.top} />
            <stop offset="0.6" stopColor={pal.mid} />
            <stop offset="1" stopColor={pal.horizon} />
          </linearGradient>
          <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={pal.sun} stopOpacity={dark ? 0.95 : 1} />
            <stop offset="0.18" stopColor={pal.sun} stopOpacity={dark ? 0.5 : 0.75} />
            <stop offset="1" stopColor={pal.sun} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={dark ? "#3b2a22" : "#e6d6bd"} stopOpacity="0" />
            <stop offset="0.55" stopColor={dark ? "#6b3b20" : "#e3c7a2"} stopOpacity={0.1 + haze * 0.42} />
            <stop offset="1" stopColor={dark ? "#8a4a22" : "#dcb98f"} stopOpacity={0.16 + haze * 0.5} />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="0.62" cy="1" r="0.75">
            <stop offset="0" stopColor="#ff8a3d" stopOpacity={dark ? 0.1 + haze * 0.45 : 0} />
            <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-earth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={dark ? "#0d3a63" : "#3d86c6"} />
            <stop offset="0.45" stopColor={dark ? "#082642" : "#2a6aa6"} />
            <stop offset="1" stopColor={dark ? "#03111f" : "#1a4b7a"} />
          </linearGradient>
          <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <clipPath id={`${id}-earth-clip`}>
            <circle cx={1260} cy={1520} r={1240} />
          </clipPath>
        </defs>

        {/* Sky */}
        <rect y={-extendTop} width={W} height={H + extendTop} fill={`url(#${id}-sky)`} />

        {/* Stars */}
        {(dark || variant === "orbit") && (
          <g opacity={dark ? 1 : 0.0}>
            {sky.stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={0.35 + (i % 5) * 0.12}>
                <animate attributeName="opacity" values="0.2;0.9;0.2" dur={`${3 + s.d}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        )}

        {/* Sun / moon */}
        <circle cx={dark ? 1330 : 1290} cy={(dark ? 92 : 118) - extendTop * 0.3} r={dark ? 150 : 230} fill={`url(#${id}-sun)`} />
        {dark && <circle cx={1330} cy={92 - extendTop * 0.3} r={16} fill="#eef3ff" opacity={0.92} />}
        {!dark && <circle cx={1290} cy={118 - extendTop * 0.3} r={28} fill={pal.sun} opacity={0.9 - haze * 0.4} />}

        {/* Clouds */}
        <g filter={`url(#${id}-blur)`} opacity={dark ? 0.12 : 0.75 - haze * 0.25}>
          <g className="animate-sway">
            <ellipse cx={200} cy={90} rx={160} ry={26} fill="#ffffff" />
            <ellipse cx={620} cy={60} rx={120} ry={20} fill="#ffffff" />
            <ellipse cx={1000} cy={140} rx={180} ry={24} fill="#ffffff" />
          </g>
        </g>

        {variant === "city" && (
          <>
            <motion.g style={{ y: yFar }}>
              <g fill={pal.far}>
                {sky.far.map((b, i) => (
                  <g key={i}>
                    <rect x={b.x} y={GROUND - 12 - b.h * 0.75} width={b.w} height={b.h * 0.75 + 14} />
                    {b.step > 0 && <rect x={b.x + b.w * 0.25} y={GROUND - 12 - b.h * 0.75 - b.step} width={b.w * 0.5} height={b.step + 1} />}
                  </g>
                ))}
              </g>
              <rect y={150} width={W} height={H - 150} fill={`url(#${id}-haze)`} />
            </motion.g>

            <motion.g style={{ y: yMid }}>
              <g fill={pal.near}>
                {sky.mid.map((b, i) => (
                  <g key={i}>
                    <rect x={b.x} y={GROUND - b.h} width={b.w} height={b.h + 4} />
                    {b.step > 0 && <rect x={b.x + b.w * 0.2} y={GROUND - b.h - b.step} width={b.w * 0.6} height={b.step + 1} />}
                    {b.antenna && <rect x={b.x + b.w / 2 - 1} y={GROUND - b.h - b.step - 22} width={2} height={22} />}
                  </g>
                ))}
                <g transform={`translate(${sky.lx},${GROUND + 2}) scale(1.16)`} style={{ color: mix(pal.near, dark ? "#000000" : "#2e4651", 0.18) }} fill="currentColor">
                  <LandmarkGlyph kind={landmark} />
                </g>
              </g>
              {dark && (
                <g fill="#fcd77a">
                  {sky.mid.flatMap((b, i) =>
                    b.windows.map((w, j) => <rect key={`${i}-${j}`} x={w.x} y={w.y} width={3} height={4} opacity={0.5 + ((i + j) % 4) * 0.12} />),
                  )}
                </g>
              )}
              <rect y={220} width={W} height={H - 220} fill={`url(#${id}-haze)`} opacity={0.75} />
              <rect width={W} height={H} fill={`url(#${id}-glow)`} />
            </motion.g>
          </>
        )}

        {variant === "mountains" && (
          <>
            <motion.g style={{ y: yFar }}>
              <path d={ridge(seed + 1, 250, 150, 420)} fill={mix(pal.far, pal.horizon, 0.25)} />
              <rect y={160} width={W} height={H - 160} fill={`url(#${id}-haze)`} opacity={0.8} />
            </motion.g>
            <motion.g style={{ y: yMid }}>
              <path d={ridge(seed + 2, 320, 140, 300)} fill={dark ? "#0b1a1c" : mix("#4d7a6c", pal.horizon, 0.25 + haze * 0.3)} />
              <g filter={`url(#${id}-blur)`} opacity={dark ? 0.15 : 0.6}>
                <g className="animate-sway [animation-duration:52s]">
                  <ellipse cx={300} cy={300} rx={420} ry={22} fill="#ffffff" />
                  <ellipse cx={1100} cy={318} rx={380} ry={18} fill="#ffffff" />
                </g>
              </g>
              <NetworkPath dark={dark} seed={seed} labels={pathLabels} />
            </motion.g>
            <motion.g style={{ y: yNear }}>
              <path d={ridge(seed + 3, 410, 70, 220)} fill={pal.trees} />
              <Conifers seed={seed} color={pal.trees} />
            </motion.g>
          </>
        )}

        {variant === "orbit" && (
          <>
            <motion.g style={{ y: yMid }}>
              <circle cx={1260} cy={1520} r={1290} fill="none" stroke={dark ? "#38bdf8" : "#bae6fd"} strokeOpacity={0.35} strokeWidth={60} filter={`url(#${id}-blur)`} />
              <circle cx={1260} cy={1520} r={1240} fill={`url(#${id}-earth)`} />
              <g clipPath={`url(#${id}-earth-clip)`}>
                <path
                  d="M820,420 C880,360 960,330 1040,318 C1100,300 1150,296 1200,300 C1240,284 1290,282 1320,296 C1360,290 1400,300 1440,322 C1480,330 1530,350 1600,380 L1600,420 Z"
                  fill={dark ? "#0f2a1f" : "#4f8f5b"}
                  opacity={dark ? 0.9 : 0.85}
                />
                <path d="M1120,330 C1160,318 1200,320 1230,332 C1210,350 1170,356 1140,348 Z" fill={dark ? "#14321f" : "#7ba35f"} opacity={0.8} />
                <g filter={`url(#${id}-soft)`} opacity={dark ? 0.25 : 0.7}>
                  <ellipse cx={980} cy={350} rx={120} ry={10} fill="#ffffff" />
                  <ellipse cx={1380} cy={318} rx={90} ry={8} fill="#ffffff" />
                  <ellipse cx={1210} cy={300} rx={70} ry={6} fill="#ffffff" />
                </g>
                {dark &&
                  [1150, 1180, 1215, 1240, 1270, 1300, 1330, 1365, 1105, 1420].map((x, i) => (
                    <circle key={x} cx={x} cy={318 + (i % 4) * 12} r={2.2} fill="#fcd77a">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
              </g>
              <circle cx={1260} cy={1520} r={1240} fill="none" stroke={dark ? "#7dd3fc" : "#e0f2fe"} strokeOpacity={0.8} strokeWidth={3} />
            </motion.g>
            <motion.g style={{ y: yFar }}>
              <Satellite dark={dark} />
            </motion.g>
          </>
        )}

        {/* Foreground trees */}
        {variant === "city" && (
          <motion.g style={{ y: yNear }}>
            <g fill={pal.treesBack}>
              {sky.treesBack.map((t, i) => (
                <circle key={i} cx={t.cx} cy={t.cy} r={t.r} />
              ))}
              <rect y={386} width={W} height={20} />
            </g>
            <g fill={pal.trees}>
              {sky.treesFront.map((t, i) => (
                <circle key={i} cx={t.cx} cy={t.cy} r={t.r} />
              ))}
            </g>
          </motion.g>
        )}
      </svg>

      {particles && <PmParticles pm={pm} dark={dark} className="pointer-events-none absolute inset-0 size-full" />}
      {children}
    </motion.div>
  );
}

function Conifers({ seed, color }: { seed: number; color: string }) {
  const rnd = mulberry32(seed * 3 + 77);
  const items: string[] = [];
  for (let x = 0; x < W; x += 9 + rnd() * 10) {
    const y = ridgeY(seed + 3, 410, 70, 220, x) + 4;
    const h = 14 + rnd() * 20;
    const w = h * 0.42;
    items.push(`M${x - w / 2},${y} L${x},${y - h} L${x + w / 2},${y} Z`);
  }
  return <path d={items.join(" ")} fill={color} />;
}

function NetworkPath({ dark, seed, labels }: { dark: boolean; seed: number; labels?: { title: string; subtitle: string }[] }) {
  const xs = [760, 960, 1140, 1310, 1480];
  const pts = xs.map((x, i) => ({ x, y: ridgeY(seed + 2, 320, 140, 300, x) - 70 - (i % 2) * 34 - i * 10 }));
  let d = `M${pts[0].x - 140},${pts[0].y + 60}`;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = i === 0 ? { x: pts[0].x - 140, y: pts[0].y + 60 } : pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    d += ` C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }
  const stroke = dark ? "#5eead4" : "#ffffff";
  return (
    <g>
      <path d={d} fill="none" stroke={stroke} strokeOpacity={0.35} strokeWidth={6} style={{ filter: "blur(4px)" }} />
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={14} fill={dark ? "#2dd4bf" : "#ffffff"} opacity={0.25}>
            <animate attributeName="r" values="9;18;9" dur="2.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={p.x} cy={p.y} r={5.5} fill={dark ? "#5eead4" : "#ffffff"} stroke={dark ? "#0f766e" : "#0b7a55"} strokeWidth={2} />
          {labels?.[i] && (
            <g transform={`translate(${p.x - 64},${p.y - 66})`}>
              <rect width={128} height={44} rx={10} fill={dark ? "rgba(8,20,18,0.72)" : "rgba(255,255,255,0.78)"} stroke={dark ? "rgba(94,234,212,0.25)" : "rgba(255,255,255,0.9)"} />
              <text x={12} y={19} fontSize={13.5} fontWeight={600} fill={dark ? "#e6f1eb" : "#0b1f17"} fontFamily="-apple-system, BlinkMacSystemFont, var(--font-inter), sans-serif">
                {labels[i].title}
              </text>
              <text x={12} y={34} fontSize={10.5} fill={dark ? "#94a89f" : "#55675f"} fontFamily="-apple-system, BlinkMacSystemFont, var(--font-inter), sans-serif">
                {labels[i].subtitle}
              </text>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

function Satellite({ dark }: { dark: boolean }) {
  const panel = dark ? "#1e3a8a" : "#1d4ed8";
  return (
    <g>
      <line x1={1060} y1={150} x2={1230} y2={300} stroke={dark ? "#5eead4" : "#ffffff"} strokeOpacity={0.8} strokeWidth={1.6} strokeDasharray="5 7" className="animate-dash" />
      <line x1={1060} y1={150} x2={1000} y2={340} stroke={dark ? "#5eead4" : "#ffffff"} strokeOpacity={0.5} strokeWidth={1.2} strokeDasharray="4 8" className="animate-dash" />
      <g className="animate-float" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <g transform="translate(1060,150) rotate(-18)">
          <rect x={-88} y={-13} width={64} height={26} rx={2} fill={panel} stroke={rgba("#93c5fd", 0.7)} />
          {[-80, -70, -60, -50, -40, -30].map((x) => (
            <line key={x} x1={x} y1={-13} x2={x} y2={13} stroke={rgba("#93c5fd", 0.5)} strokeWidth={0.8} />
          ))}
          <line x1={-88} y1={0} x2={-24} y2={0} stroke={rgba("#93c5fd", 0.5)} strokeWidth={0.8} />
          <rect x={24} y={-13} width={64} height={26} rx={2} fill={panel} stroke={rgba("#93c5fd", 0.7)} />
          {[32, 42, 52, 62, 72, 82].map((x) => (
            <line key={x} x1={x} y1={-13} x2={x} y2={13} stroke={rgba("#93c5fd", 0.5)} strokeWidth={0.8} />
          ))}
          <line x1={24} y1={0} x2={88} y2={0} stroke={rgba("#93c5fd", 0.5)} strokeWidth={0.8} />
          <rect x={-24} y={-2} width={48} height={4} fill="#9ca3af" />
          <rect x={-18} y={-16} width={36} height={32} rx={4} fill="#d4a017" stroke="#a16207" />
          <rect x={-18} y={-16} width={36} height={10} rx={3} fill="#e5c158" opacity={0.7} />
          <path d="M0,16 L-10,30 L10,30 Z" fill="#cbd5e1" />
          <circle cx={0} cy={30} r={6} fill="#e2e8f0" stroke="#94a3b8" />
        </g>
      </g>
    </g>
  );
}
