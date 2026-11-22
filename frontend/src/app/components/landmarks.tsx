import { crown, domeProfile, LineArt, poly, Scene, type Art, type Camera, type Elev, type Pt, type V3 } from "./line-art";
import { PJ_ART } from "./pj-backdrop";
import { AHMEDABAD_PORTRAIT } from "./portraits/ahmedabad";

/**
 * Each city's best-known structure as line art in the PJ Block's style, seen from a three-quarter
 * angle (front and right side, from a little above the ground): India Gate (Delhi), the Victoria
 * Memorial (Kolkata), the Charminar (Hyderabad) and the Golden Temple (Amritsar). Each is a small
 * 3D model (components/line-art.tsx), proportioned from photographs, units roughly 10 cm. Any
 * other city gets the PJ Block, except Ahmedabad, which gets a traced portrait (portraits/ahmedabad.ts).
 * Decoration only, never data.
 */

const CAM: Camera = { yaw: -34, dist: 2800, eye: 70, f: 1600 };

/** Lines on the ground (paving, water): painted first, left out of the framing. */
function ground(s: Scene, lines: [V3, V3][]) {
  const it = s.item([0, 0, 0], undefined, false);
  it.depth = 1e9;
  for (const [a, b] of lines) s.line(it, [a, b], true);
}

/** A bush or tree crown standing on the ground at `at`. */
function bush(s: Scene, at: V3, rx: number, ry: number, seed: number, trunk = 0) {
  s.sprite(
    at,
    (x, y, k) => {
      const c = crown(x, y - (trunk + ry) * k, rx * k, ry * k, 11, seed);
      return { fill: c, faint: c, strong: trunk ? poly([[x, y], [x, y - trunk * k]]) : undefined };
    },
    "front",
  );
}

/** Four posts from `y0` to `y1` at the corners of a square of half-side `r` around (cx, cz). */
function posts(s: Scene, cx: number, cz: number, r: number, y0: number, y1: number) {
  const it = s.item([cx, y0, cz]);
  for (const [dx, dz] of [[-r, -r], [r, -r], [r, r], [-r, r]]) s.line(it, [[cx + dx, y0, cz + dz], [cx + dx, y1, cz + dz]]);
}

/** A finial: a short spike with a bar. */
function finial(s: Scene, at: V3, h: number) {
  s.sprite(at, (x, y, k) => ({ strong: poly([[x, y], [x, y - h * k]]) + poly([[x - 2.5 * k, y - h * 0.55 * k], [x + 2.5 * k, y - h * 0.55 * k]]) }));
}

const lift = (prof: [number, number][], dy: number) => prof.map(([r, y]) => [r, y + dy] as [number, number]);

/* ------------------------------------------------------------------ Delhi: India Gate -------------- */

function indiaGate(s: Scene) {
  ground(s, [...[-80, 80, -200, 200].map((x) => [[x, 0, -150], [x, 0, -2400]] as [V3, V3]), [[-1200, 0, -150], [1200, 0, -150]]]);
  bush(s, [-560, 0, -300], 110, 24, 0.4);
  bush(s, [560, 0, -340], 120, 24, 1.3);

  const rustic = (e: Elev, w: number, a0: number, a1: number, top: number) => {
    for (let v = 28; v < top; v += 30) e.h(0, a0, v, true).h(a1, w, v, true);
  };
  const frieze = (e: Elev, w: number) => {
    e.h(0, w, 380, true).h(0, w, 394, true);
    e.v(16, 250, 440, true).v(w - 16, 250, 440, true);
  };
  s.box(-236, 236, 0, 20, -126, 126);
  s.box(-210, 210, 20, 460, -100, 100, {
    front: (e, w) => {
      e.roundArch(132, 288, 0, 250).roundArch(146, 274, 0, 250, true).roundArch(116, 304, 250, 250, true);
      e.h(0, 132, 250).h(288, w, 250).rect(201, 336, 219, 350, true);
      rustic(e, w, 132, 288, 250);
      frieze(e, w);
      e.v(60, 250, 440, true).v(w - 60, 250, 440, true);
      for (let u = 90; u <= 330; u += 12) e.v(u, 404, 420, true);
    },
    right: (e, w) => {
      e.roundArch(62, 138, 0, 150).roundArch(72, 128, 0, 150, true);
      e.h(0, 62, 150).h(138, w, 150);
      rustic(e, w, 62, 138, 150);
      frieze(e, w);
    },
  });
  s.box(-226, 226, 460, 474, -116, 116);
  s.box(-188, 188, 474, 550, -80, 80, {
    front: (e, w) => {
      e.rect(40, 20, w - 40, 58, true);
      for (let u = 120; u <= 256; u += 34) e.v(u, 28, 50, true);
    },
  });
  s.box(-202, 202, 550, 562, -94, 94);
  s.box(-150, 150, 562, 578, -60, 60);
  s.box(-104, 104, 578, 594, -36, 36);
  s.revolve([0, 594, 0], [[76, 0], [76, 4], ...lift(domeProfile(72, 46), 4)], { rings: [1], ribs: 14 });
}

