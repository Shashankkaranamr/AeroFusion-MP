import { crown, domeProfile, poly, Scene, type Elev, type Pt, type V3 } from "./line-art";

/**
 * The best-known structure of every other city, and the drawings for the dashboard's other tabs,
 * in the same style and from the same three-quarter angle as the first four landmarks
 * (components/landmarks.tsx): small 3D models, front (−z) and right (+x) faces in view, ground
 * at y = 0, units roughly 10 cm. Decoration only, never data.
 */

type Prof = [number, number][];
const lift = (prof: Prof, dy: number): Prof => prof.map(([r, y]) => [r, y + dy]);

/* ------------------------------------------------------------------ shared pieces ---------------- */

/** Lines on the ground (paving, water): painted first, left out of the framing. Skipped in a reflection. */
function ground(s: Scene, lines: [V3, V3][]) {
  if (s.reflect) return;
  const it = s.item([0, 0, 0], undefined, false);
  it.depth = 1e9;
  for (const [a, b] of lines) s.line(it, [a, b], true);
}

/** Ripples on water in front of the subject. */
function water(s: Scene, z0 = -220, n = 12, span = 520) {
  const out: [V3, V3][] = [];
  for (let z = z0, i = 0; i < n; z -= 60 + i * 24, i++) out.push([[-span + ((i * 97) % 260), 0, z], [span * 0.5 + ((i * 131) % 380), 0, z]]);
  ground(s, out);
}

/** Paving lines leading to the subject. */
function paving(s: Scene, x = 90, z0 = -180) {
  ground(s, [[[-x, 0, z0], [-x * 1.3, 0, -2200]], [[x, 0, z0], [x * 1.3, 0, -2200]], [[-1400, 0, z0], [1400, 0, z0]]]);
}

function posts(s: Scene, cx: number, cz: number, r: number, y0: number, y1: number) {
  const it = s.item([cx, y0, cz]);
  for (const [dx, dz] of [[-r, -r], [r, -r], [r, r], [-r, r]]) s.line(it, [[cx + dx, y0, cz + dz], [cx + dx, y1, cz + dz]]);
}

function finial(s: Scene, at: V3, h: number) {
  s.sprite(at, (x, y, k) => ({ strong: poly([[x, y], [x, y - h * k]]) + poly([[x - 2.5 * k, y - h * 0.55 * k], [x + 2.5 * k, y - h * 0.55 * k]]) }));
}

/** An open domed pavilion: four posts, a slab, a dome. */
function chhatri(s: Scene, x: number, y: number, z: number, r: number, onion = 0.14) {
  const h = r * 1.25;
  posts(s, x, z, r * 0.72, y, y + h);
  s.box(x - r, x + r, y + h, y + h + r * 0.22, z - r, z + r);
  const top = y + h + r * 0.22;
  s.revolve([x, top, z], domeProfile(r * 0.82, r * 1.15, onion), { ribs: 8 });
  finial(s, [x, top + r * 1.15, z], r * 0.55);
}

/** A minaret: a tapering shaft with two balconies and a domed top. */
function minaret(s: Scene, x: number, z: number, y0: number, h: number, r: number) {
  const prof: Prof = [
    [r, 0], [r * 0.92, h * 0.42], [r * 1.4, h * 0.42], [r * 1.4, h * 0.445], [r * 0.86, h * 0.445],
    [r * 0.8, h * 0.74], [r * 1.3, h * 0.74], [r * 1.3, h * 0.765], [r * 0.74, h * 0.765], [r * 0.74, h],
  ];
  const rings = prof.map((_, i) => i).slice(1);
  s.revolve([x, y0, z], [...prof, ...lift(domeProfile(r * 0.95, r * 1.5, 0.16).slice(1), h)], { rings, ribs: 12 });
  finial(s, [x, y0 + h + r * 1.5, z], r * 0.9);
}

/** A tower of shrinking tiers (gopuram, shikhara, stupa terraces). `curve` > 1 bows the silhouette in. */
function tiers(
  s: Scene,
  { x = 0, z = 0, y0, n, th, w0, d0, w1, d1, curve = 1, niches = 0 }: { x?: number; z?: number; y0: number; n: number; th: number; w0: number; d0: number; w1: number; d1: number; curve?: number; niches?: number },
) {
  const deco = (e: Elev, w: number, h: number) => {
    e.h(0, w, h - 3, true);
    for (let k = 0; k < niches; k++) {
      const u = ((k + 0.5) * w) / niches;
      const nw = Math.min(10, w / niches / 3);
      e.roundArch(u - nw, u + nw, 3, h * 0.45, true);
    }
  };
  for (let i = 0; i < n; i++) {
    const t = Math.pow(i / Math.max(1, n - 1), curve);
    const w = w0 + (w1 - w0) * t;
    const d = d0 + (d1 - d0) * t;
    s.box(x - w / 2, x + w / 2, y0 + i * th, y0 + (i + 1) * th, z - d / 2, z + d / 2, { front: deco, right: deco });
  }
  return y0 + n * th;
}

/** A Nagara temple tower: curved shikhara of tiers, an amalaka disc and a pot finial. */
function shikhara(s: Scene, x: number, z: number, y0: number, w: number, h: number) {
  const top = tiers(s, { x, z, y0, n: 12, th: h / 12, w0: w, d0: w, w1: w * 0.38, d1: w * 0.38, curve: 1.8, niches: 3 });
  s.revolve([x, top, z], [[w * 0.26, 0], [w * 0.3, h * 0.025], [w * 0.26, h * 0.05], [w * 0.1, h * 0.06]], { ribs: 16, rings: [1] });
  s.revolve([x, top + h * 0.06, z], [[w * 0.05, 0], [w * 0.09, h * 0.03], [w * 0.04, h * 0.06], [w * 0.02, h * 0.09]], { rings: [1] });
  const it = s.item([x, top, z]);
  s.line(it, [[x, top + h * 0.15, z], [x, top + h * 0.32, z]]);
  s.line(it, [[x, top + h * 0.32, z], [x + w * 0.4, top + h * 0.28, z], [x, top + h * 0.24, z]]);
}

/** A circle in 3D (centre, radius, unit normal) as points. */
function circle3(c: V3, r: number, n: V3, k = 40, a0 = 0, a1 = Math.PI * 2): V3[] {
  const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cr = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nl = Math.hypot(...n);
  const N: V3 = [n[0] / nl, n[1] / nl, n[2] / nl];
  const u0 = cr(N, ref);
  const ul = Math.hypot(...u0);
  const U: V3 = [u0[0] / ul, u0[1] / ul, u0[2] / ul];
  const Vv = cr(N, U);
  return Array.from({ length: k + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / k;
    return [c[0] + r * (Math.cos(a) * U[0] + Math.sin(a) * Vv[0]), c[1] + r * (Math.cos(a) * U[1] + Math.sin(a) * Vv[1]), c[2] + r * (Math.cos(a) * U[2] + Math.sin(a) * Vv[2])] as V3;
  });
}

