// User terminal: monitor showing the AeroFusion dashboard (map, forecast curve, bars) with a keyboard and phone.
import { k, G, kitFor, emit, colorKit, named } from "./common.mjs";

const W = 600, H = 470;
const DESK = { x: -70, y: -110, w: 130, d: 220, r: 4 };
const SX = -40;                       // screen plane (front face) at x = SX + 3
const SY0 = -84, SY1 = 84, SZ0 = 46, SZ1 = 142;
const P = k.fitProjection([...k.boxCorners(DESK, -6, 0), [SX, SY0 - 4, SZ1 + 4], [SX, SY1 + 4, SZ1 + 4]], W, H, { pad: 22, azimuth: 24, elevation: 24 });
const { at, S: S0, L, D, byDepth, halo } = kitFor(P);
const { S, m, css } = colorKit(S0);
const seg = (a, b) => k.segment(a, b, P);
const F = SX + 3.2;
const pt = (y, z) => [F, -y, z];   // screen y runs left to right as seen by the viewer
const poly = (pts, closed = true) => pts.map((p, i) => (i ? "L" : "M") + k.iso(p, P).join(" ")).join("") + (closed ? "Z" : "");
const rect = (y0, y1, z0, z1) => poly([pt(y0, z0), pt(y1, z0), pt(y1, z1), pt(y0, z1)]);

function desk() {
  const out = [halo(DESK, -6, 6)];
  m("wood");
  out.push(S(k.slabOf(DESK, -6, 6, P, 3, 1), { tone: "lo" }));
  return out.join("");
}

