// Shared helpers for the report's isometric component figures (anatomy kit, light theme, static).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../Skills/anatomy-main/anatomy-main/kit/iso-kit.mjs";
import * as G from "../../Skills/anatomy-main/anatomy-main/kit/lathe.mjs";

export { k, G };
export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, "..", "..", "Final images", "components");

export function kitFor(P) {
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], a[2] ?? 0], P) - k.depthOf([b[0], b[1], b[2] ?? 0], P));
  const halo = (plan, z, h) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"/>`;
  return { at, S, L, D, byDepth, halo };
}

/** Writes <name>.svg (standalone, light) and <name>.html (card for review). */
export function emit(name, { width, height, label, body, title }) {
  mkdirSync(OUT, { recursive: true });
  const svg = k.figureSvg({ width, height, label, body, standalone: "light" });
  writeFileSync(join(OUT, `${name}.svg`), svg);
  const card = k.plateHtml({ fig: "Component", title, hint: "", readout: "", keys: [], caption: label, body: `<div class="iso-stage">${k.figureSvg({ width, height, label, body })}</div>` });
  writeFileSync(join(OUT, `${name}.html`), k.pageHtml({ title, theme: "light", body: card, width: 900 }));
  console.log("wrote", name);
}

// ---------- optional colour mode (--color): per-part materials, four-tone shading kept ----------
export const COLOR = process.argv.includes("--color");
export const MATS = {
  concrete: ["#E9E6E0", "#C4BFB6", "#CFCAC1", "#D9D5CD", "#E2DED7"],
  panel: ["#FBF8F1", "#D9D3C4", "#E4DFD2", "#EDE9DF", "#F5F2EA"],
  trim: ["#4F86C6", "#2B5A93", "#33679F", "#3C74AC", "#4680BA"],
  roof: ["#5B8FCB", "#2C5D97", "#356AA4", "#3F77B1", "#4A83BE"],
  metal: ["#DCE1E5", "#9AA4AD", "#A9B2BA", "#B8C0C7", "#C8CFD5"],
  steel: ["#C5CCD3", "#7E8892", "#8D97A1", "#9DA7B0", "#AEB7BF"],
  ac: ["#F1F2F2", "#C9CBCD", "#D3D5D7", "#DDDFE0", "#E7E8E9"],
  accent: ["#F4A261", "#C25E17", "#D06A1F", "#DD7628", "#E98433"],
  plate: ["#4A5560", "#2C343C", "#333C45", "#3A444E", "#424C57"],
  charcoal: ["#5C636B", "#30353B", "#393F46", "#434950", "#4E555C"],
  solar: ["#3E5C9A", "#1E2F57", "#243866", "#2B4275", "#334D86"],
  gold: ["#F2D27A", "#B58A2E", "#C69A38", "#D6AB45", "#E4BD57"],
  pcb: ["#5E9C6E", "#2F5F3B", "#376B44", "#40784D", "#4A8658"],
  wood: ["#E3CDAA", "#B08F62", "#BE9E70", "#CBAC7F", "#D7BC8F"],
};

export function colorKit(S0) {
  let mat = "metal";
  const m = (name) => { mat = name; };
  const S = (paths, style = {}) => S0(paths, COLOR ? { ...style, className: `m-${mat}` } : style);
  const css = () => {
    if (!COLOR) return "";
    const rules = Object.entries(MATS).map(([n, [t, a, b, c, e]]) => {
      const q = `.iso-solid.m-${n}`;
      return `${q}>.iso-fill{fill:${e}}${q}>.iso-top{fill:${t};stroke:${t}}`
        + `${q}>.iso-shade[data-shade="0"]{fill:${a};stroke:${a}}${q}>.iso-shade[data-shade="1"]{fill:${b};stroke:${b}}`
        + `${q}>.iso-shade[data-shade="2"]{fill:${c};stroke:${c}}${q}>.iso-shade[data-shade="3"]{fill:${e};stroke:${e}}`
        + `${q}>.iso-top,${q}>.iso-shade{stroke-width:.35}`;
    });
    return `<style>${rules.join("")}.iso-line[data-tone="faint"]{stroke:#9AA0A6}.iso-line[data-tone="lo"]{stroke:#6E757C}</style>`;
  };
  return { S, m, css };
}

export const named = (n) => (COLOR ? `${n}_color` : n);