/** A parabolic dish (rim centre c, radius R, facing n) with ribs, rings and a feed on struts. */
function dish(s: Scene, c: V3, R: number, n: V3) {
  const it = s.item(c);
  const nl = Math.hypot(...n);
  const N: V3 = [n[0] / nl, n[1] / nl, n[2] / nl];
  const back = (k: number): V3 => [c[0] - N[0] * k, c[1] - N[1] * k, c[2] - N[2] * k];
  const rim = circle3(c, R, N, 48);
  it.fill.push(s.path(it, rim, true));
  it.strong.push(s.path(it, rim, true));
  for (const f of [0.7, 0.4]) it.faint.push(s.path(it, circle3(back(R * 0.28 * (1 - f * f)), R * f, N, 40)));
  for (let i = 0; i < 48; i += 8) it.faint.push(s.path(it, [rim[i], back(R * 0.28), rim[(i + 24) % 48]]));
  const feed: V3 = [c[0] + N[0] * R * 0.7, c[1] + N[1] * R * 0.7, c[2] + N[2] * R * 0.7];
  for (const i of [4, 20, 36]) it.strong.push(s.path(it, [rim[i], feed]));
  s.sprite(feed, (x, y, k) => {
    const d = `M${x - 4 * k} ${y}a${4 * k} ${4 * k} 0 1 0 ${8 * k} 0a${4 * k} ${4 * k} 0 1 0 ${-8 * k} 0`;
    return { fill: d, strong: d };
  });
}

/** A row of small domes along the top front edge of a box. */
function domelets(s: Scene, x0: number, x1: number, y: number, z: number, n: number, r: number) {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
    s.revolve([x, y, z], domeProfile(r, r * 1.3, 0.12));
  }
}

const arcade = (n: number, v0: number, v1: number, pointed = true, faint = false) => (e: Elev, w: number) => {
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const u0 = i * step + step * 0.18;
    const u1 = (i + 1) * step - step * 0.18;
    if (pointed) e.pointedArch(u0, u1, v0, v0 + (v1 - v0) * 0.62, v1, faint);
    else e.roundArch(u0, u1, v0, v1 - (u1 - u0) / 2, faint);
  }
};
const windows = (cols: number, rows: number, v0: number, v1: number, faint = true) => (e: Elev, w: number) => {
  const sw = w / cols;
  const sh = (v1 - v0) / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) e.rect(c * sw + sw * 0.3, v0 + r * sh + sh * 0.25, (c + 1) * sw - sw * 0.3, v0 + (r + 1) * sh - sh * 0.2, faint);
};
const both = (...fs: ((e: Elev, w: number, h: number) => void)[]) => (e: Elev, w: number, h: number) => fs.forEach((f) => f(e, w, h));
const crenels = (step = 14) => (e: Elev, w: number, h: number) => {
  for (let u = 0; u < w; u += step) e.v(u, h - 8, h, true);
};

/* ================================================================== the cities ================= */

/** Agra: the Taj Mahal on its plinth, four minarets, four chhatris and the great onion dome. */
function agra(s: Scene) {
  ground(s, [[[-40, 0, -340], [-40, 0, -2400]], [[40, 0, -340], [40, 0, -2400]], [[-1400, 0, -340], [1400, 0, -340]]]);
  const plinth = (e: Elev, w: number) => {
    for (let u = 20; u + 30 <= w - 10; u += 52) e.pointedArch(u, u + 30, 6, 22, 32, true);
  };
  s.box(-330, 330, 0, 40, -330, 330, { front: plinth, right: plinth });
  for (const [x, z] of [[-300, 300], [300, 300], [-300, -300], [300, -300]]) minaret(s, x, z, 40, 300, 15);
  const face = (e: Elev, w: number) => {
    e.line([[86, 0], [86, 214], [194, 214], [194, 0]], true);
    e.pointedArch(100, 180, 0, 140, 196);
    for (const u of [18, 214]) {
      e.pointedArch(u, u + 48, 8, 60, 84, true);
      e.pointedArch(u, u + 48, 108, 160, 184, true);
    }
    e.h(0, w, 220);
  };
  s.box(-140, 140, 40, 268, -140, 140, { front: face, right: face });
  for (const [x, z] of [[-104, 104], [104, 104], [-104, -104], [104, -104]]) chhatri(s, x, 268, z, 30);
  s.revolve([0, 268, 0], [[84, 0], [84, 44], [80, 44]], { rings: [1, 2] });
  s.revolve([0, 312, 0], domeProfile(82, 210, 0.2, 24), { ribs: 18 });
  finial(s, [0, 522, 0], 46);
}

/** Mumbai: the Gateway of India by the sea: a great arch, side arches, four turrets. */
function mumbai(s: Scene) {
  water(s, -150);
  const face = (e: Elev, w: number) => {
    e.pointedArch(w / 2 - 70, w / 2 + 70, 0, 160, 228);
    e.pointedArch(w / 2 - 58, w / 2 + 58, 0, 164, 216, true);
    for (const u of [26, w - 86]) {
      e.pointedArch(u, u + 60, 0, 60, 92);
      e.rect(u - 6, 0, u + 66, 104, true);
      for (let k = 0; k < 3; k++) e.pointedArch(u + k * 22, u + k * 22 + 14, 150, 170, 182, true);
    }
    e.h(0, w, 250, true).h(0, w, 120, true);
    for (let u = 8; u < w; u += 12) e.v(u, 232, 248, true);
  };
  s.box(-200, 200, 0, 260, -60, 60, { front: face, right: arcade(1, 0, 150) });
  s.box(-150, 150, 260, 290, -40, 40, { front: (e, w) => { for (let u = 10; u < w; u += 18) e.v(u, 4, 26, true); } });
  for (const [x, z] of [[-178, -40], [178, -40], [-178, 40], [178, 40]]) {
    s.revolve([x, 260, z], [[22, 0], [22, 70], [26, 70], [26, 76], [20, 76], ...lift(domeProfile(19, 30, 0.1).slice(1), 76)], { rings: [1, 2, 3, 4], ribs: 8 });
    finial(s, [x, 366, z], 14);
  }
}

/** Jaipur: the Hawa Mahal, a pyramid of latticed bay windows crowned with small domes. */
function jaipur(s: Scene) {
  paving(s, 120, -120);
  const levels = [[440, 62], [400, 58], [340, 56], [260, 54], [180, 52]];
  let y = 0;
  levels.forEach(([w, h], i) => {
    const bays = Math.round(w / 34);
    const face = (e: Elev, ww: number, hh: number) => {
      for (let k = 0; k < bays; k++) {
        const u = (k + 0.5) * (ww / bays);
        e.rect(u - 9, 8, u + 9, hh - 18, true);
        e.roundArch(u - 9, u + 9, hh - 18, hh - 18);
        e.h(u - 11, u + 11, 8, true);
      }
      e.h(0, ww, hh - 4);
    };
    s.box(-w / 2, w / 2, y, y + h, -60 + i * 6, 60 - i * 6, { front: face, right: windows(2, 1, 8, h - 10) });
    domelets(s, -w / 2 + 8, w / 2 - 8, y + h, -60 + i * 6 + 6, Math.round(w / 34), 8);
    y += h;
  });
  s.revolve([0, y, 0], domeProfile(26, 40, 0.18), { ribs: 8 });
  finial(s, [0, y + 40, 0], 16);
}