/* ------------------------------------------------------------------ Kolkata: Victoria Memorial ----- */

function victoriaMemorial(s: Scene) {
  const pool: [V3, V3][] = [];
  for (let z = -230, i = 0; z > -1400; z -= 90 + i * 30, i++) pool.push([[-260 - i * 40, 0, z], [300 + ((i * 70) % 180), 0, z]]);
  ground(s, pool);
  bush(s, [-560, 0, -140], 80, 66, 0.2, 60);
  bush(s, [520, 0, -330], 84, 70, 1.4, 64);

  s.box(-380, 380, 0, 14, -170, 170);
  s.box(-356, 356, 14, 28, -150, 150);
  const windows = (e: Elev, us: number[]) => {
    for (const u of us) e.roundArch(u, u + 24, 40, 122, true);
  };
  s.box(-330, 330, 28, 225, -120, 120, {
    front: (e, w) => {
      e.h(0, w, 62, true).h(0, w, 168, true);
      windows(e, [110, 150, 190, 446, 486, 526]);
    },
    right: (e, w) => {
      e.h(0, w, 62, true).h(0, w, 168, true);
      windows(e, [98, 138]);
    },
  });
  s.box(-338, 338, 225, 237, -128, 128);

  // The four corner towers and their chhatris.
  const towerFace = (e: Elev, w: number) => {
    e.roundArch(w / 2 - 13, w / 2 + 13, 40, 112, true).roundArch(w / 2 - 11, w / 2 + 11, 182, 236, true).h(0, w, 160, true);
  };
  for (const [cx, cz] of [[-300, 92], [300, 92], [-300, -92], [300, -92]]) {
    s.box(cx - 42, cx + 42, 28, 315, cz - 42, cz + 42, { front: towerFace, right: towerFace, left: towerFace });
    s.box(cx - 48, cx + 48, 315, 323, cz - 48, cz + 48);
    posts(s, cx, cz, 32, 323, 360);
    s.box(cx - 40, cx + 40, 360, 368, cz - 40, cz + 40);
    s.revolve([cx, 368, cz], domeProfile(32, 42), { ribs: 10 });
    finial(s, [cx, 410, cz], 16);
  }

  // Small domes on the roof either side of the drum.
  for (const x of [-170, 170]) {
    s.revolve([x, 237, 0], [[30, 0], [30, 10], ...lift(domeProfile(28, 40), 10)], { rings: [1], ribs: 8 });
    finial(s, [x, 287, 0], 12);
  }

  // The drum, the dome, the lantern and the Angel of Victory.
  s.revolve([0, 237, 0], [[92, 0], [92, 12], [84, 12], [84, 100], [94, 100], [94, 110], [86, 110]], { rings: [1, 2, 3, 4, 5], ribs: 28 });
  s.revolve([0, 347, 0], domeProfile(86, 156), { ribs: 18, ribStart: 0.1 });
  s.revolve([0, 503, 0], [[15, 0], [15, 26], [18, 26], [18, 30], ...lift(domeProfile(16, 16), 30)], { rings: [1, 3] });
  s.sprite([0, 549, 0], (x, y, k) => {
    const p = (pts: Pt[], c = false) => poly(pts.map(([a, b]) => [x + a * k, y - b * k] as Pt), c);
    const body = p([[0, 0], [-4, 16], [0, 32], [4, 16]], true);
    return { fill: body, strong: body + p([[0, 20], [-10, 30], [-20, 26]]) + p([[0, 20], [10, 30], [20, 26]]) + p([[0, 32], [0, 36]]) };
  });

  // The portico, its great arch and its cupolas.
  s.box(-104, 104, 28, 300, -150, -120, {
    front: (e, w) => {
      e.roundArch(47, 161, 0, 148).roundArch(59, 149, 0, 148, true);
      e.v(16, 0, 272, true).v(w - 16, 0, 272, true).h(0, w, 228, true).h(0, w, 34, true);
    },
  });
  s.box(-112, 112, 300, 312, -158, -112);
  for (const x of [-94, 94]) {
    s.revolve([x, 312, -142], domeProfile(15, 30), { ribs: 6 });
    finial(s, [x, 342, -142], 10);
  }
}

