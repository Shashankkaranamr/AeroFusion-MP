// Server rack (stands for cloud data services: Copernicus ADS/CDS, XKDR API, the Render-hosted API).
import { k, G, kitFor, emit, colorKit, named } from "./common.mjs";

const W = 440, H = 560;
const RACK = { x: -32, y: -38, w: 64, d: 76, r: 1.6 };
const BASE_H = 8, TOP = 176;
const FRONT = RACK.x + RACK.w;
const U = 7;

const P = k.fitProjection([...k.boxCorners(RACK, -4, TOP + 6)], W, H, { pad: 30, azimuth: 30, elevation: 28 });
const { at, S: S0, L, D, byDepth, halo } = kitFor(P);
const { S, m, css } = colorKit(S0);
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts) => pts.map((p, i) => (i ? "L" : "M") + k.iso(p, P).join(" ")).join("") + "Z";
const rect = (y0, y1, z0, z1, x = FRONT + 2) => poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);

function cabinet() {
  const out = [halo(RACK, -4, 4)];
  m("charcoal");
  // levelling feet and casters
  for (const [x, y] of byDepth(k.corners(RACK, 7))) {
    out.push(S(k.cylinder(x, y, 4.2, -4, 1.4, P, 20), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 2, -2.6, 2.6, P, 14), { tone: "mid", crease: "none" }));
  }
  out.push(S(k.slabOf(RACK, 0, BASE_H, P, 2, 0.6), { tone: "lo" }));
  // side panel (+y face visible) with vent slots and seams
  const Y = RACK.y + RACK.d;
  const body = k.slabOf(RACK, BASE_H, TOP - BASE_H, P, 2, 0.8);
  out.push(S(body, { tone: "mid", inner: L([60, 120].map((z) => k.sideSeam(RACK, z, P, 2)).join(""), { tone: "faint" }) }));
  const slots = [];
  for (const zb of [24, 84, 140]) for (let i = 0; i < 5; i++) {
    const z = zb + i * 4;
    slots.push(poly([[RACK.x + 14, Y, z], [RACK.x + 50, Y, z], [RACK.x + 50, Y, z + 1.6], [RACK.x + 14, Y, z + 1.6]]));
  }
  out.push(L(slots.join(""), { tone: "lo" }));
  // side panel latch
  out.push(S(k.slabOf({ x: RACK.x + 30, y: Y, w: 4, d: 1.6, r: 0.4 }, 100, 12, P, 2), { tone: "lo", crease: "none" }));
  // front frame: rails on both sides of the opening
  for (const y of [RACK.y + 2, RACK.y + RACK.d - 8]) out.push(S(k.slabOf({ x: FRONT, y, w: 2.4, d: 6, r: 0.4 }, BASE_H, TOP - BASE_H - 6, P, 2, 0.3), { tone: "mid" }));
  // rail holes (cage nut squares) as a dotted column on each rail
  const holes = [];
  for (let z = BASE_H + 3; z < TOP - 8; z += U / 3) for (const y of [RACK.y + 5, RACK.y + RACK.d - 5]) holes.push(at([FRONT + 2.4, y, z]));
  out.push(D(holes, { size: 0.32, tone: "lo" }));
  // top cap with cable entry brush and fan
  out.push(S(k.slabOf(k.insetPlan(RACK, -1), TOP, 4, P, 2, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline({ x: RACK.x + 8, y: RACK.y + 10, w: 18, d: 30, r: 2 }, TOP + 4, P, 3), { tone: "lo" }));
  out.push(L(k.ring(RACK.x + 44, RACK.y + 54, 9, TOP + 4, P, 40) + k.ring(RACK.x + 44, RACK.y + 54, 6.5, TOP + 4, P, 32), { tone: "lo" }));
  out.push(D([at([RACK.x + 44, RACK.y + 54, TOP + 4])], { size: 0.6 }));
  return out.join("");
}