/** Lucknow: the Rumi Darwaza, a towering gate with a crowning pavilion and curved wings. */
function lucknow(s: Scene) {
  paving(s, 80, -100);
  const face = (e: Elev, w: number) => {
    e.pointedArch(w / 2 - 70, w / 2 + 70, 0, 170, 280);
    e.pointedArch(w / 2 - 58, w / 2 + 58, 0, 176, 266, true);
    e.line([[w / 2 - 92, 0], [w / 2 - 92, 296], [w / 2 + 92, 296], [w / 2 + 92, 0]], true);
    for (const u of [12, w - 52]) for (let k = 0; k < 4; k++) e.pointedArch(u, u + 40, 30 + k * 62, 60 + k * 62, 80 + k * 62, true);
  };
  s.box(-180, 180, 0, 320, -40, 40, { front: face, right: arcade(1, 40, 140, true, true) });
  for (const x of [-330, 330]) {
    const wing = (e: Elev, w: number) => {
      for (let k = 0; k < 4; k++) e.pointedArch(k * (w / 4) + 8, (k + 1) * (w / 4) - 8, 0, 50, 76, true);
      e.h(0, w, 96, true);
    };
    s.box(x < 0 ? x : 180, x < 0 ? -180 : x, 0, 110, -30, 30, { front: wing });
    s.revolve([x, 110, 0], [[16, 0], [16, 40], [20, 40], ...lift(domeProfile(14, 26, 0.18).slice(1), 40)], { rings: [1] });
    finial(s, [x, 176, 0], 12);
  }
  s.box(-120, 120, 320, 336, -34, 34);
  chhatri(s, 0, 336, 0, 46, 0.2);
  for (const x of [-120, 120]) {
    s.revolve([x, 336, -30], domeProfile(12, 24, 0.2));
    finial(s, [x, 360, -30], 10);
  }
}

/** Varanasi: ghat steps down to the Ganga, temple towers above them. */
function varanasi(s: Scene) {
  water(s, -260, 14, 700);
  const steps = 9;
  for (let i = 0; i < steps; i++) s.box(-420, 420, i * 10, (i + 1) * 10, -230 + i * 20, 220);
  const ghat = (e: Elev, w: number, h: number) => {
    for (let u = 30; u + 24 < w; u += 70) e.rect(u, 10, u + 24, h - 12, true);
  };
  s.box(-420, 420, 90, 190, 40, 220, { front: ghat });
  shikhara(s, -170, 120, 190, 110, 250);
  shikhara(s, 140, 150, 190, 90, 200);
  chhatri(s, 330, 190, 90, 28);
  chhatri(s, -360, 190, 80, 24);
  const it = s.item([0, 90, 0]);
  for (const x of [-60, 20, 230]) {
    s.line(it, [[x, 90, -50], [x, 160, -50]]);
    s.line(it, [[x - 26, 160, -50], [x, 172, -50], [x + 26, 160, -50]], true);
  }
}

/** Patna: the Golghar, a beehive granary with a staircase winding up its side. */
function patna(s: Scene) {
  paving(s, 120, -260);
  s.revolve([0, 0, 0], [[240, 0], [240, 14], [228, 14]], { rings: [1] });
  const prof = domeProfile(226, 220, 0, 24);
  s.revolve([0, 14, 0], prof, { ribs: 0, rings: [4, 9, 14] });
  s.revolve([0, 232, 0], [[26, 0], [26, 8], [20, 8], [20, 16]], { rings: [1] });
  // the stair: a band winding up the front, drawn where it faces the eye
  const it = s.item([0, 14, -10]);
  const pts: V3[] = [];
  for (let t = 0; t <= 1; t += 0.01) {
    const f = t * (prof.length - 1) * 0.9;
    const i = Math.floor(f);
    const w = f - i;
    const r = prof[i][0] * (1 - w) + prof[i + 1][0] * w;
    const y = prof[i][1] * (1 - w) + prof[i + 1][1] * w;
    const a = -Math.PI * 0.05 - t * Math.PI * 0.9 - Math.PI / 2;
    pts.push([Math.cos(a) * (r + 2), y + 14, Math.sin(a) * (r + 2)]);
  }
  s.line(it, pts);
  s.line(it, pts.map(([x, y, z]) => [x, y + 8, z] as V3));
  s.box(-20, 20, 0, 50, -232, -222, { front: (e, w) => void e.roundArch(4, w - 4, 0, 30, true) });
}

/** Bhubaneswar: the Lingaraj temple's curved rekha deula and its pyramid-roofed hall. */
function bhubaneswar(s: Scene) {
  paving(s, 70, -200);
  s.box(-260, 260, 0, 24, -180, 180);
  shikhara(s, 60, 60, 24, 170, 430);
  s.box(-200, -40, 24, 120, -120, 40, { front: arcade(3, 0, 80, false, true), right: arcade(2, 0, 80, false, true) });
  tiers(s, { x: -120, z: -40, y0: 120, n: 7, th: 16, w0: 180, d0: 180, w1: 40, d1: 40, curve: 1 });
  s.revolve([-120, 232, -40], [[22, 0], [26, 6], [22, 12], [6, 16]], { ribs: 10 });
}

/** Guwahati: the Kamakhya temple's beehive shikhara on Nilachal hill. */
function guwahati(s: Scene) {
  s.framing = false;
  const hill: [V3, V3][] = [];
  for (let i = 0; i < 6; i++) hill.push([[-900 + i * 60, 0, 600 - i * 40], [900 - i * 80, 0, 600 - i * 40]]);
  ground(s, hill);
  s.framing = true;
  s.box(-240, 240, 0, 30, -200, 200);
  s.box(-200, 60, 30, 140, -160, 60, { front: arcade(4, 0, 90, false, true), right: arcade(3, 0, 90, false, true) });
  s.revolve([-70, 140, -50], [[100, 0], [100, 16], ...lift(domeProfile(92, 110, 0.05).slice(1), 16)], { ribs: 16, rings: [1] });
  s.box(30, 190, 30, 130, -20, 140);
  s.revolve([110, 130, 60], [[90, 0], [90, 14], ...lift(domeProfile(84, 210, 0.12, 22).slice(1), 14)], { ribs: 20, rings: [1] });
  finial(s, [110, 354, 60], 40);
}

/** Pune: Shaniwar Wada's walls and the bastions of the Dilli Darwaza. */
function pune(s: Scene) {
  paving(s, 60, -120);
  s.box(-420, -150, 0, 150, -30, 30, { front: crenels(), right: crenels() });
  s.box(150, 420, 0, 150, -30, 30, { front: crenels(), right: crenels() });
  s.box(-46, 46, 0, 200, -44, 30, {
    front: (e, w) => {
      e.pointedArch(18, w - 18, 0, 110, 150);
      for (let u = 26; u < w - 20; u += 12) for (let v = 16; v < 100; v += 20) e.v(u, v, v + 6, true);
    },
  });
  for (const x of [-110, 110]) {
    const b = s.revolve([x, 0, -30], [[66, 0], [58, 190], [68, 190], [68, 202]], { rings: [1, 2, 3], ribs: 0 });
    b.depth -= 2000; // in front of the walls and the gate
  }
  for (const x of [-420, 420]) s.revolve([x, 0, 0], [[56, 0], [50, 170], [56, 170], [56, 180]], { rings: [1, 2, 3] });
  s.box(-56, 56, 200, 226, -54, 40, { front: windows(5, 1, 4, 22) });
  s.revolve([0, 226, -8], domeProfile(26, 34, 0.1));
}

