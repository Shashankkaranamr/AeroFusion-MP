"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { categoryForPm } from "@/lib/aqi";
import { bearingDeg, haversineKm } from "@/lib/live";

export interface FlowCity {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  pm25: number | null;
  wind: number | null;
  windDir: number | null;
}

export interface InflowLink {
  from: FlowCity;
  /** transport weight 0–1: distance kernel × wind alignment × wind speed */
  w: number;
  km: number;
  /** pollution carried = weight × source PM2.5 */
  load: number;
  share: number;
}

const RAD = Math.PI / 180;
const BBOX = { w: 64, e: 100, s: 4, n: 38 };

/** Cities whose current wind carries air toward `target` (physical prior, same as the model's graph). */
export function inflowTo(cities: FlowCity[], target: string, sigmaKm = 350, maxKm = 900): InflowLink[] {
  const t = cities.find((c) => c.slug === target);
  if (!t) return [];
  const raw = cities
    .filter((a) => a.slug !== target && a.wind !== null && a.windDir !== null && a.pm25 !== null)
    .map((a) => {
      const km = haversineKm(a, t);
      const toward = ((a.windDir as number) + 180) % 360;
      const align = Math.cos((bearingDeg(a, t) - toward) * RAD);
      const w = km > maxKm || align <= 0 ? 0 : Math.exp(-((km / sigmaKm) ** 2)) * align * ((a.wind as number) / ((a.wind as number) + 2));
      return { from: a, w, km, load: w * (a.pm25 as number), share: 0 };
    })
    .filter((l) => l.w > 0.01)
    .sort((x, y) => y.load - x.load)
    .slice(0, 6);
  const tot = raw.reduce((s, l) => s + l.load, 0) || 1;
  return raw.map((l) => ({ ...l, share: l.load / tot }));
}

/** Gridded u/v (m/s) from city winds by inverse-distance weighting. */
function buildField(cities: FlowCity[]) {
  const pts = cities
    .filter((c) => c.wind !== null && c.windDir !== null)
    .map((c) => {
      const to = ((c.windDir as number) + 180) * RAD;
      return { lat: c.lat, lon: c.lon, u: (c.wind as number) * Math.sin(to), v: (c.wind as number) * Math.cos(to) };
    });
  const step = 0.5;
  const nx = Math.round((BBOX.e - BBOX.w) / step) + 1;
  const ny = Math.round((BBOX.n - BBOX.s) / step) + 1;
  const U = new Float32Array(nx * ny);
  const V = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const lat = BBOX.s + j * step;
      const lon = BBOX.w + i * step;
      let su = 0;
      let sv = 0;
      let sw = 0;
      for (const p of pts) {
        const d2 = (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos(lat * RAD)) ** 2 + 0.3;
        const w = 1 / (d2 * d2);
        su += w * p.u;
        sv += w * p.v;
        sw += w;
      }
      U[j * nx + i] = sw ? su / sw : 0;
      V[j * nx + i] = sw ? sv / sw : 0;
    }
  return (lon: number, lat: number): [number, number] => {
    const i = Math.min(nx - 1, Math.max(0, Math.round((lon - BBOX.w) / step)));
    const j = Math.min(ny - 1, Math.max(0, Math.round((lat - BBOX.s) / step)));
    return [U[j * nx + i], V[j * nx + i]];
  };
}

function speedColor(s: number) {
  if (s < 1.5) return "rgba(186,230,253,0.75)";
  if (s < 3) return "rgba(125,211,252,0.85)";
  if (s < 5) return "rgba(255,255,255,0.9)";
  return "rgba(253,230,138,0.95)";
}

