// Satellite ground-station antenna: parabolic dish on an elevation-over-azimuth pedestal (data downlink).
import { k, G, kitFor, emit, colorKit, named } from "./common.mjs";

const W = 520, H = 540;
const PAD = { x: -60, y: -60, w: 120, d: 120, r: 4 };
const HUB = [0, 0, 92];
const AX = (() => { const el = 0.62, az = -0.55; return [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]; })();
const R = 50;

const P = k.fitProjection([...k.boxCorners(PAD, -8, 0), [0, 0, HUB[2] + R + 30], [-R, -R, HUB[2] + 20], [R + 10, R, HUB[2]]], W, H, { pad: 26, azimuth: 40, elevation: 26 });
const { at, S: S0, L, D, byDepth, halo } = kitFor(P);
const { S, m, css } = colorKit(S0);
const seg = (a, b) => k.segment(a, b, P);

function base() {
  const out = [halo(PAD, -8, 8)];
  m("concrete");
  out.push(S(k.slabOf(PAD, -8, 8, P, 3, 1), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PAD, 5), 0, P, 3), { tone: "faint" }));
  const bolts = k.corners(PAD, 10);
  out.push(L(bolts.map(([x, y]) => k.ring(x, y, 2, 0, P, 14)).join(""), { tone: "lo" }));
  out.push(D(bolts.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  m("panel");
  // pedestal: octagonal tower on a flange with bolt circle
  out.push(S(k.cylinder(0, 0, 26, 0, 4, P, 64, 0.6), { tone: "mid" }));
  out.push(D(G.dotsOf(G.frameAlong([0, 0, 0], [0, 0, 1]), 4, 23, 24, P, { fade: [0.04, 0.42] }), { size: 0.45 }));
  const oct = Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return [Math.cos(a) * 18, Math.sin(a) * 18]; });
  out.push(S(k.extrude(oct, 4, 56, P, { bevel: 0.6 }), { tone: "mid", inner: L(k.ringSeam(oct, 30, P), { tone: "faint" }) }));
  // service door on the tower
  const a = Math.PI / 4 * 0.5 + Math.PI / 4;
  // azimuth bearing housing and turntable
  m("steel");
  out.push(S(k.cylinder(0, 0, 22, 60, 6, P, 64, 0.6), { tone: "lo" }));
  out.push(L(k.knurl(0, 0, 22, 60, 66, 90, P, 0.3), { tone: "faint" }));
  out.push(S(k.cylinder(0, 0, 20, 66, 4, P, 64, 0.4), { tone: "hi", crease: "lo" }));
  // yoke arms carrying the elevation axle
  m("metal");
  for (const y of [-16, 12]) out.push(S(k.slabOf({ x: -6, y, w: 12, d: 4, r: 1 }, 70, 24, P, 2, 0.4), { tone: "mid" }));
  // elevation drive box with cable to the tower
  m("trim");
  out.push(S(k.slabOf({ x: 8, y: -10, w: 12, d: 20, r: 1 }, 70, 10, P, 2, 0.4), { tone: "mid" }));
  out.push(k.wireSvg(at([20, 0, 74]), at([16.6, 6.9, 40]), { via: [at([24, 0, 74]), at([24, 4, 44])], ends: "both", size: 0.9 }));
  return out.join("");
}

function dish() {
  const out = [];
  const F = G.frameAlong(HUB, AX);
  // counterweight arm behind the dish
  m("steel");
  const back = G.pointOf(F, -26, 0, 0);
  out.push(S(G.solidOf([[-6, 0], [-6, 4], [6, 4], [6, 0]], G.frameAlong(G.pointOf(F, -14, 0, 0), AX), P), { tone: "lo" }));
  out.push(S(G.sphereOf(back, 7, P), { tone: "mid" }));
  // backing structure and reflector: paraboloid r^2 = 4 f s
  const f = 34;
  const prof = [[0, 6]];
  for (let i = 1; i <= 12; i++) { const r = 6 + (R - 6) * (i / 12); prof.push([(r * r) / (4 * f) - 0.26, r, 1]); }
  m("metal");
  out.push(S(G.solidOf([[-8, 9], [-2, 12], [0, 6]], F, P), { tone: "mid", crease: "lo" }));
  m("panel");
  out.push(S(G.lathe([...prof, [prof[prof.length - 1][0] + 1.2, R + 1.4]], F, P, { fill: "hull" }), { tone: "hi", crease: "lo" }));
  const sRim = (R * R) / (4 * f);
  out.push(L(G.circleOf(F, sRim + 1.2, R + 1.4, P, 96), { tone: "mid" }));
  // panel joints on the reflector face (visible from the front): rings and radial seams
  const face = [];
  for (const r of [22, 40]) face.push(G.circleOf(F, (r * r) / (4 * f), r, P, 72));
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const pts = [];
    for (let j = 0; j <= 10; j++) { const r = 8 + (R - 8) * (j / 10); pts.push(G.pointOf(F, (r * r) / (4 * f), r, a)); }
    face.push(pts.map((p, n) => (n ? "L" : "M") + k.iso(p, P).join(" ")).join(""));
  }
  out.push(L(face.join(""), { tone: "faint" }));
  // quadripod feed support and the lit feed horn at the focus
  const focus = G.pointOf(F, f, 0, 0);
  const legs = [0, 1, 2, 3].map((i) => G.pointOf(F, sRim - 2, R - 6, (i * Math.PI) / 2 + Math.PI / 4));
  out.push(L(legs.map((p) => seg(p, focus)).join(""), { tone: "mid" }));
  out.push(D(legs.map((p) => at(p)), { size: 0.6 }));
  const Ff = G.frameAlong(focus, AX);
  m("accent");
  out.push(S(G.solidOf([[-6, 3.6], [0, 3.6], [2, 6.4]], Ff, P), { tone: "hi", lit: true }));
  out.push(L(G.circleOf(Ff, 2, 4.2, P, 32), { tone: "lit" }));
  return out.join("");
}

emit(named("ground_antenna"), {
  width: W, height: H, title: "Ground-station antenna",
  label: "A satellite ground-station antenna: a segmented parabolic reflector with a quadripod and a lit feed horn at its focus, on an elevation yoke and an azimuth bearing atop an octagonal pedestal bolted to a concrete pad.",
  body: [css(), base(), dish()],
});