/** Nagpur: Deekshabhoomi, the great hollow stupa on its terraced drum. */
function nagpur(s: Scene) {
  paving(s, 90, -300);
  s.revolve([0, 0, 0], [[290, 0], [290, 16], [270, 16], [270, 32], [250, 32], [250, 92], [262, 92], [262, 100], [236, 100]], { rings: [1, 2, 3, 4, 5, 6, 7], ribs: 36 });
  s.revolve([0, 100, 0], domeProfile(230, 210, 0, 24), { ribs: 0, rings: [6, 12, 18] });
  s.box(-26, 26, 310, 340, -26, 26);
  for (let i = 0; i < 4; i++) s.revolve([0, 340 + i * 16, 0], [[40 - i * 8, 0], [40 - i * 8, 4]], {});
  finial(s, [0, 404, 0], 26);
}

/** Bhopal: the Taj-ul-Masajid, three domes over an arcade, two tall minarets. */
function bhopal(s: Scene) {
  paving(s, 120, -140);
  s.box(-270, 270, 0, 130, -70, 70, { front: both(arcade(7, 0, 110), (e, w) => void e.h(0, w, 118, true)), right: arcade(2, 0, 110) });
  s.box(-270, 270, 130, 146, -70, 70, { front: (e, w) => { for (let u = 6; u < w; u += 12) e.v(u, 2, 14, true); } });
  for (const [x, r, h] of [[-130, 46, 90], [0, 64, 120], [130, 46, 90]]) {
    s.revolve([x, 146, 0], [[r, 0], [r, 16], ...lift(domeProfile(r * 0.96, h, 0.2, 20).slice(1), 16)], { ribs: 14, rings: [1] });
    finial(s, [x, 146 + 16 + h, 0], r * 0.5);
  }
  for (const x of [-300, 300]) minaret(s, x, 0, 0, 380, 20);
}

/** Indore: the Rajwada, a seven-storey gate block above its great arch. */
function indore(s: Scene) {
  paving(s, 70, -120);
  const face = both((e, w) => {
    e.pointedArch(w / 2 - 44, w / 2 + 44, 0, 90, 130);
    for (let k = 1; k <= 6; k++) e.h(0, w, 140 + k * 36, true);
  }, (e, w) => {
    for (let k = 0; k < 6; k++) for (let u = 18; u + 16 < w; u += 30) if (k > 0 || u < w / 2 - 60 || u > w / 2 + 60) e.roundArch(u, u + 16, 150 + k * 36, 166 + k * 36, true);
  });
  s.box(-160, 160, 0, 380, -70, 70, { front: face, right: both(windows(4, 7, 140, 376)) });
  for (const x of [-345, 345]) s.box(x < 0 ? -345 : 160, x < 0 ? -160 : 345, 0, 170, -50, 50, { front: both(windows(6, 3, 20, 160), crenels(16)) });
  domelets(s, -150, 150, 380, -64, 8, 10);
}

/** Raipur: Vivekananda's statue on its island in Budha Talab. */
function raipur(s: Scene) {
  water(s, -220, 12, 600);
  s.revolve([0, 0, 0], [[200, 0], [200, 12], [180, 12]], { rings: [1] });
  s.box(-60, 60, 12, 40, -60, 60);
  s.box(-44, 44, 40, 150, -44, 44, { front: (e, w, h) => void e.rect(10, 20, w - 10, h - 20, true), right: (e, w, h) => void e.rect(10, 20, w - 10, h - 20, true) });
  s.box(-52, 52, 150, 160, -52, 52);
  // the figure: robe, arms folded, head and turban
  // the figure: a long robe, arms folded across the chest, the head under a turban
  s.revolve([0, 160, 0], [[40, 0], [36, 70], [32, 120], [40, 150], [44, 170], [34, 186], [12, 192], [10, 200]], { rings: [3, 4], ribs: 8 });
  s.box(-34, 34, 296, 316, -46, -30);
  s.revolve([0, 360, 0], [[0.1, 0], [14, 4], [17, 18], [14, 30], [19, 34], [21, 44], [12, 54], [0.1, 56]], { rings: [4, 5] });
}

/** Visakhapatnam: INS Kursura, the submarine museum on the beach. */
function visakhapatnam(s: Scene) {
  water(s, -300, 10, 900);
  const L = 320;
  const R = (x: number) => 46 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / L, 2.4)));
  const cy = 70;
  const xs = Array.from({ length: 33 }, (_, i) => -L + (2 * L * i) / 32);
  const it = s.item([0, cy, 0]);
  const top: V3[] = [];
  const bot: V3[] = [];
  for (const x of xs) {
    const r = R(x);
    const ring = circle3([x, cy, 0], Math.max(r, 0.5), [1, 0, 0], 36);
    const proj = ring.map((p) => [p, s.P(p)] as const);
    proj.sort((a, b) => a[1][1] - b[1][1]);
    top.push(proj[0][0]);
    bot.push(proj[proj.length - 1][0]);
  }
  const outline = [...top, ...[...bot].reverse()];
  it.fill.push(s.path(it, outline, true));
  it.strong.push(s.path(it, outline, true));
  for (const x of xs.filter((_, i) => i % 4 === 2)) it.faint.push(s.path(it, circle3([x, cy, 0], R(x), [1, 0, 0], 36, Math.PI * 0.5, Math.PI * 1.5)));
  it.faint.push(s.path(it, xs.map((x) => [x, cy, -R(x) * 0.98] as V3)));
  s.box(-40, 60, cy + 40, cy + 110, -16, 16, { front: (e, w) => void e.h(4, w - 4, 56, true) });
  const p = s.item([20, cy + 110, 0]);
  s.line(p, [[30, cy + 110, 0], [30, cy + 160, 0], [40, cy + 160, 0]]);
  s.line(p, [[0, cy + 110, 0], [0, cy + 140, 0]]);
  for (const x of [-220, -80, 80, 220]) s.box(x - 14, x + 14, 0, cy - R(x) + 2, -30, 30);
  s.box(L - 40, L - 20, cy - 4, cy + 30, -3, 3);
}

/** Bengaluru: the Vidhana Soudha, its colonnaded portico and central dome. */
function bengaluru(s: Scene) {
  paving(s, 140, -220);
  for (let i = 0; i < 4; i++) s.box(-150 + i * 8, 150 - i * 8, i * 8, (i + 1) * 8, -220 + i * 10, -150);
  const cols = (n: number, v1: number) => (e: Elev, w: number) => {
    for (let k = 0; k <= n; k++) e.v((k * w) / n, 0, v1, true);
    e.h(0, w, v1, true);
  };
  s.box(-400, 400, 0, 160, -110, 110, { front: both(windows(16, 3, 10, 150)), right: windows(5, 3, 10, 150) });
  s.box(-130, 130, 32, 200, -150, -110, { front: cols(10, 150), right: cols(2, 150) });
  s.box(-140, 140, 200, 214, -156, -104, { front: (e, w) => void e.line([[0, 14], [w / 2, 40], [w, 14]]) });
  s.revolve([0, 160, 0], [[72, 0], [72, 70], [80, 70], [80, 78], [70, 78]], { rings: [1, 2, 3, 4], ribs: 20 });
  s.revolve([0, 238, 0], domeProfile(68, 100, 0.06, 20), { ribs: 14 });
  finial(s, [0, 338, 0], 34);
  for (const x of [-360, 360]) {
    s.revolve([x, 160, -80], domeProfile(26, 38, 0.1), { ribs: 6 });
    finial(s, [x, 198, -80], 14);
  }
}