/** Animated wind particles + animated transport arrows into the selected city. Must be a child of <Map>. */
export function WindFlow({ cities, selected, showLinks, onLinks }: { cities: FlowCity[]; selected?: string; showLinks: boolean; onLinks?: (l: InflowLink[]) => void }) {
  const { current: mapRef } = useMap();
  const flow = useRef<HTMLCanvasElement>(null);
  const links = useRef<HTMLCanvasElement>(null);
  const field = useMemo(() => buildField(cities), [cities]);
  const inflow = useMemo(() => (showLinks && selected ? inflowTo(cities, selected) : []), [cities, selected, showLinks]);

  useEffect(() => onLinks?.(inflow), [inflow, onLinks]);

  useEffect(() => {
    const map = mapRef?.getMap();
    const fc = flow.current;
    const lc = links.current;
    if (!map || !fc || !lc) return;
    const fctx = fc.getContext("2d")!;
    const lctx = lc.getContext("2d")!;
    const target = cities.find((c) => c.slug === selected);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      for (const c of [fc, lc]) {
        c.width = w * dpr;
        c.height = h * dpr;
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const N = 1100;
    const spawn = () => ({ lon: BBOX.w + Math.random() * (BBOX.e - BBOX.w), lat: BBOX.s + Math.random() * (BBOX.n - BBOX.s), age: Math.floor(Math.random() * 90), x: NaN, y: NaN });
    const parts = Array.from({ length: N }, spawn);
    let raf = 0;
    let t = 0;
    let moving = false;
    const clear = () => {
      fctx.clearRect(0, 0, fc.width, fc.height);
      for (const p of parts) p.x = p.y = NaN;
    };
    const onMoveStart = () => {
      moving = true;
      clear();
    };
    const onMoveEnd = () => {
      moving = false;
      clear();
    };
    map.on("movestart", onMoveStart);
    map.on("moveend", onMoveEnd);
    map.on("resize", resize);

    const frame = () => {
      if (document.hidden) {
        raf = requestAnimationFrame(frame);
        return;
      }
      t++;
      // particles: fade old trails, then advance
      if (!moving) {
        fctx.globalCompositeOperation = "destination-out";
        fctx.fillStyle = "rgba(0,0,0,0.045)";
        fctx.fillRect(0, 0, fc.width, fc.height);
        fctx.globalCompositeOperation = "source-over";
        fctx.lineWidth = 1.8;
        fctx.lineCap = "round";
        const k = 0.012 * Math.max(0.35, 4 / Math.max(3, map.getZoom()) ** 1.6);
        for (const p of parts) {
          const [u, v] = field(p.lon, p.lat);
          const s = Math.hypot(u, v);
          p.lon += (u * k) / Math.cos(p.lat * RAD);
          p.lat += v * k;
          p.age++;
          const b = map.project([p.lon, p.lat]);
          const ax = p.x;
          const ay = p.y;
          p.x = b.x;
          p.y = b.y;
          if (p.age > 110 || p.lon < BBOX.w || p.lon > BBOX.e || p.lat < BBOX.s || p.lat > BBOX.n) {
            Object.assign(p, spawn(), { age: 0 });
            continue;
          }
          if (Number.isNaN(ax)) continue;
          fctx.strokeStyle = speedColor(s);
          fctx.beginPath();
          fctx.moveTo(ax, ay);
          fctx.lineTo(b.x, b.y);
          fctx.stroke();
        }
      }

      // transport arrows into the selected city (redrawn each frame with moving dashes)
      lctx.clearRect(0, 0, lc.width, lc.height);
      if (target && inflow.length) {
        const B = map.project([target.lon, target.lat]);
        for (const l of inflow) {
          const A = map.project([l.from.lon, l.from.lat]);
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2;
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const len = Math.hypot(dx, dy) || 1;
          const C = { x: mx - (dy / len) * len * 0.18, y: my + (dx / len) * len * 0.18 };
          const col = categoryForPm(l.from.pm25 ?? 0).color;
          const width = 1.5 + 6 * l.share;
          lctx.save();
          lctx.shadowColor = col;
          lctx.shadowBlur = 10;
          lctx.strokeStyle = col;
          lctx.globalAlpha = 0.95;
          lctx.lineWidth = width;
          lctx.setLineDash([10, 9]);
          lctx.lineDashOffset = -t * 0.9;
          lctx.beginPath();
          lctx.moveTo(A.x, A.y);
          lctx.quadraticCurveTo(C.x, C.y, B.x, B.y);
          lctx.stroke();
          // arrowhead near the target along the curve tangent
          const ang = Math.atan2(B.y - C.y, B.x - C.x);
          const hx = B.x - Math.cos(ang) * 12;
          const hy = B.y - Math.sin(ang) * 12;
          lctx.setLineDash([]);
          lctx.fillStyle = col;
          lctx.beginPath();
          lctx.moveTo(hx + Math.cos(ang) * 4, hy + Math.sin(ang) * 4);
          lctx.lineTo(hx - Math.cos(ang - 0.5) * (8 + width), hy - Math.sin(ang - 0.5) * (8 + width));
          lctx.lineTo(hx - Math.cos(ang + 0.5) * (8 + width), hy - Math.sin(ang + 0.5) * (8 + width));
          lctx.closePath();
          lctx.fill();
          // factor label at the curve's midpoint
          const qx = 0.25 * A.x + 0.5 * C.x + 0.25 * B.x;
          const qy = 0.25 * A.y + 0.5 * C.y + 0.25 * B.y;
          const label = `${Math.round(l.share * 100)}%`;
          lctx.shadowBlur = 0;
          lctx.font = "600 11px Inter, system-ui, sans-serif";
          const tw = lctx.measureText(label).width + 12;
          lctx.globalAlpha = 0.92;
          lctx.fillStyle = "rgba(10,15,30,0.75)";
          lctx.beginPath();
          lctx.roundRect(qx - tw / 2, qy - 9, tw, 18, 9);
          lctx.fill();
          lctx.fillStyle = "#fff";
          lctx.textAlign = "center";
          lctx.textBaseline = "middle";
          lctx.fillText(label, qx, qy + 0.5);
          lctx.restore();
        }
        // pulsing ring on the receiving city
        const r = 14 + 6 * Math.sin(t / 12);
        lctx.strokeStyle = "rgba(255,255,255,0.85)";
        lctx.lineWidth = 2;
        lctx.beginPath();
        lctx.arc(B.x, B.y, r, 0, Math.PI * 2);
        lctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      map.off("movestart", onMoveStart);
      map.off("moveend", onMoveEnd);
      map.off("resize", resize);
    };
  }, [mapRef, field, inflow, cities, selected]);

  return (
    <>
      <canvas ref={flow} className="pointer-events-none absolute inset-0 z-[1]" />
      <canvas ref={links} className="pointer-events-none absolute inset-0 z-[2]" />
    </>
  );
}
