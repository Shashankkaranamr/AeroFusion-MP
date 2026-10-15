import * as THREE from 'three';
import { createAdaptiveQuality } from '../../core/adaptive.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DIVE_WIPE } from './diveWipe.js';
import { story } from '../../data/story.js';
import { pathAt, nightAtMinutes, smooth, clamp01, STEP } from './timing.js';
import {
  SKY_VERT, SKY_FRAG, STREAK_VERT, STREAK_FRAG, GLOW_VERT, GLOW_FRAG, DOME_VERT, DOME_FRAG,
} from './shaders.js';

/**
 * SCENE 3 WORLD — the ride from the fire to the city, drawn live with Three.js.
 *
 * Same look as the Scene 2 render (assets/scene2/render/anim.js): toy-like rounded shapes,
 * violet dusk fog, a warm low "sunset" key, a cool rim, ACES tone mapping and bloom; the page's
 * own grain and vignette sit on top.
 *
 * World units are kilometres (x east, z south, y up), projected from real lat/lon, so the path,
 * cities and distances are true; only heights and buildings are exaggerated, like a diorama.
 *
 * Everything on screen is a function of p (scroll progress, see ./timing.js) — except things
 * that should feel alive while the reader pauses: the wind, the flowing river of light, fire
 * flicker. Those run on real time.
 */

const ALT = 1.8; // the particle's height: the ceiling it was trapped under (km)
const rand = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const rr = (a, b) => a + (b - a) * rand();
const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

/* ------------------------------------------------------------ projection -- */
const LAT0 = 29.45;
const LON0 = 76.5;
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const KZ = 110.57;
const toXZ = (lat, lon, y = 0) => new THREE.Vector3((lon - LON0) * KX, y, -(lat - LAT0) * KZ);

const COL = {
  ground: '#2a2033',
  gaps: '#160f1c',
  fields: ['#3a2b3a', '#2f2a3d', '#43303a', '#2a3340', '#3d3442', '#4a3936', '#24302d', '#352a45'],
  river: '#4f6fa8',
  road: '#8a6a7c',
  canopy: ['#2f9a7e', '#3fae84', '#2b8a98', '#5aa972', '#f0a24a', '#e0784a'],
  building: ['#c2583f', '#d9a066', '#e8d3c0', '#7a8fb0', '#b07aa0', '#5aa9a0', '#f0c27a', '#9a6a8a'],
  ember: '#ff8a3d',
  emberHot: '#ffc27a',
  lamp: '#ffcf8a',
  haze: '#5e3d27',
  hazeLit: '#b06a3a',
  wind: '#aebdff',
  smokeLow: '#e8d3d6',
  smokeHigh: '#a5909c',
  smokeFar: '#8a7690',
  burnt: '#2a1c26',
  stubble: '#8a6a3a',
};
const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const hot = lin('#ffc27a');
const ember = lin('#ff8a3d');
const Y0 = new THREE.Vector3(0, 1, 0);