/** A gopuram: a doorway base and tiers to a barrel-vault crown with a row of kalashas. */
function gopuram(s: Scene, x: number, z: number, w: number, d: number, n: number) {
  s.box(x - w / 2, x + w / 2, 0, 100, z - d / 2, z + d / 2, {
    front: (e, ww) => {
      e.rect(ww / 2 - 26, 0, ww / 2 + 26, 80);
      e.h(0, ww, 92, true);
      for (let u = 14; u < ww - 10; u += 26) if (Math.abs(u - ww / 2) > 40) e.v(u, 10, 86, true);
    },
  });
  const top = tiers(s, { x, z, y0: 100, n, th: 38, w0: w * 0.92, d0: d * 0.86, w1: w * 0.52, d1: d * 0.42, curve: 1.15, niches: 5 });
  const bw = w * 0.5;
  const bd = d * 0.32;
  s.box(x - bw / 2, x + bw / 2, top, top + 22, z - bd / 2, z + bd / 2, { right: (e, ww) => void e.roundArch(2, ww - 2, 22, 22) });
  const it = s.item([x, top + 22, z]);
  s.line(it, [[x - bw / 2, top + 22, z - bd / 2], [x - bw / 2, top + 22 + bd * 0.45, z], [x - bw / 2, top + 22, z + bd / 2]]);
  for (let k = 0; k < 7; k++) {
    const kx = x - bw / 2 + ((k + 0.5) * bw) / 7;
    s.revolve([kx, top + 22 + bd * 0.4, z], [[5, 0], [7, 5], [4, 9], [1, 18]], {});
  }
}

/** Chennai: the Kapaleeshwarar temple's gopuram. */
function chennai(s: Scene) {
  paving(s, 60, -140);
  gopuram(s, 0, 0, 230, 130, 8);
  s.box(140, 330, 0, 60, -40, 60, { front: arcade(4, 0, 46, false, true) });
}

/** Thiruvananthapuram: the Padmanabhaswamy temple's seven-tier gopuram over its tank. */
function thiruvananthapuram(s: Scene) {
  water(s, -330, 10, 600);
  if (!s.reflect) for (let i = 0; i < 4; i++) s.box(-300 + i * 10, 300 - i * 10, -i * 6 - 6, -i * 6, -300 + i * 14, -230 + i * 14);
  gopuram(s, 0, 0, 280, 150, 7);
  s.box(-430, -150, 0, 70, -30, 50, { front: both(arcade(6, 0, 56, false, true), crenels(18)) });
  s.box(150, 430, 0, 70, -30, 50, { front: both(arcade(6, 0, 56, false, true), crenels(18)) });
}

/** Kochi: the Chinese fishing nets, cantilevers leaning out over the water. */
function kochi(s: Scene) {
  water(s, -120, 14, 700);
  const net = (x0: number, scale: number) => {
    s.box(x0 - 50 * scale, x0 + 50 * scale, 0, 24 * scale, 40, 140, {});
    const it = s.item([x0, 24 * scale, 60]);
    const base: V3 = [x0, 24 * scale, 80];
    const tip: V3 = [x0 + 40 * scale, 150 * scale, -260 * scale];
    const back: V3 = [x0 - 10 * scale, 120 * scale, 200 * scale];
    for (const dx of [-24, 24]) {
      s.line(it, [[base[0] + dx * scale, base[1], base[2]], tip]);
      s.line(it, [[base[0] + dx * scale, base[1], base[2]], back]);
    }
    s.line(it, [tip, [tip[0], tip[1] + 30 * scale, tip[2] + 60 * scale], back]);
    const c: V3 = [tip[0], tip[1] - 70 * scale, tip[2]];
    const corners: V3[] = [[c[0] - 70 * scale, c[1], c[2] - 70 * scale], [c[0] + 70 * scale, c[1], c[2] - 70 * scale], [c[0] + 70 * scale, c[1], c[2] + 70 * scale], [c[0] - 70 * scale, c[1], c[2] + 70 * scale]];
    for (const k of corners) s.line(it, [tip, k]);
    s.line(it, [...corners, corners[0]]);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const a = corners[0].map((v, j) => v + (corners[1][j] - v) * t) as V3;
      const b = corners[3].map((v, j) => v + (corners[2][j] - v) * t) as V3;
      const a2 = corners[0].map((v, j) => v + (corners[3][j] - v) * t) as V3;
      const b2 = corners[1].map((v, j) => v + (corners[2][j] - v) * t) as V3;
      s.line(it, [a, [(a[0] + b[0]) / 2, c[1] - 26 * scale, (a[2] + b[2]) / 2], b], true);
      s.line(it, [a2, [(a2[0] + b2[0]) / 2, c[1] - 26 * scale, (a2[2] + b2[2]) / 2], b2], true);
    }
    for (let i = 0; i < 4; i++) s.line(it, [back, [back[0] - 6 * scale + i * 4 * scale, back[1] - 50 * scale - i * 6 * scale, back[2]]], true);
  };
  net(-220, 1);
  net(160, 0.8);
}

/** Srinagar: a houseboat on Dal Lake, a shikara before it, mountains behind. */
function srinagar(s: Scene) {
  water(s, -140, 14, 700);
  if (!s.reflect) {
    s.framing = false;
    const it = s.item([0, 0, 2400], undefined, false);
    it.depth = 1e8;
    const ridge = (z: number, amp: number, seed: number): V3[] => Array.from({ length: 30 }, (_, i) => [-2400 + i * 170, Math.max(0, amp * (0.55 + 0.45 * Math.sin(i * 0.9 + seed)) * (0.7 + 0.3 * Math.sin(i * 2.3 + seed))), z]);
    s.line(it, ridge(2400, 700, 0.3), true);
    s.line(it, ridge(2000, 460, 1.7), true);
    s.framing = true;
  }
  s.box(-300, 300, 0, 34, -50, 50, { front: (e, w) => void e.h(0, w, 20, true) });
  const cabin = both(windows(12, 1, 8, 60), (e, w) => { for (let u = 4; u < w; u += 10) e.v(u, 66, 78, true); e.h(0, w, 78); });
  s.box(-260, 240, 34, 112, -42, 42, { front: cabin, right: windows(3, 1, 8, 60) });
  const roof = s.item([0, 112, 0]);
  for (const x of [-270, 250]) s.line(roof, [[x, 112, -50], [x, 150, 0], [x, 112, 50]]);
  roof.fill.push(s.path(roof, [[-270, 112, -50], [250, 112, -50], [250, 150, 0], [-270, 150, 0]], true));
  roof.strong.push(s.path(roof, [[-270, 112, -50], [250, 112, -50], [250, 150, 0], [-270, 150, 0]], true));
  roof.fill.push(s.path(roof, [[250, 112, -50], [250, 150, 0], [250, 112, 50]], true));
  roof.strong.push(s.path(roof, [[250, 112, -50], [250, 150, 0], [250, 112, 50]], true));
  // the shikara
  const sk = s.item([120, 0, -200]);
  const hull: V3[] = [[-10, 10, -200], [40, 0, -190], [200, 0, -190], [250, 14, -200], [200, 6, -210], [40, 6, -210]];
  sk.fill.push(s.path(sk, hull, true));
  sk.strong.push(s.path(sk, hull, true));
  for (const x of [80, 170]) s.line(sk, [[x, 4, -200], [x, 46, -200]]);
  sk.fill.push(s.path(sk, [[70, 46, -212], [180, 46, -212], [180, 52, -188], [70, 52, -188]], true));
  sk.strong.push(s.path(sk, [[70, 46, -212], [180, 46, -212], [180, 52, -188], [70, 52, -188]], true));
  s.line(sk, [[230, 30, -196], [290, -10, -206]], true);
}

