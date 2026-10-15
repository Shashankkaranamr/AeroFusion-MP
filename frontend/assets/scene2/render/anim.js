/**
 * AeroFusion · Scene 0 → Scene 1 as ONE continuous shot.
 * Everything is a pure function of t ∈ [0,1]: window.renderAt(t) renders that exact moment,
 * so frames can be rendered in any order, at any count, and scrubbed by scroll.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices, mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const P = new URLSearchParams(location.search);
const W = +(P.get("w") || 1920), H = +(P.get("h") || 1080);

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + (b - a) * rnd();
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ================= TIMELINE (shared with timeline.json) ================= */
export const T = {
  emberHold: [0.0, 0.12],
  burst: [0.12, 0.22],
  fall: [0.22, 0.48],
  landing: [0.48, 0.6],
  pullBack: [0.6, 0.96],
  hold: [0.96, 1.0],
};

/* ================= renderer ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const DARK = new THREE.Color("#0b0d14"); // the page background in the mockup
const FOGC = new THREE.Color("#6a3264");
scene.fog = new THREE.Fog(FOGC.clone(), 70, 320);
scene.background = DARK.clone();

const C = {
  stubble: "#d7a54e",
  burnt: "#2a1c26",
  soil: "#6b3f3a",
  wheat: "#3f6b55",
  bund: "#8a5a48",
  canopy: ["#2f9a7e", "#3fae84", "#2b8a98", "#5aa972", "#f0a24a", "#e0784a", "#f2c45a"],
  poplar: "#2f8a74",
  trunk: "#5a3a3a",
  brick: "#c2583f",
};
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

/* ================= sky ================= */
const skyU = { horCol: { value: FOGC }, dark: { value: DARK }, wf: { value: 1 } };
{
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 horCol; uniform vec3 dark; uniform float wf;
      void main(){
        float y = vP.y;
        vec3 top = vec3(0.025,0.02,0.07), mid = vec3(0.10,0.035,0.17);
        float sun = pow(max(0., dot(normalize(vec3(-0.6,0.,-1.)), normalize(vec3(vP.x,0.,vP.z)))), 2.);
        vec3 c = mix(horCol, mid, smoothstep(0.0, 0.28, y));
        c = mix(c, top, smoothstep(0.28, 0.75, y));
        c += vec3(1.0,0.42,0.32) * (0.18 + 0.5*sun) * smoothstep(0.0, 0.16, y) * exp(-y*7.);
        gl_FragColor = vec4(mix(dark, c, wf), 1.);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), m));
}
const starMat = new THREE.PointsMaterial({ color: "#ffe9f5", size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 });
{
  const n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rr(0, Math.PI * 2), ph = rr(0.35, 1.45);
    pos.set([480 * Math.cos(th) * Math.cos(ph), 480 * Math.sin(ph), 480 * Math.sin(th) * Math.cos(ph)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, starMat));
}

/* ================= lights ================= */
const hemi = new THREE.HemisphereLight("#a07cff", "#6a2e3e", 1.25);
scene.add(hemi);
const sunset = new THREE.DirectionalLight("#ff9c8c", 1.6);
sunset.position.set(-90, 45, -110);
sunset.castShadow = true;
sunset.shadow.mapSize.set(2048, 2048);
Object.assign(sunset.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
sunset.shadow.bias = -0.0008;
scene.add(sunset);
const rim = new THREE.DirectionalLight("#6fd6ff", 0.35);
rim.position.set(80, 30, 60);
scene.add(rim);
const BASE_LIGHT = { hemi: 1.25, sunset: 1.6, rim: 0.35 };

/* ================= field geometry ================= */
const FW = 30, FD = 22, GAP = 1.6;
const frontV = (u) => 470 + 70 * Math.sin(u * Math.PI * 1.3 + 0.4); // final fire front, texture px (0 = far edge)
const U0 = 0.55; // ignition column
const V0 = frontV(U0) - 60; // ignition row
const uToX = (u) => -FW / 2 + u * FW;
const vToZ = (v) => -FD / 2 + (v / 1024) * FD;
const IGN = new THREE.Vector3(uToX(U0), 0.32, vToZ(V0));

// fire state as a function of progress p ∈ [0,1]
const spreadW = (p) => 0.015 + 0.62 * p;
const vFront = (u, p) => lerp(V0, frontV(u), Math.min(1, p * 1.15));
const vTop = (u, p) => { const w = spreadW(p), du = Math.abs(u - U0); const k = Math.sqrt(Math.max(0, 1 - (du / w) ** 2)); return vFront(u, p) - (vFront(u, p) - 0) * Math.min(1, p * 1.05) * k - 8 * k; };
const burning = (u, p) => p > 0 && Math.abs(u - U0) < spreadW(p);

/* --- stubble base canvas --- */
function stubbleCanvas() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1024;
  const x = cv.getContext("2d");
  x.fillStyle = C.stubble; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1024; i += 64) { x.fillStyle = i / 64 % 2 ? "rgba(255,230,160,.18)" : "rgba(120,70,20,.16)"; x.fillRect(0, i, 1024, 64); }
  for (let i = 0; i < 9000; i++) {
    x.strokeStyle = rnd() > 0.5 ? "rgba(255,225,150,.35)" : "rgba(110,65,25,.35)";
    x.lineWidth = 1.2;
    const px = rr(0, 1024), py = rr(0, 1024);
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + rr(-3, 3), py - rr(4, 9)); x.stroke();
  }
  return cv;
}
const stubCv = stubbleCanvas();
const stubTex = new THREE.CanvasTexture(stubCv); stubTex.colorSpace = THREE.SRGBColorSpace; stubTex.anisotropy = 8;