function monitor() {
  const out = [];
  // stand: foot plate, neck, hinge
  m("charcoal");
  const foot = { x: SX - 22, y: -26, w: 40, d: 52, r: 6 };
  out.push(S(k.slabOf(foot, 0, 2.4, P, 6, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: SX - 12, y: -7, w: 6, d: 14, r: 1.5 }, 2.4, 52, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: SX - 8, y: -10, w: 6, d: 20, r: 1.5 }, 74, 12, P, 2, 0.4), { tone: "lo" }));
  // panel body and bezel
  m("ac");
  const body = { x: SX - 3, y: SY0 - 4, w: 6.2, d: SY1 - SY0 + 8, r: 1.2 };
  out.push(S(k.slabOf(body, SZ0 - 6, SZ1 - SZ0 + 10, P, 2, 0.6), { tone: "mid" }));
  out.push(L(rect(SY0, SY1, SZ0, SZ1), { tone: "hi" }));
  // brand dot and power LED on the chin
  out.push(D([at(pt(0, SZ0 - 3)), at(pt(SY1 - 6, SZ0 - 3))], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function screen() {
  const out = [];
  // dashboard layout: top bar, left nav, map card, forecast card, bar card
  out.push(L(seg(pt(SY0, SZ1 - 8), pt(SY1, SZ1 - 8)) + seg(pt(SY0 + 22, SZ0), pt(SY0 + 22, SZ1 - 8)), { tone: "lo" }));
  out.push(L([0, 1, 2, 3, 4].map((i) => seg(pt(SY0 + 5, SZ1 - 16 - i * 8), pt(SY0 + 15 - (i % 2) * 3, SZ1 - 16 - i * 8))).join(""), { tone: "lo", free: true }));
  out.push(L(seg(pt(SY0 + 4, SZ1 - 4), pt(SY0 + 22, SZ1 - 4)), { tone: "mid", free: true }));
  out.push(D([at(pt(SY1 - 6, SZ1 - 4)), at(pt(SY1 - 12, SZ1 - 4))], { size: 0.6 }));
  // map card with a coarse India-like outline and station dots
  const m0 = SY0 + 26, m1 = SY0 + 92, n0 = SZ0 + 4, n1 = SZ1 - 12;
  out.push(L(rect(m0, m1, n0, n1), { tone: "mid" }));
  const outline = [[0.30, 0.95], [0.42, 0.98], [0.52, 0.90], [0.62, 0.92], [0.78, 0.80], [0.92, 0.70], [0.82, 0.60], [0.70, 0.62], [0.64, 0.50], [0.58, 0.32], [0.50, 0.10], [0.44, 0.22], [0.36, 0.42], [0.22, 0.56], [0.14, 0.66], [0.24, 0.74], [0.26, 0.86]];
  const map = outline.map(([u, v]) => pt(m0 + u * (m1 - m0), n0 + v * (n1 - n0)));
  out.push(L(poly(map), { tone: "hi" }));
  const st = [[0.42, 0.80], [0.46, 0.78], [0.40, 0.76], [0.52, 0.72], [0.60, 0.70], [0.70, 0.66], [0.36, 0.60], [0.30, 0.52], [0.48, 0.48], [0.56, 0.40], [0.50, 0.28], [0.64, 0.56], [0.44, 0.66]];
  out.push(D(st.map(([u, v]) => at(pt(m0 + u * (m1 - m0), n0 + v * (n1 - n0)))), { size: 0.75, tone: "hi" }));
  // forecast card: observed vs forecast curve and a "now" marker
  const c0 = SY0 + 96, c1 = SY1 - 4, d0 = SZ0 + 40, d1 = SZ1 - 12;
  out.push(L(rect(c0, c1, d0, d1), { tone: "mid" }));
  out.push(L(seg(pt(c0 + 4, d0 + 4), pt(c1 - 4, d0 + 4)) + seg(pt(c0 + 4, d0 + 4), pt(c0 + 4, d1 - 4)), { tone: "lo" }));
  const N = 24, obs = [], fc = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, y = c0 + 6 + u * (c1 - c0 - 12);
    const v = 0.45 + 0.25 * Math.sin(u * 6.2) + 0.12 * Math.sin(u * 17);
    (u <= 0.55 ? obs : fc).push(pt(y, d0 + 6 + v * (d1 - d0 - 14)));
    if (Math.abs(u - 0.5417) < 0.01) fc.push(pt(y, d0 + 6 + v * (d1 - d0 - 14)));
  }
  out.push(L(poly(obs, false), { tone: "mid" }));
  out.push(L(poly([obs[obs.length - 1], ...fc], false), { tone: "lit" }));
  const now = c0 + 6 + 0.55 * (c1 - c0 - 12);
  out.push(L(seg(pt(now, d0 + 4), pt(now, d1 - 4)), { tone: "lo" }));
  // bar card: city AQI bars
  const b0 = SZ0 + 4, b1 = SZ0 + 36;
  out.push(L(rect(c0, c1, b0, b1), { tone: "mid" }));
  const bars = [0.8, 0.55, 0.65, 0.4, 0.3, 0.5, 0.25, 0.35];
  out.push(L(bars.map((h, i) => { const y = c0 + 6 + i * 6.4; return rect(y, y + 4, b0 + 4, b0 + 4 + h * (b1 - b0 - 8)); }).join(""), { tone: "hi" }));
  return out.join("");
}

function keyboard() {
  const out = [];
  const kb = { x: 4, y: -58, w: 30, d: 104, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(kb, 0, 3, P)}" style="filter:blur(4px)"/>`);
  m("ac");
  out.push(S(k.slabOf(kb, 0, 3, P, 3, 0.6), { tone: "mid" }));
  const keys = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 15; c++) {
    const x = kb.x + 3 + r * 6.4, y = kb.y + 4 + c * 6.4;
    keys.push(k.planOutline({ x, y, w: 5.2, d: 5.2, r: 0.8 }, 3, P, 2));
  }
  keys.push(k.planOutline({ x: kb.x + 3 + 4 * 6.4 - 1, y: kb.y + 30, w: 5.2, d: 40, r: 0.8 }, 3, P, 2));
  out.push(L(keys.join(""), { tone: "lo" }));
  // phone face up beside the keyboard
  const ph = { x: 10, y: 60, w: 34, d: 17, r: 3 };
  m("charcoal");
  out.push(S(k.slabOf(ph, 0, 2, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(ph, 1.6), 2, P, 4), { tone: "hi" }));
  const spark = [];
  for (let i = 0; i <= 12; i++) spark.push([ph.x + 6 + i * 1.9, ph.y + 8.5 + 3.2 * Math.sin(i * 0.8)]);
  out.push(L(k.onTop(spark, 2, P), { tone: "lit" }));
  out.push(D([at([ph.x + 4, ph.y + 4, 2]), at([ph.x + 4, ph.y + 13, 2])], { size: 0.45 }));
  return out.join("");
}

emit(named("user_display"), {
  width: W, height: H, title: "Dashboard terminal",
  label: "A user terminal on a desk: a monitor showing the AeroFusion dashboard (a map of India with station dots, an observed-versus-forecast PM2.5 curve with the forecast lit, and city bars), a keyboard and a phone showing the same forecast trend.",
  body: [css(), desk(), monitor(), screen(), keyboard()],
});