/** Dehradun: the Forest Research Institute's long arcaded front and central tower. */
function dehradun(s: Scene) {
  paving(s, 150, -200);
  const front = both(arcade(18, 10, 64, false, true), arcade(18, 84, 136, false, true), (e, w) => void e.h(0, w, 74, true));
  s.box(-440, 440, 0, 150, -60, 60, { front, right: arcade(3, 10, 64, false, true) });
  const tower = both(arcade(3, 10, 70, false), arcade(3, 90, 150, false, true), arcade(3, 170, 220, false, true));
  s.box(-70, 70, 0, 250, -90, 70, { front: tower, right: arcade(2, 10, 70, false, true) });
  s.box(-80, 80, 250, 262, -100, 80);
  s.revolve([0, 262, -10], domeProfile(46, 60, 0.06), { ribs: 10 });
  finial(s, [0, 322, -10], 22);
  for (const x of [-440, 440]) {
    s.box(x - 40, x + 40, 0, 190, -76, 60, { front: arcade(2, 10, 64, false, true) });
    for (const dx of [-36, 36]) finial(s, [x + dx, 190, -72], 24);
  }
}

/** Chandigarh: Le Corbusier's Open Hand, turning on its mast over a sunken court. */
function chandigarh(s: Scene) {
  paving(s, 60, -200);
  s.box(-200, 200, 0, 18, -160, 160);
  s.box(-140, 140, 18, 30, -100, 100);
  const mastTop = 290;
  s.box(-6, 6, 30, mastTop, -6, 6);
  // the hand: a flat outline, palm open, fingers up, turned toward the viewer
  const hand: Pt[] = [[-60, 0], [-70, 60], [-96, 110], [-80, 116], [-56, 82], [-50, 150], [-34, 154], [-28, 96], [-14, 160], [4, 160], [6, 98], [24, 150], [40, 146], [32, 90], [56, 130], [70, 120], [50, 60], [40, 0]];
  const a = (-25 * Math.PI) / 180;
  const U: V3 = [Math.cos(a), 0, Math.sin(a)];
  const map = ([u, v]: Pt): V3 => [U[0] * u * 1.4, mastTop + v * 1.4, U[2] * u * 1.4];
  const it = s.item([0, mastTop, 0]);
  const pts = hand.map(map);
  it.fill.push(s.path(it, pts, true));
  it.strong.push(s.path(it, pts, true));
  it.faint.push(s.path(it, [[-40, 20], [-10, 60], [20, 30]].map((p) => map(p as Pt))));
  it.faint.push(s.path(it, [[-30, 4], [0, 40], [30, 4]].map((p) => map(p as Pt))));
}

/** Ludhiana: the clock tower (Ghanta Ghar). */
function ludhiana(s: Scene) {
  paving(s, 80, -140);
  s.box(-90, 90, 0, 24, -90, 90);
  const face = both((e, w) => { e.pointedArch(w / 2 - 18, w / 2 + 18, 0, 40, 60); for (let k = 1; k < 5; k++) e.h(0, w, 70 + k * 40, true); },
    (e, w) => void e.roundArch(w / 2 - 10, w / 2 + 10, 120, 150, true), (e, w) => { e.circle(w / 2, 222, 22); e.line([[w / 2, 222], [w / 2, 238]]); e.line([[w / 2, 222], [w / 2 + 12, 216]]); });
  s.box(-50, 50, 24, 280, -50, 50, { front: face, right: face });
  s.box(-58, 58, 280, 292, -58, 58);
  for (const [x, z] of [[-48, -48], [48, -48], [48, 48], [-48, 48]]) finial(s, [x, 292, z], 22);
  s.box(-36, 36, 292, 330, -36, 36, { front: arcade(2, 0, 34, false, true), right: arcade(2, 0, 34, false, true) });
  s.revolve([0, 330, 0], domeProfile(34, 46, 0.1), { ribs: 10 });
  finial(s, [0, 376, 0], 26);
}

/** Kanpur: the JK Temple, a central shikhara among four smaller ones on a stepped plinth. */
function kanpur(s: Scene) {
  paving(s, 80, -280);
  for (let i = 0; i < 3; i++) s.box(-260 + i * 14, 260 - i * 14, i * 12, (i + 1) * 12, -240 + i * 14, 240 - i * 14);
  s.box(-200, 200, 36, 130, -190, 190, { front: arcade(6, 6, 80, false, true), right: arcade(6, 6, 80, false, true) });
  shikhara(s, 0, 20, 130, 150, 300);
  for (const [x, z] of [[-150, -140], [150, -140], [-150, 150], [150, 150]]) shikhara(s, x, z, 130, 60, 130);
}

/** Gurugram: the glass towers of Cyber City. */
function gurugram(s: Scene) {
  paving(s, 200, -260);
  const glass = (cols: number, rows: number) => (e: Elev, w: number, h: number) => {
    for (let k = 1; k < cols; k++) e.v((k * w) / cols, 0, h, true);
    for (let r = 1; r < rows; r++) e.h(0, w, (r * h) / rows, true);
  };
  s.box(160, 320, 0, 300, 80, 220, { front: glass(6, 16), right: glass(5, 16) });
  s.box(-330, -150, 0, 360, 40, 200, { front: glass(7, 20), right: glass(6, 20) });
  s.box(-110, 110, 0, 470, -120, 60, { front: glass(8, 26), right: glass(7, 26) });
  const it = s.item([0, 470, -30]);
  const crownPts: V3[] = [[-110, 470, -120], [110, 470, -120], [110, 530, -30], [-110, 530, -30]];
  it.fill.push(s.path(it, crownPts, true));
  it.strong.push(s.path(it, crownPts, true));
  s.box(-160, 160, 0, 60, -200, -130, { front: glass(8, 2) });
}

/** Noida: Rashtriya Dalit Prerna Sthal, a great stupa among smaller domes on a wide terrace. */
function noida(s: Scene) {
  paving(s, 120, -320);
  s.box(-380, 380, 0, 26, -300, 300, { front: (e, w) => { for (let u = 20; u < w; u += 40) e.v(u, 4, 22, true); } });
  s.revolve([0, 26, 0], [[150, 0], [150, 50], [160, 50], [160, 58], [146, 58]], { rings: [1, 2, 3, 4], ribs: 24 });
  s.revolve([0, 84, 0], domeProfile(142, 140, 0, 22), { rings: [5, 11] });
  s.box(-18, 18, 224, 250, -18, 18);
  s.revolve([0, 250, 0], [[30, 0], [30, 5], [22, 10], [22, 14], [12, 18]], {});
  finial(s, [0, 268, 0], 20);
  for (const [x, z] of [[-280, -210], [280, -210], [-280, 210], [280, 210]]) {
    s.revolve([x, 26, z], [[52, 0], [52, 24], [48, 24]], { rings: [1] });
    s.revolve([x, 50, z], domeProfile(46, 50), {});
    finial(s, [x, 100, z], 14);
  }
  for (const x of [-90, 90]) {
    s.box(x - 10, x + 10, 26, 190, -290, -270);
    s.revolve([x, 190, -280], domeProfile(14, 18), {});
  }
}