function unit(z, n, kind) {
  // one chassis of n rack units, face at x = FRONT + 2..FRONT + 4
  const y0 = RACK.y + 8, y1 = RACK.y + RACK.d - 8, h = n * U - 0.6;
  const out = [];
  m(kind === "switch" ? "trim" : kind === "storage" ? "steel" : "metal");
  out.push(S(k.slabOf({ x: FRONT - 2, y: y0, w: 5.6, d: y1 - y0, r: 0.5 }, z, h, P, 2, 0.4), { tone: kind === "switch" ? "mid" : "hi", crease: "lo" }));
  const X = FRONT + 3.6;
  // ears with thumb screws
  out.push(D([at([X, y0 + 1.6, z + h / 2]), at([X, y1 - 1.6, z + h / 2])], { size: 0.5 }));
  if (kind === "server") {
    // 8 drive caddies, each a closed outline with a handle line and an LED
    const bays = [];
    const leds = [];
    for (let i = 0; i < 8; i++) {
      const a = y0 + 6 + i * 6.2, b = a + 5.4;
      bays.push(rect(a, b, z + 1.4, z + h - 1.4, X));
      bays.push(seg([X, a + 1, z + h - 3], [X, b - 1, z + h - 3]));
      leds.push(at([X, a + 2.7, z + 2.4]));
    }
    out.push(L(bays.join(""), { tone: "lo" }));
    out.push(D(leds, { size: 0.42, tone: "hi" }));
    // control panel: power button (lit) and status bar
    out.push(L(rect(y1 - 11, y1 - 4, z + 1.6, z + h - 1.6, X), { tone: "mid" }));
    out.push(D([at([X, y1 - 7.5, z + h / 2])], { size: 0.7, tone: "hi" }));
  } else if (kind === "storage") {
    const grid = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const a = y0 + 6 + c * 12.4, zz = z + 1.6 + r * ((h - 3.2) / 3);
      grid.push(rect(a, a + 11.6, zz, zz + (h - 3.2) / 3 - 0.8, X));
    }
    out.push(L(grid.join(""), { tone: "lo" }));
    const leds = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) leds.push(at([X, y0 + 15.5 + c * 12.4, z + 3 + r * ((h - 3.2) / 3)]));
    out.push(D(leds, { size: 0.42, tone: "hi" }));
  } else if (kind === "switch") {
    // two rows of 12 ports
    const ports = [];
    for (const zz of [z + 1.2, z + 3.6]) for (let i = 0; i < 12; i++) { const a = y0 + 5 + i * 3.6; ports.push(rect(a, a + 2.8, zz, zz + 1.8, X)); }
    out.push(L(ports.join(""), { tone: "lo" }));
    out.push(D(Array.from({ length: 12 }, (_, i) => at([X, y0 + 6.4 + i * 3.6, z + 6.2])), { size: 0.3, tone: "hi" }));
  } else if (kind === "blank") {
    out.push(L(Array.from({ length: 7 }, (_, i) => rect(y0 + 6 + i * 7.4, y0 + 11.6 + i * 7.4, z + 1.8, z + h - 1.8, X)).join(""), { tone: "faint" }));
  }
  return out.join("");
}

function units() {
  const plan = [["blank", 1], ["storage", 4], ["server", 2], ["server", 2], ["server", 2], ["blank", 1], ["server", 2], ["server", 2], ["server", 2], ["switch", 1], ["switch", 1], ["blank", 2]];
  let z = BASE_H + 4;
  const out = [];
  for (const [kind, n] of plan) { out.push(unit(z, n, kind)); z += n * U; }
  return out.join("");
}

emit(named("server_rack"), {
  width: W, height: H, title: "Server rack",
  label: "A 42U server rack on levelling feet: a vented side panel, front rails with cage-nut holes, 2U servers with drive caddies and status LEDs, a 4U storage shelf, two network switches, and a top cap with a fan and cable entry.",
  body: [css(), cabinet(), units()],
});