/* --- hero field: dynamic burn texture --- */
const heroCv = document.createElement("canvas"); heroCv.width = heroCv.height = 1024;
const heroEm = document.createElement("canvas"); heroEm.width = heroEm.height = 1024;
const heroTex = new THREE.CanvasTexture(heroCv); heroTex.colorSpace = THREE.SRGBColorSpace; heroTex.anisotropy = 8;
const heroEmTex = new THREE.CanvasTexture(heroEm); heroEmTex.colorSpace = THREE.SRGBColorSpace;
const ash = Array.from({ length: 2500 }, () => [rr(0, 1024), rr(0, 1024), rr(2, 7), rnd() > 0.5]);
const speck = Array.from({ length: 2600 }, () => [rr(0, 1024), rnd(), rr(1, 3.5), Math.floor(rr(70, 170)), rr(0.3, 1)]);
function drawHero(p) {
  const x = heroCv.getContext("2d"), e = heroEm.getContext("2d");
  x.drawImage(stubCv, 0, 0);
  e.fillStyle = "#000"; e.fillRect(0, 0, 1024, 1024);
  if (p <= 0) { heroTex.needsUpdate = heroEmTex.needsUpdate = true; return; }
  const w = spreadW(p);
  const u0 = Math.max(0, U0 - w), u1 = Math.min(1, U0 + w);
  const STEP = 4;
  // burnt polygon: top boundary left→right, front boundary right→left
  x.fillStyle = C.burnt;
  x.beginPath();
  for (let px = u0 * 1024; px <= u1 * 1024; px += STEP) x.lineTo(px, vTop(px / 1024, p));
  for (let px = u1 * 1024; px >= u0 * 1024; px -= STEP) x.lineTo(px, vFront(px / 1024, p));
  x.closePath(); x.fill();
  for (const [u, v, l, k] of ash) {
    const uu = u / 1024;
    if (burning(uu, p) && v > vTop(uu, p) + 4 && v < vFront(uu, p) - 6) { x.fillStyle = k ? "rgba(70,55,65,.6)" : "rgba(20,12,18,.6)"; x.fillRect(u, v, l, 2); }
  }
  // glowing band at the front + embers behind it
  for (let px = u0 * 1024; px <= u1 * 1024; px += 2) {
    const uu = px / 1024, f = vFront(uu, p), edge = sstep(w, w * 0.6, Math.abs(uu - U0));
    const g = e.createLinearGradient(0, f - 90, 0, f + 6);
    g.addColorStop(0, "rgba(255,80,20,0)");
    g.addColorStop(0.75, `rgba(255,110,30,${(0.55 * edge).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,200,90,${edge.toFixed(3)})`);
    e.fillStyle = g; e.fillRect(px, f - 90, 2, 96);
  }
  for (const [u, r, s, gch, a] of speck) {
    const uu = u / 1024;
    if (!burning(uu, p)) continue;
    const top = vTop(uu, p), f = vFront(uu, p);
    const v = f - Math.pow(r, 2.2) * (f - top);
    e.fillStyle = `rgba(255,${gch},30,${a.toFixed(2)})`;
    e.beginPath(); e.arc(u, v, s, 0, 7); e.fill();
  }
  heroTex.needsUpdate = heroEmTex.needsUpdate = true;
}

function burntTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 512;
  const x = cv.getContext("2d");
  x.fillStyle = C.burnt; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${rnd() > .5 ? "80,60,70" : "15,8,12"},.5)`; x.fillRect(rr(0, 512), rr(0, 512), rr(2, 6), 2); }
  const ec = document.createElement("canvas"); ec.width = ec.height = 512;
  const e = ec.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { e.fillStyle = `rgba(255,${Math.floor(rr(60, 140))},25,${rr(.2, .8).toFixed(2)})`; e.beginPath(); e.arc(rr(0, 512), rr(0, 512), rr(.8, 2.2), 0, 7); e.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(ec); em.colorSpace = THREE.SRGBColorSpace;
  return { map: t, emissive: em };
}
const burnt = burntTexture();

/* ================= ground & fields ================= */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat("#5b3546"));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; ground.receiveShadow = true;
scene.add(ground);

const fieldsMeta = [];
for (let i = -5; i <= 5; i++) {
  for (let j = -6; j <= 3; j++) {
    const cx = i * (FW + GAP), cz = j * (FD + GAP);
    let kind;
    if (i === 0 && j === 0) kind = "hero";
    else if (j === 1 && (i === 0 || i === -1)) kind = "stubble";
    else { const r = rnd(); kind = r < 0.5 ? "stubble" : r < 0.66 ? "burnt" : r < 0.83 ? "wheat" : "soil"; }
    let m;
    if (kind === "hero") m = mat("#ffffff", { map: heroTex, emissiveMap: heroEmTex, emissive: "#ffffff", emissiveIntensity: 1.1 });
    else if (kind === "stubble") m = mat("#ffffff", { map: stubTex });
    else if (kind === "burnt") m = mat("#ffffff", { map: burnt.map, emissiveMap: burnt.emissive, emissive: "#ffffff", emissiveIntensity: 1.4 });
    else m = mat(kind === "wheat" ? C.wheat : C.soil);
    const f = new THREE.Mesh(new RoundedBoxGeometry(FW, 0.6, FD, 2, 0.25), m);
    f.position.set(cx, 0, cz); f.receiveShadow = true;
    scene.add(f);
    fieldsMeta.push({ cx, cz, kind });
  }
}
const bundMat = mat(C.bund);
for (let i = -5; i <= 6; i++) {
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 260, 2, 0.4), bundMat);
  b.position.set(i * (FW + GAP) - (FW + GAP) / 2, 0.1, -40); b.receiveShadow = b.castShadow = true; scene.add(b);
}
for (let j = -6; j <= 4; j++) {
  const b = new THREE.Mesh(new RoundedBoxGeometry(380, 0.9, 0.9, 2, 0.4), bundMat);
  b.position.set(0, 0.1, j * (FD + GAP) - (FD + GAP) / 2); b.receiveShadow = b.castShadow = true; scene.add(b);
}

/* ================= stubble: cut rice clumps in rows + loose straw ================= */
function clumpGeo(seedShift) {
  const parts = [];
  const n = 7 + Math.floor(rnd() * 4);
  const base = new THREE.Color("#7a5a2a"), mid = new THREE.Color("#c99a45"), top = new THREE.Color("#f2cf7a");
  for (let i = 0; i < n; i++) {
    const h = rr(0.32, 0.58);
    const g = new THREE.CylinderGeometry(0.02, 0.028, h, 5, 2);
    g.translate(0, h / 2, 0);
    // vertex colours: dark at the soil, golden at the cut tip
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) / h;
      const c = y < 0.5 ? base.clone().lerp(mid, y * 2) : mid.clone().lerp(top, (y - 0.5) * 2);
      col.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const a = rr(0, 6.283), sp = rr(0.08, 0.32), r = rr(0, 0.05);
    g.rotateZ(Math.cos(a) * sp); g.rotateX(Math.sin(a) * sp);
    g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    parts.push(g);
  }
  return mergeGeometries(parts);
}
const CLUMPS = [clumpGeo(0), clumpGeo(1), clumpGeo(2)];
const clumpMat = mat("#ffffff", { vertexColors: true, roughness: 0.8 });
const strawGeo = new RoundedBoxGeometry(0.62, 0.025, 0.045, 1, 0.01);
const strawMat = mat("#e6bf6a", { roughness: 0.85 });
const dummy = new THREE.Object3D();
const ROW = 0.42, HILL = 0.34; // world units between rows / between clumps in a row
function plantField(cx, cz, density = 1, list = null) {
  const out = [];
  for (let z = -FD / 2 + 0.4; z < FD / 2 - 0.3; z += ROW) {
    for (let x = -FW / 2 + 0.4; x < FW / 2 - 0.3; x += HILL / density) {
      out.push({ x: cx + x + rr(-0.06, 0.06), z: cz + z + rr(-0.05, 0.05), v: Math.floor(rnd() * 3), ry: rr(0, 6.28), s: rr(0.8, 1.2) });
    }
  }
  return out;
}
{ // other stubble fields near the camera (static)
  const cells = fieldsMeta.filter((f) => f.kind === "stubble" && Math.abs(f.cx) < 70 && f.cz > -30);
  const all = cells.flatMap((f) => plantField(f.cx, f.cz, 0.55));
  CLUMPS.forEach((g, vi) => {
    const list = all.filter((c) => c.v === vi);
    const im = new THREE.InstancedMesh(g, clumpMat, list.length);
    list.forEach((c, k) => { dummy.position.set(c.x, 0.3, c.z); dummy.rotation.set(0, c.ry, 0); dummy.scale.set(c.s * 1.3, c.s * 1.3, c.s * 1.3); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); });
    im.castShadow = im.receiveShadow = true; scene.add(im);
  });
}
// hero field (dynamic: clumps and straw vanish once burnt)
const heroClumps = plantField(0, 0, 1).map((c) => ({ ...c, u: (c.x + FW / 2) / FW, vv: ((c.z + FD / 2) / FD) * 1024 }));
const heroClumpIMs = CLUMPS.map((g, vi) => {
  const list = heroClumps.filter((c) => c.v === vi);
  const im = new THREE.InstancedMesh(g, clumpMat, list.length);
  im.castShadow = im.receiveShadow = true; scene.add(im);
  return { im, list };
});
const heroStraw = Array.from({ length: 5200 }, () => {
  const x = rr(-FW / 2 + 0.3, FW / 2 - 0.3), z = rr(-FD / 2 + 0.3, FD / 2 - 0.3);
  return { x, z, u: (x + FW / 2) / FW, vv: ((z + FD / 2) / FD) * 1024, ry: rr(-0.5, 0.5) + (rnd() > 0.5 ? 0 : Math.PI / 2) * 0.3, s: rr(0.6, 1.3), tilt: rr(-0.12, 0.12) };
});
const strawIM = new THREE.InstancedMesh(strawGeo, strawMat, heroStraw.length);
strawIM.receiveShadow = true; scene.add(strawIM);
function updateHeroTufts(p) {
  const gone = (u, v) => burning(u, p) && v > vTop(u, p) && v < vFront(u, p) + 2;
  for (const { im, list } of heroClumpIMs) {
    list.forEach((c, k) => {
      dummy.position.set(c.x, 0.3, c.z); dummy.rotation.set(0, c.ry, 0);
      dummy.scale.setScalar(gone(c.u, c.vv) ? 0.0001 : c.s); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  }
  heroStraw.forEach((st, k) => {
    dummy.position.set(st.x, 0.315, st.z); dummy.rotation.set(0, st.ry, st.tilt);
    dummy.scale.setScalar(gone(st.u, st.vv) ? 0.0001 : st.s); dummy.updateMatrix(); strawIM.setMatrixAt(k, dummy.matrix);
  });
  strawIM.instanceMatrix.needsUpdate = true;
}

/* ================= road, canal, trees, hut, tank, village, tractor ================= */
{
  const road = new THREE.Mesh(new RoundedBoxGeometry(400, 0.5, 5.5, 2, 0.2), mat("#9a6450"));
  road.position.set(0, 0.2, 0.5 * (FD + GAP)); road.receiveShadow = true; scene.add(road);
  const canal = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 400), new THREE.MeshStandardMaterial({ color: "#3a3a8a", emissive: "#ff7aa8", emissiveIntensity: 0.12, roughness: 0.75 }));
  canal.position.set(-1.5 * (FW + GAP) - 1.5, 0.2, -40); scene.add(canal);
}
function roundTree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 4 * s, 8), mat(C.trunk)); trunk.position.y = 2 * s; g.add(trunk);
  const cm = mat(C.canopy[Math.floor(rnd() * C.canopy.length)], { roughness: 0.95 });
  const n = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(rr(1.4, 2.3) * s, 20, 14), cm);
    p.position.set(rr(-1.6, 1.6) * s, 4.6 * s + rr(-0.5, 2.0) * s, rr(-1.6, 1.6) * s); g.add(p);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.position.set(x, 0.3, z); scene.add(g);
}
function poplar(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 3 * s, 8), mat(C.trunk)); trunk.position.y = 1.5 * s;
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(1.25 * s, 7 * s, 8, 16), mat(C.poplar, { roughness: 0.95 })); c.position.y = 7 * s;
  g.add(trunk, c);
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.position.set(x, 0.3, z); scene.add(g);
}
const canalX = -1.5 * (FW + GAP) - 1.5;
for (let z = -170; z < 80; z += 6.5) { if (rnd() > 0.35) poplar(canalX - 4 + rr(-0.6, 0.6), z + rr(-1, 1), rr(0.9, 1.25)); else roundTree(canalX + 4 + rr(-0.5, 0.5), z, rr(0.8, 1.1)); }
for (let x = -160; x < 160; x += 7) if (rnd() > 0.25) (rnd() > 0.5 ? poplar : roundTree)(x + rr(-2, 2), -5 * (FD + GAP) - 13 + rr(-1, 1), rr(0.9, 1.3));
for (let x = -40; x < 170; x += 9) if (rnd() > 0.4) roundTree(x + rr(-2, 2), 3 * (FD + GAP) + FD / 2 + 10 + rr(-1, 2), rr(0.8, 1.1));

function hut(x, z, ry = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(5, 3.6, 4, 3, 0.35), mat(C.brick)); body.position.y = 1.8;
  const roof = new THREE.Mesh(new RoundedBoxGeometry(5.8, 0.5, 4.8, 3, 0.2), mat("#e8d6c8")); roof.position.y = 3.8;
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.3, 2.2, 0.2, 2, 0.1), mat("#2f6b8a")); door.position.set(-1, 1.2, 2.02);
  const win = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.15, 2, 0.08), glow("#ffc46b")); win.position.set(1.2, 2.2, 2.03);
  const bulb = new THREE.PointLight("#ffb86b", 25, 14, 1.8); bulb.position.set(1.2, 2.4, 3.2);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 10), mat("#7d8a9a")); pipe.rotation.x = Math.PI / 2; pipe.position.set(2.3, 0.9, 2.6);
  const pool = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.5, 2.2, 2, 0.2), new THREE.MeshStandardMaterial({ color: "#3a3a8a", emissive: "#ff8fb8", emissiveIntensity: 0.3, roughness: 0.1 })); pool.position.set(2.6, 0.2, 4.2);
  g.add(body, roof, door, win, bulb, pipe, pool);
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.position.set(x, 0.3, z); g.rotation.y = ry; scene.add(g);
  return bulb;
}
function tank(x, z) {
  const g = new THREE.Group(); const lm = mat("#c9c2d6");
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 14, 8), lm); l.position.set(dx, 7, dz); g.add(l); }
  const t = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 4, 24), mat("#e8e0f0")); t.position.y = 16;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#e8e0f0")); cap.position.y = 18;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), glow("#ff4060")); beacon.position.y = 21.6;
  g.add(t, cap, beacon); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, 0.3, z); scene.add(g);
}
const hutBulb = hut(-24, 19, 0.35);
function village(x0, z0) {
  for (let i = 0; i < 14; i++) {
    const w = rr(4, 8), h = rr(3, 7), d = rr(4, 7);
    const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.3), mat(["#d9b8a8", "#c2583f", "#e8d6c8", "#b88aa0"][Math.floor(rnd() * 4)]));
    const x = x0 + rr(-22, 22), z = z0 + rr(-10, 10);
    b.position.set(x, h / 2, z); b.castShadow = b.receiveShadow = true; scene.add(b);
    for (let k = 0; k < 2; k++) if (rnd() > 0.35) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glow(rnd() > 0.3 ? "#ffcf7a" : "#9ee7ff")); wn.position.set(x + rr(-w / 3, w / 3), rr(1.2, h - 1), z + d / 2 + 0.02); scene.add(wn); }
  }
  tank(x0 + 26, z0 - 4);
}
village(70, -5 * (FD + GAP) - 30);
village(-120, -5 * (FD + GAP) - 40);
function tractor(x, z, ry) {
  const g = new THREE.Group(); const red = mat("#e2453c", { roughness: 0.55 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(5.2, 1.8, 2.4, 3, 0.45), red); body.position.set(0.6, 2.2, 0);
  const hood = new THREE.Mesh(new RoundedBoxGeometry(3, 1.5, 2.0, 3, 0.4), red); hood.position.set(2.2, 3.4, 0);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.6, 2.6, 3, 0.3), mat("#3a2f4a", { roughness: 0.4 })); cab.position.set(-0.9, 4.2, 0);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(3, 0.35, 3, 2, 0.15), mat("#f2e6d8")); roof.position.set(-0.9, 5.65, 0);
  const tire = mat("#241c2a", { roughness: 0.9 }), hub = mat("#ffcf5a");
  for (const s of [-1, 1]) {
    const bw = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 1.1, 28), tire); bw.rotation.x = Math.PI / 2; bw.position.set(-1.2, 1.8, s * 1.75);
    const bh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.15, 20), hub); bh.rotation.x = Math.PI / 2; bh.position.copy(bw.position);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.7, 24), tire); fw.rotation.x = Math.PI / 2; fw.position.set(2.9, 0.95, s * 1.35);
    const fh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.75, 16), hub); fh.rotation.x = Math.PI / 2; fh.position.copy(fw.position);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), glow("#fff1c2")); lamp.position.set(3.75, 3.3, s * 0.65);
    g.add(bw, bh, fw, fh, lamp);
  }
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 10), mat("#5a5266", { metalness: 0.4, roughness: 0.4 })); pipe.position.set(2.6, 4.8, 0.6);
  const head = new THREE.SpotLight("#fff0c8", 120, 40, 0.5, 0.6, 1.5); head.position.set(3.8, 3.3, 0); head.target.position.set(14, 0, 0);
  g.add(body, hood, cab, roof, pipe, head, head.target);
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.position.set(x, 0.35, z); g.rotation.y = ry; scene.add(g);
  return head;
}
const headLamp = tractor(25, 13.4, Math.PI - 0.12);

/* ================= lumpy smoke (instanced, irregular blobs) ================= */
function lumpGeo(r, s) {
  let g = new THREE.IcosahedronGeometry(1, 4);
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g);
  const a = [rr(0, 9), rr(0, 9), rr(0, 9), rr(0, 9), rr(0, 9), rr(0, 9)];
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n =
      0.2 * (Math.sin(2.3 * v.x + a[0]) * Math.sin(2.1 * v.y + a[1]) + Math.sin(2.7 * v.z + a[2])) +
      0.09 * Math.sin(4.3 * v.x + 3.6 * v.y + a[3]) * Math.sin(3.9 * v.z + a[4]) +
      0.025 * Math.sin(7.1 * v.y + 6.3 * v.z + a[5]);
    v.multiplyScalar(r * (1 + n)); v.y *= 0.88;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const LUMPS = Array.from({ length: 8 }, (_, i) => lumpGeo(1, i));
const smokeMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#5c2a42", emissiveIntensity: 0.55 });
const puffs = []; // {lump, base:Vector3, r, rot, color, plume}
const plumes = [];
function addPlume({ u, x0, z0, scale = 1, count = 80, ceiling = 26, startP = 0, distant = false }) {
  const id = plumes.length;
  plumes.push({ u, startP, distant, src: new THREE.Vector3(x0, 0.6, z0) });
  const base = new THREE.Color("#e8d3d6"), top = new THREE.Color("#a5909c"), warmC = new THREE.Color("#ffb08a");
  for (let i = 0; i < count; i++) {
    const t = Math.pow(i / count, 0.9);
    let y = t * ceiling, dx = t * 13 + t * t * 6, dz = -t * 6, r = (1.2 + t * 3.6) * rr(0.65, 1.3);
    if (t > 0.82) { const s = (t - 0.82) / 0.18; y = ceiling + rr(-2.5, 1.5); dx = 18 + s * 18 + rr(-5, 5); dz = -5 - s * 6 + rr(-5, 5); r = (3.0 + rr(0, 2.4)) * (1 - s * 0.35); }
    const j = (0.9 + t * 2.4) * scale;
    const warm = Math.max(0, 1 - t * 2.2);
    const col = base.clone().lerp(top, Math.min(1, t * 1.2)).lerp(warmC, warm * 0.55);
    // each puff is a cluster of 2–4 irregular lumps
    const nSub = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < nSub; k++) {
      const off = new THREE.Vector3(rr(-0.7, 0.7), rr(-0.5, 0.6), rr(-0.7, 0.7)).multiplyScalar(r * scale);
      puffs.push({
        lump: Math.floor(rnd() * LUMPS.length),
        base: new THREE.Vector3(x0 + dx * scale + rr(-1.2, 1.2) * j, 0.8 + y * scale, z0 + dz * scale + rr(-1.2, 1.2) * j).add(off),
        r: r * scale * rr(0.55, 0.95) * (k === 0 ? 1.15 : 1),
        rot: new THREE.Euler(rr(0, 6), rr(0, 6), rr(0, 6)),
        color: col.clone().multiplyScalar(rr(0.92, 1.06)),
        along: t,
        plume: id,
      });
    }
  }
}
// hero plumes: they start when the spreading fire reaches their column
const spreadReach = (u) => clamp((Math.abs(u - U0) - 0.015) / 0.62);
for (const [u, sc, n, ce] of [[0.58, 1.15, 150, 26], [0.22, 0.8, 95, 22], [0.88, 0.7, 80, 20]]) addPlume({ u, x0: uToX(u), z0: vToZ(frontV(u)) - 1.2, scale: sc, count: n, ceiling: ce, startP: spreadReach(u) });

/* ================= flames: soft rounded teardrops ================= */
const flameGeo = (() => {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const y = i / 16; pts.push(new THREE.Vector2(0.5 * Math.sin(Math.PI * Math.pow(y, 0.55)) * Math.pow(1 - y, 0.45), y)); }
  return new THREE.LatheGeometry(pts, 14);
})();
const fm = (hex, k, extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false, ...extra });
const flameOuter = fm("#ff5a1f", 1.5, { transparent: true, opacity: 0.92, depthWrite: false }), flameMid = fm("#ff9a2e", 1.8), flameCore = fm("#ffe27a", 2.2);
const LAYERS = [[flameOuter, 1, 1, 0], [flameMid, 0.68, 0.72, 0.04], [flameCore, 0.4, 0.45, 0.08]]; // material, width, height, forward offset
const flames = [];
for (let k = 0; k < 260; k++) {
  const u = rr(0.015, 0.985);
  const big = Math.sin(u * 23 + 1) ** 2;
  flames.push({ u, h: rr(0.75, 1.7) * (0.8 + 0.9 * big), w: rr(0.28, 0.48), dz: rr(-0.55, 0.25), jx: rr(-0.12, 0.12), lean: -rr(0.18, 0.4), ph: rr(0, 6.28), sp: rr(0.8, 1.2) });
}
const flameIMs = LAYERS.map(([m]) => { const im = new THREE.InstancedMesh(flameGeo, m, flames.length); im.frustumCulled = false; scene.add(im); return im; });
function updateFlames(p, time) {
  const w = spreadW(p);
  flames.forEach((fl, k) => {
    const du = Math.abs(fl.u - U0);
    const on = p > 0 && du < w ? sstep(w, w * 0.75, du) * Math.min(1, p * 8) : 0;
    const z = vToZ(vFront(fl.u, Math.max(p, 0.0001))) + fl.dz;
    // slow, layered flicker (smooth from frame to frame)
    const f1 = Math.sin(time * 4.2 * fl.sp + fl.ph), f2 = Math.sin(time * 7.3 * fl.sp + fl.ph * 1.7);
    const hk = 0.86 + 0.1 * f1 + 0.05 * f2, sway = 0.08 * Math.sin(time * 3.1 + fl.ph);
    LAYERS.forEach(([, ws, hs, fwd], li) => {
      dummy.position.set(uToX(fl.u) + fl.jx, 0.3, z + fwd);
      dummy.rotation.set(0, 0, fl.lean + sway);
      const H = Math.max(0.0001, fl.h * hs * hk * on);
      if (on <= 0.001) dummy.scale.setScalar(0.00001);
      else dummy.scale.set(fl.w * ws * (0.92 + 0.08 * f2), H, fl.w * ws);
      dummy.updateMatrix();
      flameIMs[li].setMatrixAt(k, dummy.matrix);
    });
  });
  flameIMs.forEach((im) => (im.instanceMatrix.needsUpdate = true));
}
const fireLights = Array.from({ length: 6 }, (_, k) => { const l = new THREE.PointLight("#ff7a2a", 0, 30, 1.6); scene.add(l); return { l, u: (k + 0.5) / 6 }; });

/* distant fires (always burning; revealed as the world fades in) */
for (const f of fieldsMeta) {
  if (f.kind === "burnt" && f.cz < -20 && Math.abs(f.cx) < 150 && rnd() > 0.45) {
    const x = f.cx + rr(-6, 6), z = f.cz + rr(-3, 3), s = rr(0.55, 0.85);
    for (let k = 0; k < 18; k++) { const m = new THREE.Mesh(flameGeo, k % 2 ? flameOuter : flameMid); m.scale.set(0.7, rr(1.0, 2.2), 0.7); m.position.set(x + k * 0.9 - 8, 0.3, z + Math.sin(k) * 0.6); scene.add(m); }
    const l = new THREE.PointLight("#ff6a2a", 40, 22, 1.6); l.position.set(x, 2, z + 1); scene.add(l);
    addPlume({ u: -1, x0: x, z0: z - 1, scale: s, count: 45, ceiling: 24, startP: -1, distant: true });
  }
}
// build instanced meshes for smoke, one per lump variant
const smokeIMs = LUMPS.map((g, li) => {
  const list = puffs.filter((p) => p.lump === li);
  const im = new THREE.InstancedMesh(g, smokeMat, list.length);
  list.forEach((p, k) => im.setColorAt(k, p.color));
  im.castShadow = true;
  scene.add(im);
  return { im, list };
});
const q = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4();
function updateSmoke(p, time) {
  for (const { im, list } of smokeIMs) {
    list.forEach((pf, k) => {
      const pl = plumes[pf.plume];
      let grow = 1;
      if (!pl.distant) {
        const age = clamp((p - pl.startP) / Math.max(0.05, 1 - pl.startP));
        grow = clamp((Math.pow(age, 1.4) * 1.3 - pf.along * 0.85) / 0.3);
        grow = 1 - Math.pow(1 - grow, 3);
      }
      const drift = pf.along * 0.6 * Math.sin(time * 0.6 + pf.along * 5);
      const rise = Math.pow(grow, 0.55); // puffs leave the fire and rise into place
      const pos = pl.src.clone().lerp(pf.base, rise);
      sc.setScalar(Math.max(0.0001, pf.r * (0.25 + 0.75 * grow) * (grow > 0 ? 1 : 0)));
      q.setFromEuler(pf.rot);
      m4.compose(new THREE.Vector3(pos.x + drift, pos.y, pos.z), q, sc);
      im.setMatrixAt(k, m4);
    });
    im.instanceMatrix.needsUpdate = true;
  }
}

/* round soft sprite for all particles */
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.85)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
/* ================= embers above the fire ================= */
const EMB = 900;
const emberData = Array.from({ length: EMB }, () => ({ u: rr(0.02, 0.98), ph: rnd(), sp: rr(0.6, 1.4), jx: rr(-1.5, 1.5), jz: rr(-1.5, 1.5), c: new THREE.Color("#ffab4a").multiplyScalar(rr(1.5, 2.6)) }));
const emberGeo = new THREE.BufferGeometry();
emberGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(EMB * 3), 3));
emberGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(EMB * 3), 3));
const emberPts = new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.5, map: dotTex, vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
emberPts.frustumCulled = false; scene.add(emberPts);
function updateEmbers(p, time) {
  emberPts.visible = p > 0;
  const pos = emberGeo.attributes.position, col = emberGeo.attributes.color;
  emberData.forEach((e, i) => {
    const on = burning(e.u, p) ? Math.min(1, p * 4) : 0;
    const y = ((e.ph + time * 0.12 * e.sp) % 1) ** 1.6 * 22;
    const fz = vToZ(vFront(e.u, Math.max(p, 0.001)));
    pos.setXYZ(i, uToX(e.u) + y * 0.55 + e.jx, 0.6 + y, fz - y * 0.25 + e.jz);
    const fade = on * (1 - y / 26);
    col.setXYZ(i, e.c.r * fade, e.c.g * fade, e.c.b * fade);
  });
  pos.needsUpdate = col.needsUpdate = true;
}

/* ================= the ember / spark (Scene 0) ================= */
const EMBER_POS = IGN.clone().add(new THREE.Vector3(0, 8, 0));
const emberCoreMat = new THREE.MeshBasicMaterial({ color: "#e8743a", fog: false });
const emberCore = new THREE.Mesh(new THREE.SphereGeometry(0.07, 40, 28), emberCoreMat);
scene.add(emberCore);
const emberHalo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), new THREE.MeshBasicMaterial({ color: "#ff8a3a", transparent: true, opacity: 0.18, fog: false, depthWrite: false }));
scene.add(emberHalo);
const sparkLight = new THREE.PointLight("#ff8a3a", 0, 6, 1.6);
scene.add(sparkLight);

// burst sparks
const SP = 320;
const sparks = Array.from({ length: SP }, () => {
  const d = new THREE.Vector3(rr(-1, 1), rr(-0.6, 1), rr(-1, 1)).normalize();
  return { v: d.multiplyScalar(rr(0.6, 2.2)), life: rr(0.5, 2.2), c: new THREE.Color(rnd() > 0.3 ? "#ffb04a" : "#ffe58a").multiplyScalar(rr(2, 3.2)) };
});
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
sparkGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.05, map: dotTex, vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
sparkPts.frustumCulled = false; scene.add(sparkPts);

const SECS = 10; // nominal duration used for physics
function sparkPos(t) {
  // the hero spark: holds, then falls from EMBER_POS to IGN with a gentle wind drift
  const s = sstep(T.fall[0] - 0.02, T.fall[1], t);
  const e = s * s * (3 - 2 * s);
  const p = new THREE.Vector3().lerpVectors(EMBER_POS, IGN.clone().add(new THREE.Vector3(0, 0.08, 0)), e);
  p.x += Math.sin(s * Math.PI) * 0.9 + Math.sin(s * 9) * 0.06 * (1 - s);
  p.z += Math.sin(s * Math.PI) * -0.4;
  return p;
}
function updateEmber(t) {
  const sp = sparkPos(t);
  emberCore.position.copy(sp);
  emberHalo.position.copy(sp);
  const b = T.burst[0];
  let scale = 1, col = new THREE.Color("#e8743a"), halo = 0, haloS = 2.2;
  if (t < b) {
    scale = 1 + 0.05 * Math.sin(t * SECS * 2 * Math.PI * 0.8);
  } else {
    const k = (t - b) / 0.03; // flash
    if (k < 1) { scale = 1 + 0.7 * Math.sin(k * Math.PI); col = new THREE.Color("#ffd27a").multiplyScalar(1 + 2 * Math.sin(k * Math.PI)); halo = 0.12 * Math.sin(k * Math.PI); haloS = 2.5 + 4 * k; }
    else {
      // shrinks into a small, hot, glowing spark
      const k2 = clamp((t - b - 0.03) / 0.06);
      scale = lerp(1, 0.42, k2);
      col = new THREE.Color("#e8743a").lerp(new THREE.Color("#ff9a3a").multiplyScalar(2.4), k2);
      halo = 0; haloS = 3;
      // fade the spark into the fire once it has caught
      const out = sstep(0.56, 0.64, t);
      scale *= 1 - out * 0.999;
      halo *= 1 - out;
    }
  }
  emberCore.scale.setScalar(scale);
  emberCoreMat.color.copy(col);
  emberCoreMat.toneMapped = t < b;
  emberHalo.scale.setScalar(scale * haloS);
  emberHalo.material.opacity = halo;
  sparkLight.position.copy(sp).add(new THREE.Vector3(0, 0.15, 0));
  sparkLight.intensity = t < b ? 0 : (1 - sstep(0.58, 0.66, t)) * lerp(0.6, 2.2, sstep(0.3, 0.5, t));

  // burst particles
  const pos = sparkGeo.attributes.position, c = sparkGeo.attributes.color;
  const tau = Math.max(0, (t - b) * SECS);
  sparks.forEach((s, i) => {
    if (t < b) { pos.setXYZ(i, 0, -999, 0); c.setXYZ(i, 0, 0, 0); return; }
    const k = 1.6, dr = (1 - Math.exp(-k * tau)) / k;
    pos.setXYZ(i, EMBER_POS.x + s.v.x * dr + 0.25 * tau, EMBER_POS.y + s.v.y * dr - 0.35 * tau * tau, EMBER_POS.z + s.v.z * dr);
    const f = clamp(1 - tau / s.life) ** 1.5;
    c.setXYZ(i, s.c.r * f, s.c.g * f, s.c.b * f);
  });
  pos.needsUpdate = c.needsUpdate = true;
}

/* ================= camera path ================= */
const camera = new THREE.PerspectiveCamera(36, W / H, 0.01, 2000);
const FINAL_TARGET = new THREE.Vector3(-6, 10, -20);
const FINAL_POS = new THREE.Vector3(50, 24, 64);
const FINAL_OFF = FINAL_POS.clone().sub(FINAL_TARGET);
const D0 = new THREE.Vector3(FINAL_OFF.x, 0, FINAL_OFF.z).normalize(); // same heading as the final shot
// offset keyframes: [t, direction, distance]
const OFFK = [
  [0.0, D0.clone(), 2.1],
  [0.12, D0.clone(), 1.9],
  [0.22, D0.clone().add(new THREE.Vector3(0, 0.12, 0)).normalize(), 3.4],
  [0.48, D0.clone().add(new THREE.Vector3(0, 1.0, 0)).normalize(), 5.2],
  [0.6, new THREE.Vector3(-0.2, 1.25, 0.85).normalize(), 9],
  [0.78, new THREE.Vector3(-0.45, 0.85, 0.45).normalize(), 36],
  [0.96, FINAL_OFF.clone().normalize(), FINAL_OFF.length()],
  [1.0, FINAL_OFF.clone().normalize(), FINAL_OFF.length()],
];
// cubic Hermite through keyframes; tangents from neighbours (Catmull-Rom style), zero where marked "hold"
function hermite(keys, t) { // keys: [{t, v:[...], hold?}]
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v.slice();
  let i = 0; while (t > keys[i + 1].t) i++;
  const tan = (j) => {
    if (keys[j].hold || j === 0 || j === keys.length - 1) return keys[j].v.map(() => 0);
    const a = keys[j - 1], c = keys[j + 1];
    return keys[j].v.map((_, d) => (c.v[d] - a.v[d]) / (c.t - a.t));
  };
  const k0 = keys[i], k1 = keys[i + 1], h = k1.t - k0.t, s = (t - k0.t) / h;
  const m0 = tan(i), m1 = tan(i + 1);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return k0.v.map((_, d) => h00 * k0.v[d] + h10 * h * m0[d] + h01 * k1.v[d] + h11 * h * m1[d]);
}
const OFF_KEYS = OFFK.map(([t, d, l], i) => ({ t, v: [d.x, d.y, d.z, Math.log(l)], hold: i === 0 || t === 0.96 || t === 1.0 || t === 0.48 }));
function offsetAt(t) {
  const [x, y, z, ll] = hermite(OFF_KEYS, t);
  return new THREE.Vector3(x, y, z).normalize().multiplyScalar(Math.exp(ll));
}
let TGT_KEYS = null;
function targetAt(t) {
  if (t <= T.landing[0]) return sparkPos(t); // ember holds still, then the spark eases down (zero speed at both ends)
  if (!TGT_KEYS) {
    const v = (p) => [p.x, p.y, p.z];
    TGT_KEYS = [
      { t: T.landing[0], v: v(sparkPos(T.landing[0])), hold: true },
      { t: T.pullBack[0], v: v(IGN.clone().add(new THREE.Vector3(0, 0.25, 0))) },
      { t: 0.78, v: [-1, 2, -6] },
      { t: 0.96, v: v(FINAL_TARGET), hold: true },
      { t: 1.0, v: v(FINAL_TARGET), hold: true },
    ];
  }
  const [x, y, z] = hermite(TGT_KEYS, t);
  return new THREE.Vector3(x, y, z);
}

/* ================= world fade-in, fire progress ================= */
const worldF = (t) => sstep(0.26, 0.9, t);
const fireP = (t) => clamp((t - 0.52) / 0.43) ** 1.35;

function applyWorld(t) {
  const wf = worldF(t);
  hemi.intensity = BASE_LIGHT.hemi * wf;
  sunset.intensity = BASE_LIGHT.sunset * wf;
  rim.intensity = BASE_LIGHT.rim * wf;
  hutBulb.intensity = 25 * wf;
  headLamp.intensity = 120 * wf;
  scene.fog.color.copy(DARK).lerp(FOGC, wf);
  scene.fog.near = lerp(1.5, 70, wf ** 1.3);
  scene.fog.far = lerp(4, 320, wf ** 1.3);
  skyU.wf.value = wf;
  starMat.opacity = 0.7 * wf;
}

/* ================= post ================= */
const composer = new EffectComposer(renderer);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
if (!P.get("nobloom")) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.9));
composer.addPass(new OutputPass());
const gradeU = { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W, H) }, seed: { value: 0 } };
composer.addPass(new ShaderPass({
  uniforms: gradeU,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float seed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p + seed, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.299,.587,.114));
      c = mix(c + vec3(.035,.0,.05)*(1.-l), c, l);
      float v = smoothstep(1.15, .35, length(vUv-.5)*1.25);
      c *= mix(.62, 1., v);
      c += (h(vUv*res) - .5) * .045;
      gl_FragColor = vec4(c,1.);
    }`,
}));

/* ================= render a moment ================= */
let lastP = -1;
window.renderAt = (t) => {
  t = clamp(t);
  const time = t * SECS;
  const p = fireP(t);
  applyWorld(t);
  updateEmber(t);
  if (Math.abs(p - lastP) > 1e-4 || lastP < 0) { drawHero(p); updateHeroTufts(p); lastP = p; }
  updateFlames(p, time);
  const w = spreadW(p);
  for (const fl of fireLights) {
    const du = Math.abs(fl.u - U0);
    const uu = du < w ? fl.u : U0 + Math.sign(fl.u - U0) * Math.min(du, w);
    fl.l.position.set(uToX(uu), 2.2, vToZ(vFront(uu, Math.max(p, 0.0001))) + 1.5);
    fl.l.intensity = 70 * Math.pow(p, 0.9) * (du < w + 0.08 ? 1 : 0.25);
  }
  updateSmoke(p, time);
  updateEmbers(p, time);
  // camera
  const tgt = targetAt(t);
  camera.position.copy(tgt).add(offsetAt(t));
  camera.lookAt(tgt);
  camera.updateMatrixWorld();
  gradeU.seed.value = (t * 977) % 97;
  composer.render();
};
window.__dbg = { scene, THREE };
window.__ready = true;