/** Ghaziabad: a Nagara temple with its hall and flag. */
function ghaziabad(s: Scene) {
  paving(s, 70, -220);
  for (let i = 0; i < 3; i++) s.box(-220 + i * 12, 220 - i * 12, i * 12, (i + 1) * 12, -200 + i * 12, 200 - i * 12);
  s.box(-170, 10, 36, 140, -150, 30, { front: arcade(3, 0, 80, false, true), right: arcade(3, 0, 80, false, true) });
  tiers(s, { x: -80, z: -60, y0: 140, n: 6, th: 18, w0: 190, d0: 190, w1: 60, d1: 60 });
  s.revolve([-80, 248, -60], [[30, 0], [34, 6], [30, 12], [8, 16]], { ribs: 10 });
  shikhara(s, 80, 70, 36, 150, 320);
}

/** Faridabad: Raja Nahar Singh's palace, arcades and chhatris. */
function faridabad(s: Scene) {
  paving(s, 120, -200);
  const face = both(arcade(9, 0, 80), arcade(9, 100, 160, true, true), (e, w) => void e.h(0, w, 90, true), crenels(16));
  s.box(-320, 320, 0, 190, -80, 80, { front: face, right: arcade(3, 0, 80) });
  for (const x of [-320, 320]) {
    s.box(x - 50, x + 50, 0, 240, -90, 40, { front: both(arcade(2, 0, 80), arcade(2, 120, 190, true, true)) });
    chhatri(s, x, 240, -24, 36);
  }
  chhatri(s, 0, 190, -40, 50, 0.18);
  for (const x of [-160, 160]) chhatri(s, x, 190, -60, 26);
}

/** Jodhpur: Mehrangarh fort's walls and bastions on its rock. */
function jodhpur(s: Scene) {
  const rock = [
    [-460, 460, 0, 70, -260, 200],
    [-400, 420, 70, 130, -220, 180],
    [-360, 380, 130, 180, -190, 160],
  ];
  for (const [x0, x1, y0, y1, z0, z1] of rock) {
    s.box(x0, x1, y0, y1, z0, z1, {
      front: (e, w, h) => { for (let u = 30; u < w; u += 70) e.line([[u, 0], [u + 18, h * 0.6], [u + 40, h * 0.4], [u + 52, h]], true); },
      right: (e, w, h) => { for (let u = 30; u < w; u += 70) e.line([[u, 0], [u + 18, h * 0.6], [u + 52, h]], true); },
    });
  }
  const wall = both(crenels(14), windows(10, 2, 60, 200));
  s.box(-320, 300, 180, 420, -160, 120, { front: wall, right: both(crenels(14), windows(5, 2, 60, 200)) });
  for (const [x, z] of [[-320, -160], [300, -160], [-60, -160]]) s.revolve([x, 180, z], [[58, 0], [52, 250], [58, 250], [58, 262]], { rings: [1, 2, 3] });
  s.box(-160, 120, 420, 500, -110, 60, { front: both(windows(8, 1, 14, 70), crenels(14)), right: windows(4, 1, 14, 70) });
  domelets(s, -150, 110, 500, -104, 6, 12);
}

/* ================================================================== the other tabs ============= */

/** Overview: an Earth-observation satellite (most of the site's data comes from orbit). */
function satellite(s: Scene) {
  const c: V3 = [0, 300, 0];
  const panel = (sign: number) => {
    const x0 = sign > 0 ? 80 : -300;
    const x1 = sign > 0 ? 300 : -80;
    s.box(x0, x1, c[1] + 40, c[1] + 46, -70, 70, {});
    const it = s.item([(x0 + x1) / 2, c[1] + 46, 0]);
    for (let k = 1; k < 6; k++) {
      const x = x0 + ((x1 - x0) * k) / 6;
      s.line(it, [[x, c[1] + 46.5, -70], [x, c[1] + 46.5, 70]], true);
    }
    s.line(it, [[x0, c[1] + 46.5, 0], [x1, c[1] + 46.5, 0]], true);
    s.line(it, [[sign > 0 ? 60 : -60, c[1] + 43, 0], [sign > 0 ? 80 : -80, c[1] + 43, 0]]);
  };
  panel(-1);
  s.box(-60, 60, c[1] - 20, c[1] + 100, -60, 60, {
    front: (e, w, h) => { e.rect(14, 14, w - 14, h - 14, true); e.h(0, w, h * 0.55, true); },
    right: (e, w, h) => { for (let u = 10; u < w; u += 12) e.v(u, 10, h - 10, true); },
  });
  s.revolve([10, c[1] - 60, -10], [[24, 0], [24, 40], [30, 40]], { rings: [1, 2] });
  s.revolve([10, c[1] - 76, -10], [[14, 0], [20, 16]], {});
  dish(s, [20, c[1] + 150, 10], 40, [-0.35, 1, -0.4]);
  const m = s.item([20, c[1] + 100, 10]);
  s.line(m, [[20, c[1] + 100, 10], [20, c[1] + 134, 10]]);
  s.line(m, [[-40, c[1] + 100, -40], [-40, c[1] + 170, -40]]);
  panel(1);
}

/** Insights: a weather mast: anemometer, wind vane, instrument screen and a solar panel. */
function weatherMast(s: Scene) {
  paving(s, 60, -160);
  s.box(-120, 120, 0, 10, -120, 120);
  const H = 520;
  const it = s.item([0, 0, 0]);
  const legs: V3[] = [[-24, 10, -24], [24, 10, -24], [24, 10, 24], [-24, 10, 24]];
  for (const [x, , z] of legs) s.line(it, [[x, 10, z], [x * 0.4, H, z * 0.4]]);
  for (let y = 10; y < H; y += 40) {
    const t = (y - 10) / (H - 10);
    const k = 1 - 0.6 * t;
    const sq: V3[] = [[-24 * k, y, -24 * k], [24 * k, y, -24 * k], [24 * k, y, 24 * k], [-24 * k, y, 24 * k], [-24 * k, y, -24 * k]];
    s.line(it, sq, true);
    const k2 = 1 - 0.6 * ((y + 40 - 10) / (H - 10));
    s.line(it, [[-24 * k, y, -24 * k], [24 * k2, y + 40, -24 * k2]], true);
    s.line(it, [[24 * k, y, -24 * k], [24 * k2, y + 40, 24 * k2]], true);
  }
  const top = H;
  s.line(it, [[0, top, 0], [0, top + 60, 0]]);
  s.line(it, [[-70, top + 30, 0], [70, top + 30, 0]]);
  // anemometer: three cups on arms
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p: V3 = [-70 + Math.cos(a) * 30, top + 46, Math.sin(a) * 30];
    s.line(it, [[-70, top + 46, 0], p]);
    s.revolve([p[0], p[1] - 8, p[2]], domeProfile(8, 9), {});
  }
  s.line(it, [[-70, top + 30, 0], [-70, top + 46, 0]]);
  // wind vane
  s.line(it, [[70, top + 30, 0], [70, top + 46, 0]]);
  s.line(it, [[40, top + 46, -10], [100, top + 46, 10]]);
  it.fill.push(s.path(it, [[86, top + 46, 5], [104, top + 60, 11], [104, top + 34, 11]], true));
  it.strong.push(s.path(it, [[86, top + 46, 5], [104, top + 60, 11], [104, top + 34, 11]], true));
  // instrument screen (louvred box) and solar panel on the mast
  s.box(-70, -10, 170, 230, -60, -10, { front: (e, w, h) => { for (let v = 6; v < h; v += 7) e.h(3, w - 3, v, true); }, right: (e, w, h) => { for (let v = 6; v < h; v += 7) e.h(3, w - 3, v, true); } });
  const sp = s.item([30, 300, -30]);
  const P: V3[] = [[10, 290, -60], [90, 290, -60], [90, 340, -10], [10, 340, -10]];
  sp.fill.push(s.path(sp, P, true));
  sp.strong.push(s.path(sp, P, true));
  for (let k = 1; k < 4; k++) sp.faint.push(s.path(sp, [[10 + k * 20, 290, -60], [10 + k * 20, 340, -10]]));
  s.box(-100, -40, 10, 70, -100, -50, { front: (e, w, h) => void e.rect(8, 8, w - 8, h - 8, true) });
}

