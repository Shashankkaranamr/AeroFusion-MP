// CPCB continuous ambient air-quality monitoring station (CAAQMS): shelter, inlets, met mast.
import { k, G, kitFor, emit } from "./common.mjs";

const W = 560, H = 560;
const PLINTH = { x: -110, y: -64, w: 214, d: 128, r: 3 };
const CAB = { x: -86, y: -44, w: 116, d: 84, r: 2 };
const CAB_H = 72;
const ROOF = k.insetPlan(CAB, -4);
const MAST = [72, -36];
const MAST_TOP = 196;

const P = k.fitProjection(
  [...k.boxCorners(PLINTH, -10, 0), [MAST[0], MAST[1], MAST_TOP + 14], [-60, -20, 132], [MAST[0] + 30, MAST[1], MAST_TOP + 10]],
  W, H, { pad: 26, azimuth: 38, elevation: 30 },
);
const { at, S: S0, L, D, byDepth, halo } = kitFor(P);
const COLOR = process.argv.includes("--color");
let MAT = "metal";
const m = (name) => { MAT = name; };
const S = (paths, style = {}) => S0(paths, COLOR ? { ...style, className: `m-${MAT}` } : style);
// material palettes: [top, shade0 (darkest) .. shade3 (lightest)]
const MATS = {
  concrete: ["#E9E6E0", "#C4BFB6", "#CFCAC1", "#D9D5CD", "#E2DED7"],
  panel: ["#FBF8F1", "#D9D3C4", "#E4DFD2", "#EDE9DF", "#F5F2EA"],
  trim: ["#4F86C6", "#2B5A93", "#33679F", "#3C74AC", "#4680BA"],
  roof: ["#5B8FCB", "#2C5D97", "#356AA4", "#3F77B1", "#4A83BE"],
  metal: ["#DCE1E5", "#9AA4AD", "#A9B2BA", "#B8C0C7", "#C8CFD5"],
  steel: ["#C5CCD3", "#7E8892", "#8D97A1", "#9DA7B0", "#AEB7BF"],
  ac: ["#F1F2F2", "#C9CBCD", "#D3D5D7", "#DDDFE0", "#E7E8E9"],
  accent: ["#F4A261", "#C25E17", "#D06A1F", "#DD7628", "#E98433"],
  plate: ["#4A5560", "#2C343C", "#333C45", "#3A444E", "#424C57"],
};
const paletteCss = () => `<style>${Object.entries(MATS).map(([n, [t, a, b, c, e]]) => {
  const q = `.iso-solid.m-${n}`;
  return `${q}>.iso-fill{fill:${e}}${q}>.iso-top{fill:${t};stroke:${t}}${q}>.iso-shade[data-shade="0"]{fill:${a};stroke:${a}}`
    + `${q}>.iso-shade[data-shade="1"]{fill:${b};stroke:${b}}${q}>.iso-shade[data-shade="2"]{fill:${c};stroke:${c}}${q}>.iso-shade[data-shade="3"]{fill:${e};stroke:${e}}`
    + `${q}>.iso-top,${q}>.iso-shade{stroke-width:.35}`;
}).join("")}.iso-line[data-tone="faint"]{stroke:#9AA0A6}.iso-line[data-tone="lo"]{stroke:#6E757C}</style>`;
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts, closed = true) => pts.map((p, i) => (i ? "L" : "M") + k.iso(p, P).join(" ")).join("") + (closed ? "Z" : "");