export function createWorld({ canvas, labels }) {
  const mobile = () => window.innerWidth < 640;

  /* -------------------------------------------------------------- renderer -- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 1200);
  scene.fog = new THREE.Fog(new THREE.Color('#6a3264'), 30, 160);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // The farm-to-orbit transition's own radial "dive" wipe: we arrive under it, at full cover.
  const wipe = new ShaderPass(DIVE_WIPE);
  wipe.enabled = false;
  composer.addPass(wipe);

  /* -------------------------------------------------------------- the path -- */
  const cities = story.path.map(([name, la, lo]) => ({ name, pos: toXZ(la, lo) }));
  const dest = cities[cities.length - 1];
  const pts = cities.map((c) => c.pos.clone().setY(ALT));
  // Hold the ceiling until close to the city, then plunge into its dome.
  const last = pts.pop();
  pts.push(pts[pts.length - 1].clone().lerp(last, 0.72));
  pts.push(last.clone().setY(0.25));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const L = curve.getLength();
  const N = 3000;
  const P = curve.getSpacedPoints(N);
  const Tn = P.map((_, i) => curve.getTangentAt(i / N));
  const sample = (s, out = new THREE.Vector3()) => {
    const f = clamp01(s) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return out.copy(P[i]).lerp(P[i + 1], f - i);
  };
  const tangent = (s, out = new THREE.Vector3()) => out.copy(Tn[Math.round(clamp01(s) * N)]);
  // Where each city sits along the path (nearest sample).
  cities.forEach((c) => {
    let best = 0;
    let bd = Infinity;
    P.forEach((q, i) => { const d = (q.x - c.pos.x) ** 2 + (q.z - c.pos.z) ** 2; if (d < bd) { bd = d; best = i; } });
    c.s = best / N;
  });

  /* ------------------------------------------------------------------- sky -- */
  const skyU = {
    uHorizon: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uTop: { value: new THREE.Color() },
    uSun: { value: lin('#ff6b52') }, uGlowCol: { value: lin('#b8703f', 1.1) },
    uSunDir: { value: new THREE.Vector3(-0.6, 0, -1).normalize() }, uGlowDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunAmt: { value: 1 }, uGlowAmt: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG }),
  );
  scene.add(sky);
  const SKY_DUSK = { h: lin('#6a3264'), m: lin('#2a0f3c'), t: lin('#0a0820') };
  const SKY_NIGHT = { h: lin('#24132e'), m: lin('#0c0818'), t: lin('#04030b') };

  /* ---------------------------------------------------------------- lights -- */
  const hemi = new THREE.HemisphereLight('#a07cff', '#6a2e3e', 1.25);
  const sunset = new THREE.DirectionalLight('#ff9c8c', 1.6);
  sunset.position.set(-90, 45, -110);
  const rim = new THREE.DirectionalLight('#6fd6ff', 0.35);
  rim.position.set(80, 30, 60);
  scene.add(hemi, sunset, rim);

  /* ---------------------------------------------------------------- ground -- */
  // Field patchwork, repeating: the plains read as a quilt of plots from 2 km up.
  function patchwork() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const x = cv.getContext('2d');
    x.fillStyle = COL.gaps;
    x.fillRect(0, 0, 512, 512);
    for (let gy = 0; gy < 512;) {
      const h = rr(26, 64);
      for (let gx = 0; gx < 512;) {
        const w = rr(24, 70);
        x.fillStyle = COL.fields[Math.floor(rand() * COL.fields.length)];
        x.fillRect(gx + 1.5, gy + 1.5, w - 3, h - 3);
        gx += w;
      }
      gy += h;
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const SIZE = 900;
  const fieldTex = patchwork();
  fieldTex.repeat.set(SIZE / 7, SIZE / 7);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 1, metalness: 0 }),
  );
  scene.add(ground);

  // Map overlay: the Yamuna, the Sutlej, canals, the old highway — faint, like a night map.
  {
    const M = 2048;
    const span = 600; // km covered
    const cv = document.createElement('canvas');
    cv.width = cv.height = M;
    const x = cv.getContext('2d');
    const px = (v) => toXZ(v[0], v[1]);
    const toPx = (p) => [((p.x + span / 2) / span) * M, ((p.z + span / 2) / span) * M];
    const line = (coords, color, width) => {
      x.strokeStyle = color;
      x.lineWidth = width;
      x.lineCap = x.lineJoin = 'round';
      x.beginPath();
      coords.forEach((c, i) => { const [a, b] = toPx(px(c)); i ? x.lineTo(a, b) : x.moveTo(a, b); });
      x.stroke();
    };
    const yamuna = [[30.55, 77.6], [30.2, 77.35], [29.95, 77.18], [29.6, 77.12], [29.3, 77.1], [29.0, 77.15], [28.75, 77.24], [28.6, 77.27], [28.4, 77.36], [28.1, 77.5]];
    const sutlej = [[31.25, 75.6], [31.05, 75.3], [30.95, 74.95], [30.95, 74.6]];
    const ghaggar = [[30.7, 76.9], [30.35, 76.55], [30.0, 76.15], [29.75, 75.7], [29.55, 75.1]];
    [yamuna, sutlej, ghaggar].forEach((r) => { line(r, 'rgba(79,111,168,0.1)', 5); line(r, 'rgba(120,160,220,0.3)', 1.4); });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span).rotateX(-Math.PI / 2),
      // Lit like the ground, so the rivers go dark with the night instead of glowing.
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 }),
    );
    overlay.position.y = 0.01;
    scene.add(overlay);
  }

  /* ----------------------------------------------------------------- trees -- */
  // Cotton-ball clumps along the corridor, like the Scene 2 tree lines.
  {
    const n = mobile() ? 2600 : 5200;
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.85 }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    const side = new THREE.Vector3();
    for (let i = 0; i < n;) {
      const s = rand();
      sample(s, v);
      tangent(s, side).cross(new THREE.Vector3(0, 1, 0)).normalize();
      const base = v.clone().addScaledVector(side, rr(-34, 34));
      base.x += rr(-3, 3);
      const k = Math.floor(rr(4, 12));
      const warm = rand() < 0.18; // most lines teal-green, a few warm, like the Scene 2 render
      for (let j = 0; j < k && i < n; j++, i++) {
        const r = rr(0.05, 0.12);
        m.compose(new THREE.Vector3(base.x + rr(-0.35, 0.35), r * 0.9, base.z + rr(-0.35, 0.35)), q, new THREE.Vector3(r, r * rr(1, 1.4), r));
        mesh.setMatrixAt(i, m);
        const pal = warm ? COL.canopy.slice(4) : COL.canopy.slice(0, 4);
        mesh.setColorAt(i, c.set(pal[Math.floor(rand() * pal.length)]).multiplyScalar(0.45));
      }
    }
    scene.add(mesh);
  }

  /* ---------------------------------------------------------------- cities -- */
  const allCities = [
    // Sangrur's houses sit a little downwind of the burning field, which is out in the farmland.
    ...cities.map((c, i) => ({ ...c, pos: i === 0 ? c.pos.clone().add(new THREE.Vector3(1.9, 0, 1.9)) : c.pos, size: i === cities.length - 1 ? 14 : i === 0 ? 2.5 : 3.5, count: i === cities.length - 1 ? 1800 : 220, kind: i === cities.length - 1 ? 'dest' : 'path' })),
    ...story.neighbours.map(([name, la, lo]) => ({ name, pos: toXZ(la, lo), size: 6, count: 420, kind: 'neighbour' })),
  ];
  const lightPts = [];
  {
    const total = allCities.reduce((a, c) => a + c.count, 0);
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), total);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    let i = 0;
    for (const city of allCities) {
      for (let k = 0; k < city.count; k++, i++) {
        const r = city.size * Math.sqrt(-2 * Math.log(1 - rand() * 0.95)) * 0.45; // dense centre, thinning out
        const a = rand() * Math.PI * 2;
        const near = 1 - Math.min(1, r / city.size);
        const h = rr(0.04, 0.14) + near * near * rr(0, city.kind === 'dest' ? 0.7 : 0.25);
        const w = rr(0.05, 0.14);
        const x = city.pos.x + Math.cos(a) * r;
        const z = city.pos.z + Math.sin(a) * r;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rr(0, Math.PI));
        m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, w * rr(0.8, 1.4)));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.set(COL.building[Math.floor(rand() * COL.building.length)]).multiplyScalar(0.8));
        // Windows and street lamps: warm points that come on at dusk.
        const lights = 1 + Math.floor(rand() * 3);
        for (let j = 0; j < lights; j++) lightPts.push(x + rr(-0.12, 0.12), rr(0.02, h + 0.03), z + rr(-0.12, 0.12));
      }
    }
    scene.add(mesh);
  }

  /* ----------------------------------------------------------- glow points -- */
  function glowPoints(count) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, geo, mat, pos: geo.attributes.position.array, size: geo.attributes.aSize.array, col: geo.attributes.aColor.array };
  }

  // City lights.
  const cityGlow = glowPoints(lightPts.length / 3);
  cityGlow.pos.set(lightPts);
  for (let i = 0; i < cityGlow.size.length; i++) cityGlow.size[i] = rr(0.04, 0.1);
  const lampC = lin(COL.lamp, 2.2);

  /* ---------------------------------------- other fires and their trails -- */
  const UP = new THREE.Vector3(-1, 0, -1).normalize(); // upwind: the wind is from the northwest
  const ACROSS = new THREE.Vector3(1, 0, -1).normalize();
  const fires = [];
  for (let i = 0; i < 46; i++) {
    const uj = rr(0.03, 0.8);
    const J = sample(uj);
    const F = J.clone().addScaledVector(UP, rr(8, 70)).addScaledVector(ACROSS, rr(-35, 35));
    F.y = 0.05;
    const mid = F.clone().lerp(J, 0.55);
    mid.y = ALT * 1.05;
    const route = new THREE.QuadraticBezierCurve3(F, mid, J);
    const Lj = route.getLength();
    fires.push({ uj, F, route: route.getSpacedPoints(48), Lj, flicker: rr(0, 10) });
  }
  fires.sort((a, b) => a.uj - b.uj);
  // How many streams have joined by each point of the path: the river widens with it.
  const joined = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) joined[i] = fires.filter((f) => f.uj <= i / N).length;

  // Our own trail = stream 0 (starts at the fire we came from, no feeder route).
  const streams = [{ uj: 0, route: null, Lj: 0, own: true }, ...fires];
  const PER = mobile() ? 90 : 170;
  const OWN = mobile() ? 900 : 1600;
  const counts = streams.map((s) => (s.own ? OWN : PER));
  const river = glowPoints(counts.reduce((a, b) => a + b, 0));
  const seeds = new Float32Array(river.size.length * 3);
  for (let i = 0; i < river.size.length; i++) {
    seeds[i * 3] = rand();
    seeds[i * 3 + 1] = rand() - 0.5;
    seeds[i * 3 + 2] = rand() - 0.5;
    river.size[i] = rr(0.016, 0.045);
  }
  const fireGlow = glowPoints(fires.length);
  fires.forEach((f, i) => { fireGlow.pos.set([f.F.x, 0.3, f.F.z], i * 3); fireGlow.size[i] = 0.7; });

  /* ---------------------------------------------------------- our particle -- */
  const trail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 1500, 0.012, 5, false),
    new THREE.MeshBasicMaterial({ color: lin(COL.emberHot, 1.8), transparent: true, opacity: 0.85, fog: false }),
  );
  scene.add(trail);
  const TUBE_STRIDE = 5 * 6;
  const me = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), new THREE.MeshBasicMaterial({ color: lin(COL.emberHot, 2.4), fog: false }));
  scene.add(me);
  const halo = glowPoints(1);
  halo.size[0] = 0.42;

  /* -------------------------------------------------- the fire and its smoke -- */
  // Where the ride begins: the Scene 2 field, still burning, its smoke rising to the ceiling and
  // flattening under it. Clay-lump smoke in the render's colours. The particle rides up inside.
  const DOWN = new THREE.Vector3(1, 0, 1).normalize(); // downwind: southeast
  // The field is out in the farmland upwind of town; its smoke leans downwind as it climbs and
  // reaches the ceiling where the ride starts (the path's first point).
  const START = curve.getPointAt(0);
  const FIRE = START.clone().addScaledVector(DOWN, -1.1).setY(0);
  const LEAN = START.clone().sub(FIRE).setY(0);
  /** A point on the smoke column, t = 0 at the fire … 1 at the ceiling: it climbs nearly
   *  straight up, then bends over downwind as it meets the ceiling. */
  const column = (t, out) => out.copy(FIRE).addScaledVector(LEAN, t ** 3).setY(0.12 + t * (ALT - 0.12));
  {
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.2).rotateX(-Math.PI / 2).rotateY(0.5),
      new THREE.MeshStandardMaterial({ color: COL.stubble, roughness: 1, transparent: true, opacity: 0.55 }),
    );
    field.position.copy(FIRE).setY(0.008);
    const burnt = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: COL.burnt, roughness: 1 }),
    );
    burnt.position.copy(FIRE).setY(0.014);
    const light = new THREE.PointLight('#ff7a30', 5, 5, 2);
    light.position.copy(FIRE).setY(0.35);
    scene.add(field, burnt, light);
  }
  const flames = glowPoints(90);
  const flameSeed = [];
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = i < 70 ? rr(0.45, 0.62) : rr(0, 0.45); // the fire line on the rim, embers inside
    flameSeed.push([FIRE.x + Math.cos(a) * r, FIRE.z + Math.sin(a) * r, rr(0, 10), i < 70]);
    flames.size[i] = i < 70 ? rr(0.08, 0.2) : rr(0.03, 0.07);
  }
  const lumpGeo = (() => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3));
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + 0.13 * Math.sin(v.x * 4.1 + 1.3) * Math.sin(v.y * 3.7) + 0.08 * Math.sin(v.z * 6.3 + v.x * 2.1));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  })();
  const COLUMN = 48;
  const lumps = [];
  for (let i = 0; i < COLUMN; i++) lumps.push({ t: i / COLUMN, a: rr(0, Math.PI * 2), r: rr(0.65, 1.05), j: rr(0.2, 0.7) });
  for (let i = 0; i < 38; i++) lumps.push({ cap: true, d: rr(0.1, 6), x: rr(-1, 1), y: rr(-0.14, 0.06), r: rr(0.7, 1.2), ph: rr(0, 6.3) });
  const smoke = new THREE.InstancedMesh(lumpGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), lumps.length);
  smoke.frustumCulled = false;
  scene.add(smoke);
  const smokeLow = new THREE.Color(COL.smokeLow);
  const smokeHigh = new THREE.Color(COL.smokeHigh);
  const smokeFar = new THREE.Color(COL.smokeFar);
  const lm = new THREE.Matrix4();
  const lq = new THREE.Quaternion();
  const lp = new THREE.Vector3();
  const ls = new THREE.Vector3();
  const lc = new THREE.Color();
  function updateSmoke(time) {
    for (let i = 0; i < lumps.length; i++) {
      const L0 = lumps[i];
      if (!L0.cap) {
        // The column: lumps rise forever, swelling and leaning downwind as they climb.
        const t = (L0.t + time * 0.022) % 1;
        const r = (0.08 + 0.2 * t) * L0.r;
        column(t, lp);
        lp.x += Math.cos(L0.a) * r * L0.j;
        lp.z += Math.sin(L0.a) * r * L0.j;
        const grow = smooth(0, 0.08, t) * (1 - 0.35 * smooth(0.85, 1, t));
        ls.set(r, r * 0.9, r).multiplyScalar(grow);
        lc.copy(smokeLow).lerp(smokeHigh, t);
      } else {
        // The cap: spread flat under the ceiling, drifting downwind.
        const spread = 0.3 + L0.d * 0.22;
        lp.copy(START).addScaledVector(DOWN, L0.d - 0.3 + Math.sin(time * 0.15 + L0.ph) * 0.08);
        lp.addScaledVector(ACROSS, L0.x * spread);
        lp.y = ALT - 0.1 + L0.y + Math.sin(time * 0.3 + L0.ph) * 0.02;
        const r = (0.28 + 0.08 * L0.d) * L0.r;
        ls.set(r * 1.3, r * 0.42, r);
        lc.copy(smokeHigh).lerp(smokeFar, L0.d / 6);
      }
      lq.setFromAxisAngle(Y0, L0.a ?? L0.ph);
      lm.compose(lp, lq, ls);
      smoke.setMatrixAt(i, lm);
      smoke.setColorAt(i, lc);
    }
    smoke.instanceMatrix.needsUpdate = true;
    smoke.instanceColor.needsUpdate = true;
    for (let i = 0; i < flameSeed.length; i++) {
      const [x, z, ph, rim] = flameSeed[i];
      const f = 0.55 + 0.45 * Math.sin(time * 7 + ph) * Math.sin(time * 4.3 + ph * 1.7);
      flames.pos.set([x, rim ? 0.06 + 0.04 * f : 0.03, z], i * 3);
      flames.col.set([ember.r * 3, ember.g * 2.6, ember.b * 2, (rim ? 0.95 : 0.6) * f], i * 4);
    }
    flames.geo.attributes.position.needsUpdate = true;
    flames.geo.attributes.aColor.needsUpdate = true;
  }

  /* ----------------------------------------------------------- wind lines -- */
  const STREAKS = mobile() ? 900 : 1800;
  const wind = new THREE.Vector2(1, 1).normalize(); // blowing to the southeast
  const streakU = {
    uTime: { value: 0 }, uBox: { value: 90 }, uLen: { value: 1.6 }, uSpeed: { value: 3.2 },
    uWind: { value: wind }, uCenter: { value: new THREE.Vector3() },
    uColor: { value: lin(COL.wind, 1.4) }, uOpacity: { value: 0.32 },
  };
  {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(STREAKS * 2 * 4);
    const end = new Float32Array(STREAKS * 2);
    for (let i = 0; i < STREAKS; i++) {
      const s = [rand(), rand(), rand(), rand()];
      seed.set(s, i * 8);
      seed.set(s, i * 8 + 4);
      end[i * 2 + 1] = 1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 2 * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      uniforms: streakU, vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    lines.frustumCulled = false;
    scene.add(lines);
  }

  /* ----------------------------------------------------------------- domes -- */
  const domeGeo = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const domes = allCities
    .filter((c) => c.kind !== 'path')
    .map((c) => {
      const u = { uColor: { value: lin(COL.haze) }, uGlow: { value: lin(COL.hazeLit, 1.3) }, uOpacity: { value: 0 }, uLit: { value: 0 } };
      const mesh = new THREE.Mesh(domeGeo, new THREE.ShaderMaterial({
        uniforms: u, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, transparent: true, depthWrite: false,
      }));
      mesh.position.copy(c.pos);
      scene.add(mesh);
      const big = c.kind === 'dest';
      // Grown radii overlap: the separate domes merge into one.
      // The city's dome swells until it swallows its neighbours': they merge into one.
      return { mesh, u, big, r0: big ? 12 : 4, r1: big ? 34 : 12, delay: big ? 0 : rr(0.05, 0.25) };
    });

  /* ---------------------------------------------------------------- labels -- */
  const labelEls = allCities.map((c) => {
    const e = document.createElement('span');
    e.className = `ride-label s-tag${c.kind === 'dest' ? ' ride-label--dest' : ''}`;
    e.textContent = c.name;
    labels.append(e);
    return e;
  });

  /* ---------------------------------------------------------------- resize -- */
  let W = 1;
  let H = 1;
  // Fewer pixels before fewer frames (core/adaptive.js).
  const quality = createAdaptiveQuality(() => resize(W, H));
  function resize(w, h) {
    W = w;
    H = h;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 1.75) * quality.scale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5);
    camera.aspect = w / h;
    camera.fov = w < h ? 68 : 50;
    camera.updateProjectionMatrix();
    // Glow point sizes are world sizes: pixels per world unit at distance 1.
    const scale = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const g of [cityGlow, river, fireGlow, halo, flames]) g.mat.uniforms.uScale.value = scale;
  }

  /* ---------------------------------------------------------------- render -- */
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const pl = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);

  /**
   * p: scroll progress (the ride's own, see timing.js rideP); time: seconds of living motion;
   * minutes: the corner clock's time; arrive: { desc 0..1 the descent onto the particle,
   * tv the transition's clock in seconds (drives the dive wipe), crop the frame's cover crop }.
   */
  function render(p, time, minutes, arrive = null) {
    const s = pathAt(p);
    const night = nightAtMinutes(minutes);
    const portrait = W < H;

    /* -------- camera: side view → chase → lift → high oblique over the city -- */
    const me0 = sample(s, v1);
    tangent(s, tan);
    tan.y = 0;
    tan.normalize();
    side.crossVectors(Y, tan).normalize(); // to the particle's left
    // 2.1: swing 90° from side-on to behind-and-above.
    const swing = smooth(STEP.s21[0] + 0.01, STEP.s21[1] - 0.02, p);
    const ang = (1 - swing) * (Math.PI / 2);
    // 2.2: ride a little higher over the cities, so the river growing behind us shows below.
    const high = smooth(STEP.s22[0], STEP.s22[0] + 0.08, p);
    const back = lerp(6.5, lerp(5.5, 6.5, high), swing) * (portrait ? 1.35 : 1);
    camPos.copy(tan).multiplyScalar(-Math.cos(ang) * back).addScaledVector(side, Math.sin(ang) * back);
    camPos.add(me0).add(tmp.set(0, lerp(0.15, lerp(2.3, 3.4, high), swing), 0));
    look.copy(me0).addScaledVector(tan, 3.5 * swing).add(tmp.set(0, -0.35 * swing, 0));
    // 2.3: lift and fall back, looking ahead to the city.
    const lift = smooth(STEP.s23[0] - 0.02, STEP.s23[1], p);
    if (lift > 0) {
      tmp.copy(me0).addScaledVector(tan, -lerp(6.5, 24, lift)).add(v2.set(0, lerp(3.4, 11, lift), 0));
      camPos.lerp(tmp, lift);
      v2.copy(dest.pos).setY(1.5);
      look.lerp(v2, lift * 0.75);
    }
    // 2.4: a high oblique over the city; the trail plunges into its dome below.
    const over = smooth(STEP.s24[0], 0.93, p);
    if (over > 0) {
      tmp.copy(dest.pos).add(v2.set(-34, 50, 46).multiplyScalar(portrait ? 1.3 : 1));
      camPos.lerp(tmp, over);
      look.lerp(v2.copy(dest.pos).setY(0.5), over);
    }
    // Arrival (from the transition): straight down out of the dive wipe, high above the particle,
    // swung 32° off its path; the camera descends and swings in behind it, settling exactly into
    // the chase pose. The transition's own curve: d eases in log space, elevation 84° → chase.
    const desc = arrive ? arrive.desc : 1;
    if (desc < 1) {
      const u = desc;
      const e = 1 - Math.pow(1 - u, 2.6);
      pv.copy(camPos).sub(me0);
      const dEnd = pv.length();
      const elEnd = Math.asin(pv.y / dEnd);
      pv.y = 0;
      pv.normalize(); // behind the particle, horizontally
      const d = 42 * Math.pow(dEnd / 42, e);
      const el = lerp(84 * DEG, elEnd, smooth(0, 1, Math.pow(u, 0.75)));
      const az = lerp(32 * DEG, 0, smooth(0, 1, u));
      pv.applyAxisAngle(Y, az);
      camPos.copy(me0).addScaledVector(pv, d * Math.cos(el)).add(tmp.set(0, d * Math.sin(el), 0));
      look.lerpVectors(me0, look, smooth(0.5, 1, u));
    }
    // The end: down into the dome (Scene 4 falls out of it).
    const dive = smooth(0.955, 1, p);
    if (dive > 0) {
      tmp.copy(dest.pos).add(v2.set(-3, 4, 3));
      camPos.lerp(tmp, dive * dive);
      look.lerp(v2.copy(dest.pos).setY(0), dive);
    }
    camera.position.copy(camPos);
    camera.lookAt(look);

    /* ------------------------------------------------------ light, sky, fog -- */
    hemi.intensity = lerp(1.15, 0.5, night);
    sunset.intensity = lerp(1.5, 0.05, night);
    rim.intensity = lerp(0.35, 0.18, night);
    skyU.uHorizon.value.copy(SKY_DUSK.h).lerp(SKY_NIGHT.h, night);
    skyU.uMid.value.copy(SKY_DUSK.m).lerp(SKY_NIGHT.m, night);
    skyU.uTop.value.copy(SKY_DUSK.t).lerp(SKY_NIGHT.t, night);
    skyU.uSunAmt.value = 1 - night;
    const glowAmt = smooth(STEP.s23[0], STEP.s23[1], p);
    skyU.uGlowAmt.value = glowAmt * 0.9;
    skyU.uGlowDir.value.copy(dest.pos).sub(camPos).setY(0).normalize();
    scene.fog.color.copy(skyU.uHorizon.value).multiplyScalar(0.85);
    scene.fog.near = lerp(lerp(25, 45, lift), 60, over);
    scene.fog.far = lerp(lerp(150, 260, lift), 300, over);
    sky.position.copy(camPos);

    /* ------------------------------------------------------------ the city -- */
    const lightsOn = smooth(0.2, 0.7, night);
    for (let i = 0; i < cityGlow.size.length; i++) {
      const tw = 0.75 + 0.25 * Math.sin(time * 2 + i * 1.7);
      cityGlow.col.set([lampC.r, lampC.g, lampC.b, lightsOn * tw * 0.9], i * 4);
    }
    cityGlow.geo.attributes.aColor.needsUpdate = true;

    const rise = smooth(STEP.s23[0] + 0.02, STEP.s24[0] + 0.04, p);
    for (const d of domes) {
      const k = smooth(d.delay, 1, rise);
      const r = lerp(d.r0, d.r1, k);
      d.mesh.scale.set(r, r * 0.36 * (0.2 + 0.8 * k), r);
      const merged = d.big ? 0 : smooth(0.55, 1, rise);
      d.u.uOpacity.value = k * (1 - merged);
      d.u.uLit.value = lightsOn;
    }

    /* ------------------------------------------- fires and the river of light -- */
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      const on = smooth(f.uj - 0.12, f.uj - 0.02, s); // lit as we approach its join
      const fl = 0.7 + 0.3 * Math.sin(time * 9 + f.flicker) * Math.sin(time * 5.3 + f.flicker * 2);
      fireGlow.col.set([ember.r * 3, ember.g * 3, ember.b * 3, on * fl], i * 4);
    }
    fireGlow.geo.attributes.aColor.needsUpdate = true;

    const flow = 7; // km/s of screen-time: fast enough to read as a current
    let o = 0;
    for (let j = 0; j < streams.length; j++) {
      const st = streams[j];
      const n = counts[j];
      // Other fires' smoke is already riding the same wind: it flows in from upwind and runs a
      // little ahead of us, so we see each stream arrive and the river form around us.
      const lead = st.own ? 0 : 0.035;
      const on = st.own ? 1 : smooth(st.uj - 0.06, st.uj - 0.02, s);
      const behind = Math.max(0, s + lead - st.uj) * L; // km of main path this stream has reached
      const period = st.Lj + (1 - st.uj) * L;
      const head = st.Lj + behind;
      for (let k = 0; k < n; k++, o++) {
        const sd = seeds[o * 3];
        const d = (sd * period + time * flow) % period;
        let a = on * (d < head ? 1 : 0) * (1 - smooth(head - 4, head, d) * 0.6);
        let x;
        let y;
        let z;
        if (d < st.Lj) {
          const f = (d / st.Lj) * 48;
          const i0 = Math.min(47, Math.floor(f));
          const A = st.route[i0];
          const B = st.route[i0 + 1];
          x = lerp(A.x, B.x, f - i0);
          y = lerp(A.y, B.y, f - i0);
          z = lerp(A.z, B.z, f - i0);
          a *= 0.75;
        } else {
          const u = st.uj + (d - st.Lj) / L;
          sample(u, tmp);
          const idx = Math.round(clamp01(u) * N);
          const w = 0.03 + 0.02 * joined[idx];
          const t2 = Tn[idx];
          x = tmp.x - t2.z * seeds[o * 3 + 1] * w * 2;
          z = tmp.z + t2.x * seeds[o * 3 + 1] * w * 2;
          y = tmp.y + seeds[o * 3 + 2] * w;
        }
        river.pos[o * 3] = x;
        river.pos[o * 3 + 1] = y;
        river.pos[o * 3 + 2] = z;
        const c = st.own ? hot : ember;
        const b = st.own ? 1.8 : 1.6;
        river.col[o * 4] = c.r * b;
        river.col[o * 4 + 1] = c.g * b;
        river.col[o * 4 + 2] = c.b * b;
        river.col[o * 4 + 3] = a * (st.own ? 0.9 : 0.8);
      }
    }
    river.geo.attributes.position.needsUpdate = true;
    river.geo.attributes.aColor.needsUpdate = true;

    /* -------------------------------------------------- the particle itself -- */
    me.position.copy(me0);
    halo.pos.set([me0.x, me0.y, me0.z]);
    halo.col.set([hot.r * 2, hot.g * 2, hot.b * 2, 0.75]);
    halo.geo.attributes.position.needsUpdate = true;
    halo.geo.attributes.aColor.needsUpdate = true;
    trail.geometry.setDrawRange(0, Math.floor(s * 1500) * TUBE_STRIDE);
    // Inside the dome the particle is just one of billions: let it go.
    const gone = smooth(0.965, 1, s);
    me.visible = gone < 1;
    me.scale.setScalar(1 - gone);

    updateSmoke(time);

    /* ----------------------------------------------------------- the wind -- */
    streakU.uTime.value = time;
    streakU.uCenter.value.copy(me0);
    streakU.uOpacity.value = 0.24 * (1 - over * 0.7);

    if (arrive) {
      const w = arrive.tv < 10.6 ? 1 : 1 - smooth(10.625, 11.15, arrive.tv);
      wipe.enabled = w > 0;
      if (w > 0) {
        wipe.uniforms.uT.value = arrive.tv;
        wipe.uniforms.uW2.value = w;
        wipe.uniforms.uCrop.value.set(arrive.crop[0], arrive.crop[1]);
      }
    } else wipe.enabled = false;
    quality.frame();
    composer.render();

    /* --------------------------------------------------------------- labels -- */
    for (let i = 0; i < allCities.length; i++) {
      const c = allCities[i];
      const e = labelEls[i];
      tmp.copy(c.pos).setY(c.kind === 'dest' ? 5 : 0.6).project(camera);
      const dist = camPos.distanceTo(c.pos);
      const inFront = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      // Path cities while we fly over them; the neighbours and the city at the end.
      let a = 0;
      if (c.kind === 'path') a = (1 - smooth(30, 60, dist)) * (1 - lift);
      else a = smooth(STEP.s23[0], STEP.s23[0] + 0.08, p) * (1 - smooth(0.88, 0.94, p) * (c.kind === 'dest' ? 0 : 1));
      a *= inFront ? 1 : 0;
      if (a < 0.01) {
        if (e.style.opacity !== '0') e.style.opacity = '0';
        continue;
      }
      e.style.opacity = a.toFixed(2);
      e.style.transform = `translate3d(${(((tmp.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - tmp.y) / 2) * H).toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  }

  /**
   * Compile every shader without blocking (KHR_parallel_shader_compile), then draw once so the
   * post-processing passes compile too — so the first frame the reader sees costs a normal frame,
   * not the second of shader compilation that otherwise lands mid-scroll.
   */
  async function prepare(warm) {
    await renderer.compileAsync(scene, camera);
    const textures = new Set();
    scene.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    });
    for (const t of textures) {
      renderer.initTexture(t);
      await new Promise((r) => setTimeout(r, 0)); // one upload per task: no long block
    }
    warm?.(); // one real frame from the scene's opening camera: geometry uploads, post shaders
  }

  return { prepare, render, resize, pathLengthKm: L };
}