/** Projections: a factory: saw-tooth sheds and three banded chimneys with their plumes. */
function factory(s: Scene) {
  paving(s, 200, -240);
  for (let i = 0; i < 4; i++) {
    const x0 = -380 + i * 130;
    s.box(x0, x0 + 130, 0, 110, -160, 120, { front: windows(3, 1, 20, 90) });
    const it = s.item([x0 + 65, 110, -20]);
    const pts: V3[] = [[x0, 110, -160], [x0, 170, -160], [x0 + 130, 110, -160]];
    it.fill.push(s.path(it, pts, true));
    it.strong.push(s.path(it, pts, true));
    s.line(it, [[x0, 170, -160], [x0, 170, 120]]);
  }
  for (const [x, h] of [[200, 420], [290, 360], [370, 300]]) {
    s.revolve([x, 0, 40], [[30, 0], [22, h]], { rings: [1] });
    const it = s.item([x, 0, 40]);
    for (const t of [0.7, 0.85]) {
      const r = 30 - 8 * t;
      it.faint.push(s.path(it, Array.from({ length: 19 }, (_, i) => [x + Math.cos(Math.PI * (i / 18) + Math.PI) * r * -1, h * t, 40 - Math.sin(Math.PI * (i / 18)) * r] as V3)));
    }
    s.sprite([x, h + 30, 40], (px, py, k) => {
      const c1 = crown(px + 30 * k, py - 30 * k, 40 * k, 26 * k, 9, x);
      const c2 = crown(px + 80 * k, py - 70 * k, 56 * k, 34 * k, 10, x + 1);
      return { faint: c1 + c2 };
    });
  }
  s.box(-380, 140, 0, 60, -230, -170, { front: windows(10, 1, 10, 50) });
}

/** History: a CPCB monitoring station: shelter, sampling mast, inlet and wind sensors. */
function station(s: Scene) {
  paving(s, 80, -200);
  s.box(-260, 260, 0, 8, -200, 200);
  const shelter = (e: Elev, w: number, h: number) => { e.rect(w * 0.15, 0, w * 0.32, h * 0.82); e.rect(w * 0.55, h * 0.4, w * 0.85, h * 0.72, true); e.h(0, w, h - 10, true); };
  s.box(-200, 120, 8, 220, -120, 100, { front: shelter, right: (e, w, h) => void e.rect(w * 0.3, h * 0.35, w * 0.7, h * 0.7, true) });
  s.box(-210, 130, 220, 232, -130, 110);
  s.box(120, 160, 60, 130, -80, 0, { front: (e, w, h) => { e.circle(w / 2, h / 2, 14, true); }, right: (e, w, h) => { for (let v = 8; v < h; v += 8) e.h(4, w - 4, v, true); } });
  const it = s.item([-60, 232, 0]);
  s.line(it, [[-60, 232, -10], [-60, 420, -10]]);
  s.revolve([-60, 420, -10], [[14, 0], [14, 10], [24, 10], [24, 30], [10, 44], [6, 60]], { rings: [1, 2, 3], ribs: 6 });
  s.line(it, [[60, 232, -20], [60, 400, -20]]);
  s.line(it, [[30, 400, -20], [90, 400, -20]]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p: V3 = [30 + Math.cos(a) * 18, 412, -20 + Math.sin(a) * 18];
    s.line(it, [[30, 412, -20], p]);
    s.revolve([p[0], p[1] - 6, p[2]], domeProfile(6, 7), {});
  }
  s.line(it, [[30, 400, -20], [30, 412, -20]]);
  s.line(it, [[90, 400, -20], [90, 412, -20], [110, 414, -14]]);
  for (let x = -250; x <= 250; x += 50) s.line(it, [[x, 8, -200], [x, 60, -200]], true);
  s.line(it, [[-250, 50, -200], [250, 50, -200]], true);
}

/** About the data: a ground station's receiving dish and its equipment cabin. */
function groundStation(s: Scene) {
  paving(s, 80, -200);
  s.box(-200, 200, 0, 14, -200, 200, { front: (e, w) => void e.h(10, w - 10, 7, true) });
  s.revolve([0, 14, 0], [[40, 0], [34, 200], [44, 200], [44, 216], [36, 216]], { rings: [1, 2, 3, 4], ribs: 0 });
  s.box(-40, 40, 216, 250, -40, 40);
  dish(s, [-10, 330, -40], 170, [-0.5, 0.75, -0.7]);
  s.box(110, 260, 14, 120, 40, 170, { front: (e, w, h) => { e.rect(14, 0, 44, h - 24); e.h(0, w, h - 12, true); }, right: (e, w, h) => void e.rect(w * 0.3, h * 0.4, w * 0.7, h * 0.7, true) });
}

/* ================================================================== registry =================== */

export const MORE_CITY_SCENES: Record<string, { build: (s: Scene) => void; water?: boolean }> = {
  agra: { build: agra },
  mumbai: { build: mumbai, water: true },
  jaipur: { build: jaipur },
  lucknow: { build: lucknow },
  varanasi: { build: varanasi, water: true },
  patna: { build: patna },
  bhubaneswar: { build: bhubaneswar },
  guwahati: { build: guwahati },
  pune: { build: pune },
  nagpur: { build: nagpur },
  bhopal: { build: bhopal },
  indore: { build: indore },
  raipur: { build: raipur, water: true },
  visakhapatnam: { build: visakhapatnam },
  bengaluru: { build: bengaluru },
  chennai: { build: chennai },
  thiruvananthapuram: { build: thiruvananthapuram, water: true },
  kochi: { build: kochi, water: true },
  srinagar: { build: srinagar, water: true },
  dehradun: { build: dehradun },
  chandigarh: { build: chandigarh },
  ludhiana: { build: ludhiana },
  kanpur: { build: kanpur },
  gurugram: { build: gurugram },
  noida: { build: noida },
  ghaziabad: { build: ghaziabad },
  faridabad: { build: faridabad },
  jodhpur: { build: jodhpur },
};

export const TAB_SCENES: Record<string, { build: (s: Scene) => void; water?: boolean }> = {
  now: { build: satellite },
  why: { build: weatherMast },
  "what-if": { build: factory },
  history: { build: station },
  data: { build: groundStation },
};