/* ------------------------------------------------------------------ Hyderabad: Charminar ----------- */

function charminar(s: Scene) {
  ground(s, [
    [[-1400, 0, -260], [1400, 0, -260]],
    [[-1400, 0, -420], [1400, 0, -420]],
    [[-120, 0, -260], [-160, 0, -1600]],
    [[120, 0, -260], [160, 0, -1600]],
  ]);
  // The bazaar either side.
  const shops = (e: Elev, w: number, h: number) => {
    e.h(0, w, h - 30, true);
    for (let u = 20; u + 50 <= w; u += 70) e.rect(u, 0, u + 50, 70, true);
  };
  s.framing = false;
  s.box(-820, -470, 0, 130, -330, -230, { front: shops, right: shops });
  s.box(470, 760, 0, 120, -420, -320, { front: shops, right: shops });
  s.framing = true;

  s.box(-216, 216, 0, 20, -216, 216);
  const face = (e: Elev, w: number) => {
    e.pointedArch(64, 296, 0, 210, 350).pointedArch(80, 280, 0, 214, 334, true);
    e.line([[48, 0], [48, 402], [312, 402], [312, 0]], true);
    e.circle(180, 376, 20).line([[180, 376], [180, 390]], true).line([[180, 376], [191, 372]], true);
    e.rect(0, 402, w, 414);
    for (let u = 36; u + 40 <= w - 30; u += 48) e.pointedArch(u, u + 40, 422, 452, 472, true);
    e.rect(0, 482, w, 494);
    for (let u = 30; u + 26 <= w - 24; u += 32) e.pointedArch(u, u + 26, 494, 510, 516, true);
    e.h(0, w, 520);
    for (let u = 8; u < w; u += 14) e.v(u, 520, 532, true);
  };
  s.box(-180, 180, 20, 552, -180, 180, { front: face, right: face });

  // Four minarets, stepping in at each balcony, an onion dome on top.
  const prof: [number, number][] = [[28, 0], [28, 370], [42, 370], [42, 384], [26, 384], [26, 520], [40, 520], [40, 534], [21, 534], [21, 606], [33, 606], [33, 618], [17, 618], [17, 672], [29, 672], [29, 682], [19, 682]];
  const rings = prof.map((_, i) => i).slice(1);
  const minaret = [...prof, ...lift(domeProfile(19, 56, 0.2).slice(1), 682)];
  for (const [x, z] of [[-180, 180], [180, 180], [-180, -180], [180, -180]]) {
    s.revolve([x, 20, z], minaret, { rings, ribs: 16 });
    finial(s, [x, 758, z], 30);
  }
}

/* ------------------------------------------------------------------ Amritsar: Golden Temple -------- */

