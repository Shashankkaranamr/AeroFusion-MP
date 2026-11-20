// Earth-observation satellite (stands for VIIRS/MODIS fire detection and the satellite data assimilated by CAMS).
import { k, G, kitFor, emit, colorKit, named } from "./common.mjs";

const W = 640, H = 520;
const BUS = { x: -32, y: -30, w: 64, d: 60, r: 2 };
const BUS_H = 74;
const WING_Z = 44;
const PANEL = { w: 46, d: 40, gap: 4, n: 3 };
const YOKE = 18;
const span = YOKE + PANEL.n * (PANEL.d + PANEL.gap);

const P = k.fitProjection(
  [...k.boxCorners(BUS, -14, BUS_H + 40), [-PANEL.w / 2, BUS.y - span, WING_Z], [PANEL.w / 2, BUS.y + BUS.d + span, WING_Z], [70, 0, 40]],
  W, H, { pad: 24, azimuth: 34, elevation: 28 },
);
const { at, S: S0, L, D, byDepth } = kitFor(P);
const { S, m, css } = colorKit(S0);
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts) => pts.map((p, i) => (i ? "L" : "M") + k.iso(p, P).join(" ")).join("") + "Z";

function wing(sign) {
  // sign -1: wing toward -y (behind), +1: toward +y (front)
  const out = [];
  const y0 = sign < 0 ? BUS.y : BUS.y + BUS.d;
  // yoke: two struts and a cross tube
  const yEnd = y0 + sign * YOKE;
  m("metal");
  const yoke = { x: -3, y: Math.min(y0, yEnd), w: 6, d: YOKE, r: 1 };
  out.push(S(k.slabOf(yoke, WING_Z - 1.5, 3, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, y0 + sign * 2.5, 4, WING_Z - 3, 6, P, 18), { tone: "lo" })); // drive motor (SADM)
  const panels = [];
  for (let i = 0; i < PANEL.n; i++) {
    const a = yEnd + sign * (i * (PANEL.d + PANEL.gap));
    const b = a + sign * PANEL.d;
    panels.push({ x: -PANEL.w / 2, y: Math.min(a, b), w: PANEL.w, d: PANEL.d, r: 0.6 });
  }
  const ordered = sign < 0 ? [...panels].reverse() : panels;
  for (const pl of ordered) {
    m("solar");
    out.push(S(k.slabOf(pl, WING_Z - 0.8, 1.6, P, 2, 0.4), { tone: "mid", crease: "lo" }));
    // cell grid: 6 x 5 cells, lines run edge to edge
    const z = WING_Z + 0.8, grid = [];
    for (let c = 1; c < 6; c++) { const x = pl.x + (pl.w * c) / 6; grid.push(k.lineOnTop([x, pl.y], [x, pl.y + pl.d], z, P)); }
    for (let r = 1; r < 5; r++) { const y = pl.y + (pl.d * r) / 5; grid.push(k.lineOnTop([pl.x, y], [pl.x + pl.w, y], z, P)); }
    out.push(L(grid.join(""), { tone: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(pl, 1.4), z, P, 2), { tone: "faint" }));
    // busbar strip along the hinge side
    out.push(L(k.lineOnTop([pl.x, sign < 0 ? pl.y + pl.d - 1.2 : pl.y + 1.2], [pl.x + pl.w, sign < 0 ? pl.y + pl.d - 1.2 : pl.y + 1.2], z, P), { tone: "mid" }));
  }
  // hinges between panels and at the yoke
  const hinges = [];
  for (let i = 0; i < PANEL.n; i++) {
    const yh = yEnd + sign * (i * (PANEL.d + PANEL.gap)) - sign * (i ? PANEL.gap / 2 : 0);
    for (const x of [-PANEL.w / 2 + 8, PANEL.w / 2 - 8]) hinges.push([x, yh, WING_Z]);
  }
  m("metal");
  for (const h of byDepth(hinges)) out.push(S(k.slabOf({ x: h[0] - 2, y: h[1] - 2.2, w: 4, d: 4.4, r: 1 }, WING_Z - 1.4, 2.8, P, 2), { tone: "lo" }));
  return out.join("");
}

