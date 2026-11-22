import { crown, H, LineArt, W, type Art, type Pt } from "./line-art";

/**
 * BMSCE's PJ (Platinum Jubilee) Block as line art, traced by hand from diagram/PJ_BLOCK.jpeg:
 * the curved facade's floor slabs and window bays, the glass atrium at its foot, the conifer on the
 * right, the flowering tree on the left and the two planters. The City header shows it for cities
 * without a landmark drawing of their own (components/landmarks.tsx).
 */

/** Cubic Hermite through knots with Catmull-Rom tangents: a smooth y(x) for each slab. */
function curve(xs: number[], ys: number[]) {
  const m = ys.map((_, i) => {
    const a = Math.max(0, i - 1);
    const b = Math.min(ys.length - 1, i + 1);
    return (ys[b] - ys[a]) / (xs[b] - xs[a]);
  });
  return (x: number) => {
    let i = 0;
    while (i < xs.length - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const d = (pts: Pt[], close = false) => "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L") + (close ? "Z" : "");
const along = (f: (x: number) => number, x0: number, x1: number, dy = 0, step = 8): Pt[] => {
  const out: Pt[] = [];
  for (let x = x0; x < x1; x += step) out.push([x, f(x) + dy]);
  out.push([x1, f(x1) + dy]);
  return out;
};

// Floor slabs, bottom (top of the atrium) to the roof: y at x = 0, 400, 700, 900. The facade curves
// toward the viewer on the right, so the slabs there climb and spread.
const KX = [0, 400, 700, 900];
const SLABS = [
  [610, 530, 465, 430],
  [545, 455, 405, 370],
  [470, 380, 320, 270],
  [400, 305, 220, 150],
  [335, 240, 120, 30],
  [270, 175, 20, -90],
  [215, 120, -80, -210],
].map((ys) => curve(KX, ys));
const SLAB_X0 = [150, 120, 0, 0, 0, 0, 0];
const SLAB_X1 = 830; // the conifer stands in front of the rest

function facade(): { strong: string[]; faint: string[] } {
  const strong: string[] = [];
  const faint: string[] = [];
  // Each slab as a band: its edge and the soffit under it.
  SLABS.forEach((f, k) => {
    strong.push(d(along(f, SLAB_X0[k], SLAB_X1)));
    if (k > 0 && k < SLABS.length - 1) faint.push(d(along(f, SLAB_X0[k], SLAB_X1, 9)));
  });
  // Window bays between slabs: a pane per bay, wider toward the viewer.
  for (let k = 1; k < SLABS.length - 1; k++) {
    const lo = SLABS[k];
    const hi = SLABS[k + 1];
    let x = SLAB_X0[k] + 14;
    while (x < SLAB_X1 - 30) {
      const step = 40 + x * 0.05;
      const w = step * 0.55;
      const x2 = Math.min(x + w, SLAB_X1 - 6);
      const pane: Pt[] = [
        [x, lo(x) - 7],
        [x2, lo(x2) - 7],
        [x2, hi(x2) + 16],
        [x, hi(x) + 16],
      ];
      faint.push(d(pane, true));
      // A pier between bays.
      const px = x + w + (step - w) / 2;
      if (px < SLAB_X1) strong.push(d([[px, lo(px)], [px, hi(px) + 9]]));
      x += step;
    }
  }
  // Roof: a raised block with a mast over the left wing.
  const roof = SLABS[6];
  strong.push(d([[280, roof(280)], [280, roof(280) - 42], [470, roof(470) - 42]]));
  strong.push(d([[415, roof(415) - 42], [415, roof(415) - 95]]));
  return { strong, faint };
}

function atrium(): { strong: string[]; faint: string[] } {
  const strong: string[] = [];
  const faint: string[] = [];
  const top = SLABS[0];
  const ground = 790;
  // Mullions.
  for (let x = 270; x <= 800; x += 48) faint.push(d([[x, top(x) + 6], [x, ground]]));
  strong.push(d([[262, top(262)], [262, ground]]));
  // Transoms, in perspective with the slabs.
  [0.38, 0.7].forEach((t) => faint.push(d(along((x) => top(x) + (ground - top(x)) * t, 262, 820, 0, 12))));
  // The braces seen through the glass.
  [[380, 700, 480, 560], [432, 700, 530, 550], [490, 650, 565, 560]].forEach(([a, b, c, e]) => faint.push(d([[a, b], [c, e]])));
  // Entrance canopy.
  strong.push(d([[120, 690], [560, 668]]));
  strong.push(d([[120, 700], [560, 678]]));
  // The brick podium on the left, behind the tree.
  strong.push(d([[150, 790], [150, 640], [262, 634]]));
  // Ground and paving.
  strong.push(d([[0, ground], [W, ground]]));
  [[0, 840, 420, 820], [0, 885, 400, 860], [140, 790, 60, H], [330, 790, 300, H]].forEach(([a, b, c, e]) => faint.push(d([[a, b], [c, e]])));
  return { strong, faint };
}

function trees(): { strong: string[]; faint: string[]; fills: string[] } {
  const fills: string[] = [];
  const strong: string[] = [];
  const faint: string[] = [];
  // The conifer: a trunk and drooping tiers, wider as they go down.
  const tx = 852;
  strong.push(d([[tx, 0], [tx, 790]]));
  for (let t = 0; t < 11; t++) {
    const y = 20 + t * 68;
    const w = 34 + t * 9;
    strong.push(`M${tx} ${y}Q${tx - w * 0.6} ${y + 14} ${tx - w} ${y + 44}`);
    strong.push(`M${tx} ${y}Q${tx + w * 0.6} ${y + 14} ${tx + w} ${y + 44}`);
    faint.push(`M${tx} ${y + 22}Q${tx - w * 0.45} ${y + 32} ${tx - w * 0.75} ${y + 52}`);
    faint.push(`M${tx} ${y + 22}Q${tx + w * 0.45} ${y + 32} ${tx + w * 0.75} ${y + 52}`);
  }
  // The flowering tree on the left: two crowns and a forked trunk.
  fills.push(crown(105, 420, 135, 92, 15, 0.3), crown(70, 560, 90, 62, 11, 1.1));
  strong.push(crown(105, 420, 135, 92, 15, 0.3));
  faint.push(crown(70, 560, 90, 62, 11, 1.1));
  faint.push(crown(120, 410, 80, 52, 10, 2.0));
  strong.push(d([[70, 790], [88, 640], [110, 500]]));
  strong.push(d([[96, 790], [106, 660], [150, 520]]));
  faint.push(d([[100, 600], [40, 520]]));
  // Planters with bushes.
  [[455, 832, 46], [566, 852, 56]].forEach(([cx, cy, r]) => {
    strong.push(`M${cx - r} ${cy}A${r} ${r * 0.2} 0 0 0 ${cx + r} ${cy}A${r} ${r * 0.2} 0 0 0 ${cx - r} ${cy}`);
    strong.push(`M${cx - r} ${cy}L${cx - r * 0.9} ${cy + 36}A${r * 0.9} ${r * 0.18} 0 0 0 ${cx + r * 0.9} ${cy + 36}L${cx + r} ${cy}`);
    fills.push(crown(cx, cy - r * 0.7, r * 1.05, r * 0.65, 9, cx));
    faint.push(crown(cx, cy - r * 0.7, r * 1.05, r * 0.65, 9, cx));
  });
  fills.push(crown(720, 780, 60, 34, 8, 0.7));
  faint.push(crown(720, 780, 60, 34, 8, 0.7));
  return { strong, faint, fills };
}

const F = facade();
const A = atrium();
const T = trees();
const STRONG = [...F.strong, ...A.strong].join("");
const FAINT = [...F.faint, ...A.faint].join("");
const TREE_STRONG = T.strong.join("");
const TREE_FAINT = T.faint.join("");
const TREE_FILL = T.fills.join("");

export const PJ_ART: Art = {
  layers: [
    { faint: FAINT, strong: STRONG },
    { fill: TREE_FILL, faint: TREE_FAINT, strong: TREE_STRONG, tone: "front" },
  ],
};

export function PjBackdrop({ className }: { className?: string }) {
  return <LineArt art={PJ_ART} className={className} />;
}
