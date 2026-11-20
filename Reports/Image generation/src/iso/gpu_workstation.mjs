// GPU training workstation with its side panel removed (RTX PRO 4500 Blackwell, 32 GB): the model-training machine.
import { k, G, kitFor, emit, colorKit, named } from "./common.mjs";

const W = 600, H = 500;
const CASE = { x: -56, y: -26, w: 112, d: 52, r: 1.2 };
const CH = 120, T = 2.2;
const P = k.fitProjection(k.boxCorners(CASE, -5, CH + 2), W, H, { pad: 28, azimuth: 52, elevation: 28 });
const { at, S: S0, L, D, byDepth, halo } = kitFor(P);
const { S, m, css } = colorKit(S0);
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts) => pts.map((p, i) => (i ? "L" : "M") + k.iso(p, P).join(" ")).join("") + "Z";
const X0 = CASE.x, X1 = CASE.x + CASE.w, Y0 = CASE.y, Y1 = CASE.y + CASE.d;

function shell() {
  const out = [halo(CASE, -5, 5)];
  m("charcoal");
  for (const [x, y] of byDepth(k.corners(CASE, 9))) out.push(S(k.slabOf({ x: x - 5, y: y - 3, w: 10, d: 6, r: 1.5 }, -5, 5, P, 2, 0.3), { tone: "lo" }));
  out.push(S(k.slabOf(CASE, 0, T, P, 2, 0.4), { tone: "lo" }));                                        // floor
  out.push(S(k.slabOf({ x: X0, y: Y0, w: CASE.w, d: T, r: 0.4 }, T, CH - 2 * T, P, 2), { tone: "lo" })); // far wall (motherboard tray)
  out.push(S(k.slabOf({ x: X0, y: Y0, w: T, d: CASE.d, r: 0.4 }, T, CH - 2 * T, P, 2), { tone: "lo" })); // rear panel
  return out.join("");
}

function internals() {
  const out = [];
  m("pcb");
  // motherboard on the tray with standoffs, slots and traces
  const mb = { x: X0 + 8, y: Y0 + T, w: 74, d: 1.6, r: 0.3 };
  out.push(S(k.slabOf(mb, 34, 78, P, 2), { tone: "mid", crease: "none" }));
  const Ym = Y0 + T + 1.6;
  out.push(L([40, 52, 64].map((z) => seg([X0 + 12, Ym, z], [X0 + 60, Ym, z])).join(""), { tone: "faint" }));
  out.push(D([[X0 + 11, 37], [X0 + 79, 37], [X0 + 11, 109], [X0 + 79, 109], [X0 + 45, 109]].map(([x, z]) => at([x, Ym, z])), { size: 0.5 }));
  // I/O shield on the rear panel
  out.push(L(poly([[X0 + T, Y0 + 6, 88], [X0 + T, Y0 + 20, 88], [X0 + T, Y0 + 20, 110], [X0 + T, Y0 + 6, 110]]), { tone: "lo" }));
  // PSU in its shroud at the bottom
  m("plate");
  const psu = { x: X0 + T, y: Y0 + T, w: 60, d: CASE.d - 2 * T - 4, r: 1 };
  out.push(S(k.slabOf(psu, T, 24, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(psu, 14, P, 2), { tone: "faint" }) }));
  out.push(L(k.ring(X0 + 30, Y0 + 24, 9, T + 24, P, 40) + k.ring(X0 + 30, Y0 + 24, 6, T + 24, P, 32), { tone: "lo" }));
  out.push(D([at([X0 + 30, Y0 + 24, T + 24])], { size: 0.6 }));
  // drive cage at the front bottom
  m("steel");
  const cage = { x: X1 - 34, y: Y0 + T + 4, w: 30, d: CASE.d - 2 * T - 8, r: 0.8 };
  out.push(S(k.slabOf(cage, T, 30, P, 2, 0.4), { tone: "mid" }));
  out.push(L([10, 18, 26].map((z) => k.sideSeam(cage, z, P, 2)).join(""), { tone: "faint" }));
  // RAM sticks
  m("trim");
  for (let i = 0; i < 4; i++) {
    const x = X0 + 56 + i * 3.4;
    out.push(S(k.slabOf({ x, y: Ym, w: 1.4, d: 16, r: 0.2 }, 76, 32, P, 1), { tone: "hi", crease: "lo" }));
  }
  // CPU tower cooler: fin stack + fan
  m("metal");
  const fin = { x: X0 + 26, y: Ym, w: 22, d: 24, r: 0.6 };
  out.push(S(k.slabOf(fin, 82, 26, P, 2, 0.4), { tone: "mid", inner: L([86, 90, 94, 98, 102, 106].map((z) => k.sideSeam(fin, z, P, 2)).join(""), { tone: "lo" }) }));
  const fan = { x: X0 + 48, y: Ym, w: 4, d: 26, r: 1 };
  out.push(S(k.slabOf(fan, 80, 30, P, 2, 0.4), { tone: "mid" }));
  out.push(L(k.sideRing([X0 + 52, Ym + 13, 95], 11, "x", P) + k.sideRing([X0 + 52, Ym + 13, 95], 4, "x", P), { tone: "lo" }));
  // the GPU: full-length card in the top PCIe slot, the lit subject
  const gpu = { x: X0 + 4, y: Ym, w: 90, d: 30, r: 1 };
  const gz = 48, gh = 14;
  m("pcb");
  out.push(S(k.slabOf({ x: X0 + 4, y: Ym, w: 88, d: 2, r: 0.3 }, gz - 3, 3, P, 2), { tone: "lo" }));          // PCB edge
  m("accent");
  out.push(S(k.slabOf(gpu, gz, gh, P, 3, 0.6), { tone: "hi", lit: true, inner: L(k.sideSeam(gpu, gz + 4, P, 3), { tone: "lo" }) }));
  // shroud top: backplate vents and the fan-through cut-out
  const top = gz + gh;
  out.push(L(k.planOutline({ x: X0 + 60, y: Ym + 4, w: 26, d: 22, r: 4 }, top, P, 4), { tone: "mid" }));
  const vents = [];
  for (let i = 0; i < 7; i++) vents.push(k.lineOnTop([X0 + 63 + i * 3.4, Ym + 6], [X0 + 63 + i * 3.4, Ym + 24], top, P));
  out.push(L(vents.join(""), { tone: "lo" }));
  out.push(L(k.planOutline({ x: X0 + 10, y: Ym + 6, w: 44, d: 18, r: 1.2 }, top, P, 2), { tone: "lo" }));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([X0 + 14 + i * 3, Ym + 9.5 + i * 2.6], [X0 + 34 + i * 3, Ym + 9.5 + i * 2.6], top, P)).join(""), { tone: "lo", free: true }));
  // power connector + cable to the PSU shroud
  m("plate");
  out.push(S(k.slabOf({ x: X0 + 74, y: Ym + 30, w: 8, d: 3, r: 0.6 }, top - 6, 5, P, 2), { tone: "mid" }));
  out.push(k.wireSvg(at([X0 + 78, Ym + 33, top - 3.5]), at([X0 + 58, Y0 + 30, T + 24]), { via: [at([X0 + 78, Ym + 40, top - 3.5]), at([X0 + 70, Ym + 40, T + 30])], ends: "both", size: 0.9 }));
  // rear PCIe brackets
  out.push(L([0, 1, 2].map((i) => poly([[X0 + T, Y0 + 6 + i * 6, 34], [X0 + T, Y0 + 10 + i * 6, 34], [X0 + T, Y0 + 10 + i * 6, 70], [X0 + T, Y0 + 6 + i * 6, 70]])).join(""), { tone: "faint" }));
  return out.join("");
}