function plinth() {
  m("concrete");
  const out = [halo(PLINTH, -10, 10)];
  out.push(S(k.slabOf(PLINTH, -10, 10, P, 3, 1.2), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 5), 0, P, 3), { tone: "faint" }));
  // anchor bolts
  const bolts = k.corners(PLINTH, 9);
  out.push(L(bolts.map(([x, y]) => k.ring(x, y, 2, 0, P, 14)).join(""), { tone: "lo" }));
  out.push(D(bolts.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate on the plinth top
  const lp = { x: 46, y: 46, w: 40, d: 12, r: 1 };
  m("plate");
  out.push(S(k.slabOf(lp, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(lp, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(L([[50, 74], [50, 66], [50, 58]].map(([x0, x1], j) => k.lineOnTop([x0, 49.6 + j * 2.4], [x1 + 8 - j * 4, 49.6 + j * 2.4], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([lp.x + 2.2, lp.y + 6, 0.8]), at([lp.x + lp.w - 2.2, lp.y + 6, 0.8])], { size: 0.4 }));
  return out.join("");
}

function cabin() {
  const out = [];
  // skirt rail
  m("trim");
  out.push(S(k.slabOf(k.insetPlan(CAB, -1.2), 0, 4, P, 2, 0.4), { tone: "lo" }));
  // body with panel seams
  m("panel");
  const seams = [16, 40, 60].map((z) => k.sideSeam(CAB, z, P, 2)).join("");
  out.push(S(k.slabOf(CAB, 4, CAB_H - 4, P, 2, 0.6), { tone: "mid", inner: L(seams, { tone: "faint" }) }));
  // vertical panel joints on the +x face (x = CAB.x + CAB.w) and +y face
  const X = CAB.x + CAB.w, Y = CAB.y + CAB.d;
  const joints = [];
  for (const y of [CAB.y + 28, CAB.y + 56]) joints.push(seg([X, y, 4], [X, y, CAB_H]));
  for (const x of [CAB.x + 30, CAB.x + 86]) joints.push(seg([x, Y, 4], [x, Y, CAB_H]));
  out.push(L(joints.join(""), { tone: "faint" }));
  // door on the +y face with frame, hinges and handle
  const d0 = -58, d1 = -26, dz0 = 8, dz1 = 58;
  out.push(L(poly([[d0, Y, dz0], [d1, Y, dz0], [d1, Y, dz1], [d0, Y, dz1]]), { tone: "hi" }));
  out.push(L(poly([[d0 + 3, Y, dz0 + 3], [d1 - 3, Y, dz0 + 3], [d1 - 3, Y, dz1 - 3], [d0 + 3, Y, dz1 - 3]]), { tone: "lo" }));
  out.push(L(poly([[d0 + 6, Y, dz1 - 20], [d1 - 6, Y, dz1 - 20], [d1 - 6, Y, dz1 - 7], [d0 + 6, Y, dz1 - 7]]), { tone: "lo" }));
  m("steel");
  for (const z of [dz0 + 8, dz1 - 9]) out.push(S(k.slabOf({ x: d0 - 1, y: Y, w: 2.4, d: 1.4, r: 0.3 }, z, 5, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: d1 - 7, y: Y, w: 2, d: 2, r: 0.6 }, 31, 2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: d1 - 9.5, y: Y + 1.6, w: 7, d: 1.4, r: 0.6 }, 31.2, 1.6, P, 2), { tone: "hi", crease: "none" }));
  // window with louvres on +y face, right of door
  const w0 = -10, w1 = 22, wz0 = 30, wz1 = 52;
  out.push(L(poly([[w0, Y, wz0], [w1, Y, wz0], [w1, Y, wz1], [w0, Y, wz1]]), { tone: "hi" }));
  out.push(L([34, 38, 42, 46].map((z) => seg([w0 + 2, Y, z], [w1 - 2, Y, z])).join(""), { tone: "lo" }));
  out.push(L(seg([w0, Y, wz0 + 4], [w1, Y, wz0 + 4]), { tone: "lo" }));
  // vent slots on +x face
  const slots = [];
  for (let i = 0; i < 6; i++) {
    const z = 14 + i * 4.4, y0 = CAB.y + 6, y1 = CAB.y + 22;
    slots.push(poly([[X, y0, z], [X, y1, z], [X, y1, z + 1.8], [X, y0, z + 1.8]]));
  }
  out.push(L(slots.join(""), { tone: "lo" }));
  // instrument rack status window on +x face, showing the analyser fronts
  out.push(L(poly([[X, CAB.y + 34, 40], [X, CAB.y + 76, 40], [X, CAB.y + 76, 60], [X, CAB.y + 34, 60]]), { tone: "hi" }));
  out.push(L([45, 50, 55].map((z) => seg([X, CAB.y + 34, z], [X, CAB.y + 76, z])).join(""), { tone: "faint" }));
  out.push(D([44, 49, 54, 59].flatMap((z, i) => [at([X, CAB.y + 72, z - 2]), ...(i % 2 ? [] : [at([X, CAB.y + 68, z - 2])])]), { size: 0.55, tone: "hi" }));
  // roof cap with drip edge
  m("roof");
  out.push(S(k.slabOf(ROOF, CAB_H, 3, P, 2, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(ROOF, 3), CAB_H + 3, 1.2, P, 2, 0.4), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function steps() {
  const out = [];
  // two steps up to the door on the +y side
  m("concrete");
  for (const [i, h] of [[0, 4], [1, 8]]) {
    const plan = { x: -60 + i * 0, y: CAB.y + CAB.d + 2 + (1 - i) * 7, w: 40, d: 14 - (1 - i) * 7, r: 0.8 };
    out.push(S(k.slabOf(plan, 0, h - i * 0, P, 2, 0.5), { tone: "mid" }));
  }
  return out.join("");
}

function acUnit() {
  // outdoor AC condenser fixed to the +x wall on two brackets
  const X = CAB.x + CAB.w;
  const out = [];
  m("steel");
  for (const y of [-34, -16]) out.push(S(k.slabOf({ x: X, y, w: 16, d: 2.4, r: 0.4 }, 6, 3, P, 2), { tone: "lo" }));
  const box = { x: X + 1, y: -38, w: 15, d: 28, r: 1 };
  m("ac");
  out.push(S(k.slabOf(box, 9, 22, P, 2, 0.5), { tone: "mid" }));
  const fx = X + 16;
  out.push(L(k.sideRing([fx, -24, 20], 8.5, "x", P) + k.sideRing([fx, -24, 20], 6.2, "x", P), { tone: "lo" }));
  out.push(L([0, 1, 2, 3].map((i) => { const a = (i * Math.PI) / 4; return seg([fx, -24 + Math.cos(a) * 8.5, 20 + Math.sin(a) * 8.5], [fx, -24 - Math.cos(a) * 8.5, 20 - Math.sin(a) * 8.5]); }).join(""), { tone: "faint" }));
  out.push(D([at([fx, -24, 20])], { size: 0.7 }));
  // refrigerant pipes into the wall
  out.push(k.wireSvg(at([X + 3, -11, 15]), at([X + 0.2, -11, 26]), { via: [at([X + 3, -11, 26])], ends: "to", size: 0.9 }));
  return out.join("");
}

function inlet(x, y, top, lit) {
  // sampling inlet: roof flange, tube, PM cyclone head with rain hat
  const out = [];
  const base = CAB_H + 4.2;
  m("metal");
  out.push(S(k.cylinder(x, y, 5, base, 2, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 2, base + 2, top - base - 2, P, 18), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(x, y, 2, base + 26, P, 10), { tone: "faint" }));
  const F = G.frameAlong([x, y, top], [0, 0, 1]);
  const head = G.solidOf([[0, 3.2], [3, 3.2], [3.4, 5.8, 1], [9, 5.8, 1], [10.6, 4.2], [11, 2.2], [13, 2.2], [13.2, 9], [14.4, 9], [16, 3]], F, P);
  m(lit ? "accent" : "steel");
  out.push(S(head, { tone: lit ? "hi" : "mid", lit, crease: "lo" }));
  out.push(L(G.arcOf(F, 6.2, 5.8, P) + G.arcOf(F, 9, 5.8, P), { tone: "lo" }));
  return out.join("");
}

function roof() {
  const out = [];
  // guard rail on roof edge (back and left legs drawn first)
  const z0 = CAB_H + 4.2, zr = z0 + 14;
  m("metal");
  const posts = byDepth([[ROOF.x + 4, ROOF.y + 4], [ROOF.x + ROOF.w - 4, ROOF.y + 4], [ROOF.x + 4, ROOF.y + ROOF.d - 4]]);
  for (const [x, y] of posts) out.push(S(k.cylinder(x, y, 0.9, z0, zr - z0, P, 10), { tone: "lo", crease: "none" }));
  out.push(L(seg([ROOF.x + 4, ROOF.y + 4, zr], [ROOF.x + ROOF.w - 4, ROOF.y + 4, zr]) + seg([ROOF.x + 4, ROOF.y + 4, zr], [ROOF.x + 4, ROOF.y + ROOF.d - 4, zr]), { tone: "mid" }));
  out.push(L(seg([ROOF.x + 4, ROOF.y + 4, zr - 7], [ROOF.x + ROOF.w - 4, ROOF.y + 4, zr - 7]) + seg([ROOF.x + 4, ROOF.y + 4, zr - 7], [ROOF.x + 4, ROOF.y + ROOF.d - 4, zr - 7]), { tone: "lo" }));
  out.push(inlet(-58, -24, CAB_H + 46, false));
  out.push(inlet(-36, -24, CAB_H + 54, true));
  // gas analyser inlet manifold: short glass manifold with a fan cap
  m("metal");
  out.push(S(k.cylinder(-12, -18, 4, CAB_H + 4.2, 3, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(-12, -18, 1.6, CAB_H + 7, 22, P, 14), { tone: "mid", crease: "none" }));
  const F = G.frameAlong([-12, -18, CAB_H + 29], [0, 0, 1]);
  out.push(S(G.solidOf([[0, 1.6], [1, 6], [2.4, 6], [3.2, 1.6]], F, P), { tone: "mid", crease: "lo" }));
  // roof-mounted junction box with a cable gland
  m("ac");
  out.push(S(k.slabOf({ x: 4, y: -30, w: 16, d: 12, r: 1 }, CAB_H + 4.2, 8, P, 2, 0.5), { tone: "mid" }));
  out.push(D([at([6, -28, CAB_H + 12.2]), at([18, -28, CAB_H + 12.2]), at([6, -20, CAB_H + 12.2]), at([18, -20, CAB_H + 12.2])], { size: 0.4 }));
  return out.join("");
}

function mast() {
  const [mx, my] = MAST;
  const out = [];
  // base plate with gussets
  m("metal");
  const bp = { x: mx - 9, y: my - 9, w: 18, d: 18, r: 1 };
  out.push(S(k.slabOf(bp, 0, 2, P, 2, 0.5), { tone: "lo" }));
  out.push(D(k.corners(bp, 2.6).map(([x, y]) => at([x, y, 2])), { size: 0.45 }));
  out.push(S(k.cylinder(mx, my, 3.4, 2, 6, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(mx, my, 2.2, 8, MAST_TOP - 8, P, 18), { tone: "mid", crease: "none" }));
  out.push(L([50, 100, 150].map((z) => k.sideArc(mx, my, 2.2, z, P, 10)).join(""), { tone: "faint" }));
  // radiation shield (T/RH) on a side arm at z 112
  const arm = { x: mx + 2, y: my - 1.2, w: 20, d: 2.4, r: 0.6 };
  out.push(S(k.slabOf(arm, 112, 2.4, P, 2), { tone: "lo" }));
  const sx = mx + 24;
  m("panel");
  for (let i = 0; i < 6; i++) out.push(S(k.cylinder(sx, my, 6.5 - i * 0.25, 92 + i * 3.6, 1.6, P, 28), { tone: i === 5 ? "hi" : "mid", crease: "lo" }));
  out.push(S(k.cylinder(sx, my, 1.4, 114.4, 3, P, 12), { tone: "lo" }));
  // rain gauge funnel at z 60 on a short bracket
  m("metal");
  out.push(S(k.slabOf({ x: mx - 1, y: my + 2, w: 2, d: 12, r: 0.5 }, 62, 2, P, 2), { tone: "lo" }));
  m("ac");
  out.push(S(k.cylinder(mx, my + 18, 5, 50, 14, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(mx, my + 18, 6.2, 64, 2, P, 24), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(mx, my + 18, 4.4, 66, P, 24), { tone: "lo" }));
  // cross arm at top
  m("metal");
  const za = MAST_TOP - 4;
  out.push(S(k.slabOf({ x: mx - 26, y: my - 1.4, w: 52, d: 2.8, r: 0.6 }, za, 2.8, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: mx - 4, y: my - 4, w: 8, d: 8, r: 1 }, za - 3, 9, P, 2, 0.4), { tone: "lo" }));
  // anemometer (cup) on the left end
  const ax = mx - 24;
  out.push(S(k.cylinder(ax, my, 1.6, za + 2.8, 8, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(ax, my, 2.6, za + 10.8, 2.6, P, 16), { tone: "hi", crease: "lo" }));
  const cups = [0, 1, 2].map((i) => { const a = (i * 2 * Math.PI) / 3 + 0.4; return [ax + Math.cos(a) * 9, my + Math.sin(a) * 9, za + 12]; });
  out.push(L(cups.map((c) => seg([ax, my, za + 12], c)).join(""), { tone: "mid" }));
  for (const c of byDepth(cups)) out.push(S(G.sphereOf(c, 2.4, P), { tone: "hi" }));
  // wind vane on the right end
  const vx = mx + 24;
  out.push(S(k.cylinder(vx, my, 1.6, za + 2.8, 8, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: vx - 12, y: my - 0.5, w: 22, d: 1, r: 0.3 }, za + 11, 1.2, P, 2), { tone: "mid" }));
  out.push(S(k.extrude([[vx - 12, my - 0.4], [vx - 20, my - 0.4], [vx - 20, my + 0.4], [vx - 12, my + 0.4]], za + 8, 8, P), { tone: "hi", crease: "lo" }));
  m("accent");
  out.push(S(G.sphereOf([vx + 11, my, za + 11.6], 1.6, P), { tone: "hi", lit: true }));
  m("metal");
  // lightning finial
  out.push(S(k.cylinder(mx, my, 0.7, za + 6, 18, P, 8), { tone: "lo", crease: "none" }));
  m("ac");
  // logger box on the mast at z 30 and its cable down into the plinth duct to the cabin
  out.push(S(k.slabOf({ x: mx - 6, y: my + 2.2, w: 12, d: 6, r: 0.8 }, 26, 14, P, 2, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline({ x: mx - 4.6, y: my + 3.4, w: 9.2, d: 3.6, r: 0.6 }, 40, P, 2), { tone: "faint" }));
  out.push(D([at([mx + 4, my + 8.2, 36])], { size: 0.55, tone: "hi" }));
  return out.join("");
}

function duct() {
  // cable duct along the plinth from the mast to the cabin
  const X = CAB.x + CAB.w;
  const out = [];
  m("concrete");
  out.push(S(k.slabOf({ x: X + 1.5, y: MAST[1] - 2.5, w: MAST[0] - X - 10, d: 5, r: 0.8 }, 0, 2.6, P, 2, 0.4), { tone: "lo" }));
  out.push(k.wireSvg(at([MAST[0] - 2, MAST[1] + 5, 26]), at([MAST[0] - 9, MAST[1], 2.6]), { via: [at([MAST[0] - 2, MAST[1] + 5, 4])], ends: "both", size: 0.9 }));
  return out.join("");
}

emit(COLOR ? "aq_station_color" : "aq_station", {
  width: W, height: H, title: "CPCB monitoring station",
  label: "A continuous ambient air-quality monitoring station: an instrument shelter on a concrete plinth with PM2.5 and PM10 sampling inlets and a gas manifold on the roof, an AC condenser, and a meteorological mast with an anemometer, wind vane, radiation shield and rain gauge.",
  body: [COLOR ? paletteCss() : "", plinth(), duct(), cabin(), steps(), acUnit(), roof(), mast()],
});