function goldenTemple(s: Scene) {
  s.framing = false;
  if (!s.reflect) {
    const ripples: [V3, V3][] = [];
    for (let z = -220, i = 0; z > -1600; z -= 70 + i * 26, i++) ripples.push([[-300 - ((i * 90) % 400), 0, z], [180 + ((i * 130) % 420), 0, z]]);
    ground(s, ripples);
    // The parikrama's buildings across the water.
    s.box(-1800, 1800, 0, 90, 900, 950, {
      front: (e, w) => {
        e.h(0, w, 72, true);
        for (let u = 20; u + 34 <= w; u += 64) e.pointedArch(u, u + 34, 0, 40, 60, true);
      },
    });
  }
  // The causeway, its balustrade and lamps.
  s.box(-1100, -150, 0, 14, -20, 20, {
    front: (e, w) => {
      e.h(0, w, 36, true);
      for (let u = 10; u < w; u += 26) e.v(u, 14, 36, true);
    },
  });
  for (const x of [-860, -620, -380]) {
    const it = s.item([x, 0, -20]);
    s.line(it, [[x, 14, -20], [x, 74, -20]]);
    s.line(it, [[x - 6, 74, -20], [x + 6, 74, -20], [x + 6, 88, -20], [x - 6, 88, -20], [x - 6, 74, -20]], true);
  }

  s.framing = true;

  // The lower storey, the eave, the upper storey, the eave and parapet.
  const doors = (e: Elev, w: number) => {
    e.pointedArch(32, 86, 0, 62, 90).pointedArch(w / 2 - 34, w / 2 + 34, 0, 68, 106).pointedArch(w - 86, w - 32, 0, 62, 90);
    e.pointedArch(w / 2 - 26, w / 2 + 26, 0, 66, 98, true).h(0, w, 108, true);
  };
  s.box(-150, 150, 0, 120, -150, 150, { front: doors, right: doors });
  const eave = (e: Elev, w: number) => {
    for (let u = 6; u < w; u += 16) e.line([[u, 0], [u + 5, -7]], true);
  };
  s.box(-164, 164, 120, 128, -164, 164, { front: eave, right: eave });
  const windows = (e: Elev, w: number) => {
    for (let u = 24; u + 28 <= w - 20; u += 46) e.pointedArch(u, u + 28, 10, 40, 56, true);
  };
  s.box(-128, 128, 128, 210, -128, 128, { front: windows, right: windows });
  s.box(-142, 142, 210, 218, -142, 142);
  const parapet = (e: Elev, w: number) => {
    for (let u = 8; u < w; u += 12) e.v(u, 0, 14, true);
  };
  s.box(-128, 128, 218, 232, -128, 128, { front: parapet, right: parapet });

  // Domelets along the parapet, the corner kiosks.
  for (const [x, z] of [[-56, -128], [56, -128], [128, -56], [128, 56]]) s.revolve([x, 232, z], domeProfile(9, 22, 0.2));
  for (const [x, z] of [[-112, 112], [112, 112], [-112, -112], [112, -112]]) {
    posts(s, x, z, 15, 232, 262);
    s.box(x - 22, x + 22, 262, 268, z - 22, z + 22);
    s.revolve([x, 268, z], domeProfile(17, 40, 0.2), { ribs: 8 });
    finial(s, [x, 308, z], 14);
  }

  // The gilded dome: its base, its ribs and the kalash.
  s.revolve([0, 232, 0], [[66, 0], [66, 20], [60, 20]], { rings: [1] });
  s.revolve([0, 252, 0], domeProfile(60, 152, 0.13, 22), { ribs: 20, rings: [1] });
  s.revolve([0, 404, 0], [[4, 0], [4, 8], [9, 12], [9, 15], [4, 18], [3, 30]], { rings: [2, 3] });
  s.sprite([0, 434, 0], (x, y, k) => ({ strong: `M${x - 9 * k} ${y + 2 * k}Q${x} ${y - 10 * k} ${x + 9 * k} ${y + 2 * k}` + poly([[x, y - 4 * k], [x, y - 12 * k]]) }));
}

/* ------------------------------------------------------------------ choosing one ------------------- */

const SCENES: Record<string, { build: (s: Scene) => void; water?: boolean }> = {
  delhi: { build: indiaGate },
  kolkata: { build: victoriaMemorial },
  hyderabad: { build: charminar },
  amritsar: { build: goldenTemple, water: true },
};

/** Ahmedabad (Gujarat) shows a portrait instead of a building: an edge trace of a photograph. */
const PORTRAITS: Record<string, Art> = {
  ahmedabad: {
    layers: [{ faint: AHMEDABAD_PORTRAIT.faint, strong: AHMEDABAD_PORTRAIT.strong }],
    // Padded so the whole figure clears the backdrop's fades: 5% above, ending at 73% down,
    // and 8% in from the right edge.
    viewBox: (() => {
      const { width: w, height: h } = AHMEDABAD_PORTRAIT;
      const size = h / 0.68;
      return `${w - size + 0.08 * size} ${-0.05 * size} ${size} ${size}`;
    })(),
  },
};

const cache = new Map<string, Art>();
export function landmarkArt(slug: string): Art {
  if (PORTRAITS[slug]) return PORTRAITS[slug];
  const sc = SCENES[slug];
  if (!sc) return PJ_ART;
  let a = cache.get(slug);
  if (!a) {
    const s = new Scene(CAM);
    sc.build(s);
    let mirror: Scene | undefined;
    if (sc.water) {
      mirror = new Scene(CAM, true);
      sc.build(mirror);
    }
    a = s.art(mirror);
    cache.set(slug, a);
  }
  return a;
}

export const hasLandmark = (slug: string) => slug in SCENES || slug in PORTRAITS;

/** The city's landmark (or the PJ Block), fading in when the city changes. */
export function CityBackdrop({ slug, className }: { slug: string; className?: string }) {
  return <LineArt key={slug} art={landmarkArt(slug)} bleed={hasLandmark(slug)} className={className} style={{ animation: "fade-in 600ms ease both" }} />;
}