function front() {
  const out = [];
  // top panel with a fan grille, then the front panel with mesh, power button and USB ports
  const top = { x: X0, y: Y0, w: CASE.w, d: CASE.d, r: 1.2 };
  m("charcoal");
  out.push(S(k.slabOf(top, CH - T, T, P, 2, 0.5), { tone: "mid" }));
  const mesh = [];
  for (let i = 0; i < 9; i++) mesh.push(k.lineOnTop([X0 + 20 + i * 6, Y0 + 10], [X0 + 20 + i * 6, Y1 - 10], CH, P));
  out.push(L(mesh.join(""), { tone: "faint" }));
  out.push(L(k.planOutline({ x: X0 + 16, y: Y0 + 8, w: 56, d: CASE.d - 16, r: 3 }, CH, P, 3), { tone: "lo" }));
  const fp = { x: X1 - T, y: Y0, w: T + 1.4, d: CASE.d, r: 0.6 };
  out.push(S(k.slabOf(fp, 0, CH, P, 2, 0.5), { tone: "mid" }));
  const Xf = X1 + 1.4;
  const holes = [];
  for (let z = 14; z < 92; z += 4.5) for (let y = Y0 + 8; y < Y1 - 6; y += 4.5) holes.push(at([Xf, y + ((z / 4.5) % 2 ? 2.2 : 0), z]));
  out.push(D(holes, { size: 0.34, tone: "lo" }));
  out.push(L(poly([[Xf, Y0 + 5, 10], [Xf, Y1 - 5, 10], [Xf, Y1 - 5, 96], [Xf, Y0 + 5, 96]]), { tone: "lo" }));
  out.push(L(k.sideRing([Xf, Y0 + 26, 108], 3.4, "x", P), { tone: "hi" }));
  out.push(D([at([Xf, Y0 + 26, 108])], { size: 0.6, tone: "hi" }));
  out.push(L([Y0 + 8, Y0 + 13].map((y) => poly([[Xf, y, 106], [Xf, y + 3, 106], [Xf, y + 3, 110], [Xf, y, 110]])).join(""), { tone: "lo" }));
  return out.join("");
}

emit(named("gpu_workstation"), {
  width: W, height: H, title: "GPU workstation",
  label: "A tower workstation with its side panel removed: a full-length GPU (the lit part) in the top slot of the motherboard, a tower CPU cooler, four memory modules, a shrouded power supply and drive cage, and a front panel with mesh, power button and ports.",
  body: [css(), shell(), internals(), front()],
});