function bus() {
  const out = [];
  // launch adapter ring below
  m("steel");
  out.push(S(k.cylinder(0, 0, 18, -14, 6, P, 48, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(0, 0, 22, -8, 8, P, 56, 0.6), { tone: "mid" }));
  const bolts = G.dotsOf(G.frameAlong([0, 0, -8], [0, 0, 1]), 4, 22, 28, P, { fade: [0.04, 0.42] });
  out.push(D(bolts, { size: 0.45 }));
  // main body with MLI seams
  m("gold");
  const seams = [18, 54].map((z) => k.sideSeam(BUS, z, P, 2)).join("");
  out.push(S(k.slabOf(BUS, 0, BUS_H, P, 2, 0.8), { tone: "mid", inner: L(seams, { tone: "faint" }) }));
  const X = BUS.x + BUS.w, Y = BUS.y + BUS.d;
  // radiator fins on the +y face (edge to edge between seams)
  const fins = [];
  for (let i = 1; i < 12; i++) { const x = BUS.x + (BUS.w * i) / 12; fins.push(seg([x, Y, 18], [x, Y, 54])); }
  out.push(L(fins.join(""), { tone: "lo" }));
  // access panel with screws on +x face
  const ap = [[X, BUS.y + 8, 22], [X, BUS.y + 30, 22], [X, BUS.y + 30, 50], [X, BUS.y + 8, 50]];
  out.push(L(poly(ap), { tone: "lo" }));
  out.push(D(ap.map(([x, y, z]) => at([x, y + (y < 0 ? 2 : -2), z + (z < 30 ? 2 : -2)])), { size: 0.45 }));
  // top deck
  m("metal");
  out.push(S(k.slabOf(k.insetPlan(BUS, 2), BUS_H, 2, P, 2, 0.5), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function instrument() {
  // nadir instrument housing on +x face with a lit aperture looking out along +x
  const out = [];
  const X = BUS.x + BUS.w;
  m("ac");
  out.push(S(k.slabOf({ x: X, y: 4, w: 14, d: 22, r: 1.2 }, 10, 34, P, 2, 0.5), { tone: "mid" }));
  const F = G.frameAlong([X + 14, 15, 30], [1, 0, 0]);
  out.push(S(G.solidOf([[0, 9], [3, 9], [3.4, 8], [12, 8.6], [12.6, 9.4], [13, 9.4]], F, P), { tone: "mid", crease: "lo" }));
  m("accent");
  out.push(S(G.disc(12.4, 13.2, 6.4, F, P), { tone: "hi", lit: true }));
  m("steel");
  out.push(L(G.circleOf(F, 13.2, 3.4, P, 40), { tone: "lit" }));
  out.push(L(G.arcOf(F, 6, 8.3, P), { tone: "faint" }));
  // calibration door hinge
  out.push(S(k.slabOf({ x: X + 14, y: 3, w: 2, d: 24, r: 0.6 }, 44, 2, P, 2), { tone: "lo" }));
  return out.join("");
}

function topDeck() {
  const out = [];
  const z = BUS_H + 2;
  // star trackers with sun baffles, tilted
  m("charcoal");
  for (const [x, y] of byDepth([[18, 6], [4, 20]])) {
    out.push(S(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, z, 5, P, 2, 0.4), { tone: "mid" }));
    const F = G.frameAlong([x, y, z + 5], [0.45, 0.3, 0.84]);
    out.push(S(G.solidOf([[0, 3.2], [7, 3.2], [7.4, 4.6], [13, 6.2]], F, P, { fill: "hull" }), { tone: "mid", crease: "lo" }));
    out.push(L(G.circleOf(F, 13, 6.2, P, 32), { tone: "lo" }));
  }
  m("metal");
  // high-gain antenna on a mast: dish pointed toward the viewer and down
  const base = [-14, -12];
  out.push(S(k.cylinder(base[0], base[1], 5, z, 4, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(base[0], base[1], 2, z + 4, 22, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(G.sphereOf([base[0], base[1], z + 27], 3.2, P), { tone: "mid" }));
  const axis = [0.9, 0.05, 0.42];
  const F = G.frameAlong([base[0], base[1], z + 27], axis);
  m("panel");
  out.push(S(G.solidOf([[0, 2.2], [3, 2.2], [3.2, 6], [5, 12, 1], [7.6, 17.6, 1], [9, 20]], F, P, { fill: "hull" }), { tone: "hi", crease: "lo" }));
  out.push(L(G.circleOf(F, 9, 20, P, 64) + G.circleOf(F, 8.6, 18.6, P, 64), { tone: "mid" }));
  // feed horn on three struts
  const tip = G.pointOf(F, 22, 0, 0);
  const rim = [0, 1, 2].map((i) => G.pointOf(F, 8.8, 18.6, (i * 2 * Math.PI) / 3 + 0.5));
  out.push(L(rim.map((r) => seg(r, tip)).join(""), { tone: "mid" }));
  const Fh = G.frameAlong(tip, axis.map((v) => -v));
  m("accent");
  out.push(S(G.solidOf([[0, 1.6], [4, 2.8]], Fh, P), { tone: "hi", lit: true }));
  m("metal");
  // S-band whip antennas
  for (const [x, y] of [[26, -24], [-26, 24]]) out.push(S(k.cylinder(x, y, 0.8, z, 20, P, 8), { tone: "lo", crease: "none" }), S(G.sphereOf([x, y, z + 20], 1.3, P), { tone: "mid" }));
  return out.join("");
}

function thrusters() {
  const out = [];
  m("steel");
  for (const [x, y] of byDepth([[BUS.x + 6, BUS.y + BUS.d - 6], [BUS.x + BUS.w - 6, BUS.y + BUS.d - 6], [BUS.x + BUS.w - 6, BUS.y + 6]])) {
    const F = G.frameAlong([x, y, 0], [0, 0, -1]);
    out.push(S(G.solidOf([[0, 1.6], [2, 1.6], [2.4, 1.2], [6, 3]], F, P, { fill: "hull" }), { tone: "mid", crease: "lo" }));
  }
  return out.join("");
}

emit(named("satellite"), {
  width: W, height: H, title: "Earth-observation satellite",
  label: "An Earth-observation satellite: a box bus with radiator fins and multilayer insulation seams, two three-panel solar wings on drive motors, a nadir instrument with a lit aperture, star trackers, a high-gain dish antenna and attitude thrusters.",
  body: [css(), wing(-1), thrusters(), bus(), instrument(), topDeck(), wing(1)],
});
