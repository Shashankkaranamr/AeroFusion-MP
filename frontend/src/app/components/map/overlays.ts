import type { Map as MlMap } from "maplibre-gl";
import type { LiveCity } from "@/lib/api";
import { at, bearingDeg, citySeries, haversineKm } from "@/lib/live";

const RAD = Math.PI / 180;

/** Wind at a lead hour for every city, as u/v (m/s, toward east/north). */
export function windAt(cities: LiveCity[], lead: number, now = Date.now()) {
  return cities
    .map((c) => {
      const p = at(citySeries(c, now), lead);
      const w = p?.wind ?? c.wind;
      const d = p?.wind_dir ?? c.wind_dir;
      if (w == null || d == null) return null;
      // meteorological direction is where the wind comes FROM
      return { lon: c.lon, lat: c.lat, u: -w * Math.sin(d * RAD), v: -w * Math.cos(d * RAD) };
    })
    .filter((x): x is { lon: number; lat: number; u: number; v: number } => x !== null);
}

/** Inverse-distance-weighted wind at any point. */
function sample(field: { lon: number; lat: number; u: number; v: number }[], lon: number, lat: number) {
  let su = 0;
  let sv = 0;
  let sw = 0;
  for (const f of field) {
    const d2 = (f.lon - lon) ** 2 + (f.lat - lat) ** 2 + 0.3;
    const w = 1 / (d2 * d2);
    su += f.u * w;
    sv += f.v * w;
    sw += w;
  }
  return sw ? [su / sw, sv / sw] : [0, 0];
}

/**
 * Wind particles: a few hundred specks carried by the wind field, leaving short fading trails —
 * the story's dust, still moving. A 2D canvas over the map; positions are kept in lon/lat so the
 * flow stays put when the map pans. Sleeps when hidden; still with reduced motion.
 */
export function createWindLayer(map: MlMap, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let field: ReturnType<typeof windAt> = [];
  let on = true;
  let raf = 0;
  const N = 900;
  const B = { w: 66, e: 99, s: 6, n: 37.5 };
  const parts = Array.from({ length: N }, () => spawn({ lon: 0, lat: 0, age: 0, life: 0 }));
  let ink = "236,228,214";

  function spawn(p: { lon: number; lat: number; age: number; life: number }) {
    p.lon = B.w + Math.random() * (B.e - B.w);
    p.lat = B.s + Math.random() * (B.n - B.s);
    p.age = 0;
    p.life = 60 + Math.random() * 90;
    return p;
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink = getComputedStyle(canvas).getPropertyValue("--ink-rgb").trim().split(/\s+/).join(",") || ink;
  }

  function frame() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // fade the previous frame: trails
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = `rgba(${ink},0.55)`;
    ctx.beginPath();
    const k = 0.0035 * Math.pow(2, 5 - Math.min(8, map.getZoom())) * 0.5;
    for (const p of parts) {
      const a = map.project([p.lon, p.lat]);
      const [u, v] = sample(field, p.lon, p.lat);
      p.lon += u * k * 4;
      p.lat += v * k * 4;
      p.age++;
      const b = map.project([p.lon, p.lat]);
      if (p.age > p.life || p.lon < B.w || p.lon > B.e || p.lat < B.s || p.lat > B.n || (u === 0 && v === 0)) {
        spawn(p);
        continue;
      }
      if (a.x < -20 || a.y < -20 || a.x > w + 20 || a.y > h + 20) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    raf = on && !still && !document.hidden ? requestAnimationFrame(frame) : 0;
  }

  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  const onMove = () => clear();
  map.on("move", onMove);
  size();
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  const vis = () => !document.hidden && on && !raf && !still && (raf = requestAnimationFrame(frame));
  document.addEventListener("visibilitychange", vis);

  return {
    setField(f: ReturnType<typeof windAt>) {
      field = f;
      if (still) {
        clear();
        for (let i = 0; i < 40; i++) frame();
      }
    },
    setVisible(v: boolean) {
      on = v;
      canvas.style.opacity = v ? "1" : "0";
      if (v && !raf && !still) raf = requestAnimationFrame(frame);
      if (!v) clear();
    },
    destroy() {
      cancelAnimationFrame(raf);
      map.off("move", onMove);
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
    },
  };
}

/** Fires upwind of a city: within 600 km, in the quarter the wind is coming from. */
export function upwindOf(c: LiveCity, fires: { lat: number; lon: number }[]) {
  if (c.wind_dir == null) return new Set<number>();
  const out = new Set<number>();
  fires.forEach((f, i) => {
    const km = haversineKm(c, f);
    if (km > 600) return;
    const diff = Math.abs(((bearingDeg(c, f) - c.wind_dir! + 540) % 360) - 180);
    if (diff < 45) out.add(i);
  });
  return out;
}

/**
 * Particles to map: the story's last frame was every particle gathered into one ember. Here the
 * ember breaks open and its particles fly out to the 33 cities, each landing on its dot. Runs once,
 * on arrival from the story; skipped with reduced motion.
 */
export function particlesToMap(canvas: HTMLCanvasElement, targets: { x: number; y: number; color: string }[], onDone: () => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !targets.length) return onDone();
  const ctx = canvas.getContext("2d")!;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = r.width / 2;
  const cy = r.height / 2;
  const PER = 14;
  const dots = targets.flatMap((t, ti) =>
    Array.from({ length: PER }, (_, k) => {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * 26;
      return { x0: cx + Math.cos(a) * rr, y0: cy + Math.sin(a) * rr, t, delay: (ti / targets.length) * 0.35 + (k / PER) * 0.12, bend: (Math.random() - 0.5) * 120 };
    }),
  );
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease-in-out (on-screen movement)
  const T = 1900;
  const t0 = performance.now();
  function frame(now: number) {
    const e = (now - t0) / T;
    ctx.clearRect(0, 0, r.width, r.height);
    // the ember itself, dissolving as it empties
    const core = Math.max(0, 1 - e * 2.2);
    if (core > 0) {
      const g = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 34);
      g.addColorStop(0, `rgba(255,179,122,${core})`);
      g.addColorStop(0.6, `rgba(255,138,61,${core * 0.9})`);
      g.addColorStop(1, "rgba(255,138,61,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const d of dots) {
      const p = Math.min(1, Math.max(0, (e - d.delay) / 0.55));
      const q = ease(p);
      const mx = (d.x0 + d.t.x) / 2 + d.bend * (d.t.y - d.y0) / 400;
      const my = (d.y0 + d.t.y) / 2 - d.bend * (d.t.x - d.x0) / 400;
      const x = (1 - q) * (1 - q) * d.x0 + 2 * (1 - q) * q * mx + q * q * d.t.x;
      const y = (1 - q) * (1 - q) * d.y0 + 2 * (1 - q) * q * my + q * q * d.t.y;
      // ember on the way, the city's own colour as it lands
      ctx.fillStyle = q > 0.8 ? d.t.color : "#ff8a3d";
      ctx.globalAlpha = p >= 1 ? Math.max(0, 1 - (e - d.delay - 0.55) * 4) : 0.95;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (e < 1.15) requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, r.width, r.height);
      onDone();
    }
  }
  requestAnimationFrame(frame);
}
