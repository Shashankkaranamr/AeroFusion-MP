import * as THREE from 'three';
import { createAdaptiveQuality } from '../../core/adaptive.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLOW_FRAG } from '../ride/shaders.js';

/** Glow points sized in world units at ANY scale (the shared shader assumes metres and up). */
const GLOW_VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
uniform float uScale;
varying vec4 vC;
void main() {
  vC = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(220.0, aSize * uScale / max(1e-9, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
import { buildStreet } from './street.js';
import { buildBody, WAY, SAC_R } from './body.js';

/**
 * SCENE 5 WORLD — the breath. One continuous dive, from a chai stall at street level to a single
 * air sac, ten metres to ten micrometres, with no cuts between scales.
 *
 * Everything is in metres. The trick that makes a million-fold zoom work in one scene: the world
 * is placed so the point where the particle comes to rest sits exactly at the origin, where
 * floating-point precision is finest; the street, metres away, needs far less. The camera's
 * clipping planes, fog and particle sizes all follow one number, `s` — how big the space around
 * the camera is right now.
 *
 * Clinical and quiet: grey dawn outside, translucent pink inside, no bloom to speak of.
 */

const rand = (() => { let s = 41; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const rr = (a, b) => a + (b - a) * rand();
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Scroll progress at which the camera passes each path waypoint (see body.js PATH). */
const WAYPOINT_P = [0.335, 0.35, 0.37, 0.4, 0.43, 0.455, 0.475, 0.49, 0.51, 0.53, 0.555, 0.575, 0.595, 0.615, 0.635, 0.655, 0.675, 0.695, 0.715, 0.74, 0.78];
export const BEAT = {
  walk: [0.03, 0.2], // 4.1 street, first person
  push: [0.2, 0.335], // into the face
  dive: [0.335, 0.78], // nose → windpipe → bronchi → bronchioles
  sac: [0.78, 0.9], // into the air sac, the particle settles
  still: 0.92, // motion stops
};

const GREY = new THREE.Color('#a6a8ad');
const INSIDE = new THREE.Color('#1a0c10');

export function createBreathWorld({ canvas }) {
  const mobile = () => window.innerWidth < 640;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = GREY.clone();
  scene.fog = new THREE.Fog(GREY.clone(), 3, 30);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.01, 1000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.4, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const hemi = new THREE.HemisphereLight('#d7dbe2', '#5a5048', 1.15);
  const key = new THREE.DirectionalLight('#ece6dc', 0.7);
  key.position.set(-3, 6, 4);
  scene.add(hemi, key);

  /* ------------------------------------------------- the set, placed -- */
  const set = new THREE.Group();
  scene.add(set);
  const street = buildStreet({ set, rand, rr });
  const body = buildBody({ face: street.face, rand, rr });
  const you = street.you.g;
  // Final pose: standing at the counter, facing the street. Place the set so the resting point on
  // the air sac's wall lands on the world origin.
  you.position.set(0, 0, 0);
  you.rotation.y = 0;
  set.updateMatrixWorld(true);
  const Wset = set.worldToLocal(street.face.localToWorld(body.W.clone()));
  set.position.copy(Wset).negate();
  set.updateMatrixWorld(true);
  const DOOR = new THREE.Vector3(-1.5, 0, -1.55);
  // Everything outside the body; hidden once we are inside it (it is metres away, and its clay
  // would only cut through the view at this scale).
  const outside = [];
  set.traverse((o) => {
    if (o.isMesh || o.isSprite || o.isLine) {
      let a = o;
      while (a && a !== body.root) a = a.parent;
      if (!a) outside.push(o);
    }
  });

  /* --------------------------------------------------------- particles -- */
  function glowPoints(count, blending = THREE.NormalBlending) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending,
    });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    scene.add(pts);
    return { geo, mat: m, pos: geo.attributes.position.array, size: geo.attributes.aSize.array, col: geo.attributes.aColor.array };
  }
  // The street's smog: big PM10 grains and fine PM2.5, hanging in the grey.
  const AMB = mobile() ? 700 : 1200;
  const amb = glowPoints(AMB);
  const ambSeed = Array.from({ length: AMB }, () => [rr(-8, 8), rr(0.2, 4), rr(-3, 8), rand() < 0.35, rr(0, 6.28)]);
  // Inside: PM10 that snags in the nose and windpipe, PM2.5 that gets further. Ours goes all the way.
  const PM10 = 36;
  const PM25 = 48;
  const inner = glowPoints(PM10 + PM25);
  const innerSeed = [];
  for (let i = 0; i < PM10 + PM25; i++) {
    const big = i < PM10;
    // Where it gets stuck: most PM10 in the nose, the rest in the windpipe; PM2.5 deeper.
    const stop = big
      ? (rand() < 0.7 ? rr(WAY.nostril + 0.3, WAY.turn) : rr(WAY.larynx, WAY.carina + 1)) / (WAY.sac)
      : rr(WAY.carina, WAY.terminal) / WAY.sac;
    innerSeed.push({ big, stop, lead: rr(0.2, 1.6) / WAY.sac, ang: rr(0, 6.28), rad: rr(0.15, 0.6) });
  }
  const ours = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: '#ff8a3d', roughness: 0.75, emissive: new THREE.Color('#ff8a3d'), emissiveIntensity: 0.35 }));
  ours.renderOrder = 6;
  scene.add(ours);
  const halo = glowPoints(1, THREE.AdditiveBlending);

  const PMC = new THREE.Color('#8f8070');
  const PM10C = new THREE.Color('#6f6256');

  /* ------------------------------------------------------------ resize -- */
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
    camera.fov = w < h ? 66 : 50;
    camera.updateProjectionMatrix();
    const scale = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const g of [amb, inner, halo]) g.mat.uniforms.uScale.value = scale;
  }

  /* ------------------------------------------------------------ helpers -- */
  const S = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
  const S2 = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
  const faceToWorld = (v) => street.face.localToWorld(v);
  const dirToWorld = (v) => v.transformDirection(street.face.matrixWorld);
  /** Path parameter (0..1) for scroll progress p, inside the dive. */
  function pathT(p) {
    if (p <= WAYPOINT_P[0]) return 0;
    for (let i = 0; i < WAYPOINT_P.length - 1; i++) {
      if (p <= WAYPOINT_P[i + 1]) return (i + (p - WAYPOINT_P[i]) / (WAYPOINT_P[i + 1] - WAYPOINT_P[i])) / (WAYPOINT_P.length - 1);
    }
    return 1;
  }
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const up = new THREE.Vector3();
  const lookQ = (from, to, upv, out) => out.setFromRotationMatrix(m4.lookAt(from, to, upv));

  /* ------------------------------------------------------------ render -- */
  /** p: scroll progress; time: living motion; still: 0..1 everything stopping. Returns s. */
  function render(p, time) {
    const still = smooth(BEAT.still - 0.02, BEAT.still + 0.01, p);
    const live = time;

    /* ---------------------------------- the person steps out, to the counter -- */
    const step = smooth(0.05, 0.17, p);
    you.position.lerpVectors(DOOR, tmp.set(0, 0, 0), step);
    you.position.y = Math.abs(Math.sin(step * Math.PI * 6)) * 0.02 * (1 - step);
    you.rotation.y = lerp(Math.PI / 2, 0, smooth(0.12, 0.18, p));
    set.updateMatrixWorld(true);

    /* -------------------------------------------------------------- camera -- */
    let s;
    const nostril = faceToWorld(body.at(0, S).p.clone());
    const inward = dirToWorld(S.t.clone());
    // A: first person, walking up the footpath toward the stall.
    const walk = smooth(BEAT.walk[0], BEAT.walk[1], p);
    const eye = set.localToWorld(new THREE.Vector3(lerp(-6.5, -0.95, walk), 1.62 + Math.sin(walk * Math.PI * 9) * 0.012 * (1 - walk), lerp(0.95, 1.7, walk)));
    camPos.copy(eye);
    const faceAt = faceToWorld(tmp2.set(0, -0.02, 0.05));
    const glance = set.localToWorld(new THREE.Vector3(3, 1.5, 0.4));
    look.copy(glance).lerp(faceAt, smooth(0.08, 0.17, p));
    up.set(0, 1, 0);
    s = 1.5;
    lookQ(camPos, look, up, qA);
    // B: the slow push, into the face, to the nostril.
    if (p > BEAT.push[0]) {
      const u = smooth(BEAT.push[0], BEAT.push[1], p);
      const d0 = eye.distanceTo(nostril);
      const d = d0 * (0.005 / d0) ** u; // geometric: steady in scale, never rushing
      const dir = eye.clone().sub(nostril).normalize().lerp(inward.clone().negate(), smooth(0.35, 1, u)).normalize();
      camPos.copy(nostril).addScaledVector(dir, d);
      look.copy(faceAt).lerp(nostril, smooth(0, 0.6, u));
      s = Math.max(d * 0.6, 0.004);
      lookQ(camPos, look, up, qA);
    }
    // C: down the airway, with the path's own (untwisting) frame.
    if (p > BEAT.dive[0] - 0.01) {
      const t = pathT(p);
      body.at(t, S);
      const cp = faceToWorld(S.p.clone());
      const ct = dirToWorld(S.t.clone());
      const cn = dirToWorld(S.n.clone());
      lookQ(cp, tmp.copy(cp).add(ct), cn, qB);
      const w = smooth(BEAT.dive[0] - 0.01, BEAT.dive[0] + 0.01, p);
      camPos.lerp(cp, w);
      qA.slerp(qB, w);
      if (w > 0) s = lerp(s, S.r, w);
      // D: into the sac, toward the wall we will rest on.
      if (p > BEAT.sac[0]) {
        const u = smooth(BEAT.sac[0], BEAT.sac[1] - 0.04, p);
        // Stop halfway between the sac's centre and its mouth: the far wall curves around us.
        const end = new THREE.Vector3(0, 0, 0).addScaledVector(dirToWorld(body.out.clone()), -SAC_R * 1.5);
        camPos.lerp(end, u);
        s = lerp(S.r, SAC_R * 1.2, u);
      }
    }
    camera.position.copy(camPos);
    camera.quaternion.copy(qA);
    camera.near = s * 0.02;
    camera.far = Math.max(s * 900, 0.01);
    camera.updateProjectionMatrix();

    /* --------------------------------------------- fog: grey street → inside -- */
    const inside = smooth(0.326, 0.342, p);
    for (const o of outside) o.visible = inside < 0.98;
    scene.fog.color.copy(GREY).lerp(INSIDE, inside);
    scene.background.copy(scene.fog.color);
    scene.fog.near = lerp(3, s * 3, inside);
    scene.fog.far = lerp(32, s * 30, inside);
    for (const m of body.mats) {
      m.uniforms.uFogNear.value = s * 3;
      m.uniforms.uFogFar.value = s * 32;
    }

    /* ------------------------------------------------------------ the smog -- */
    for (let i = 0; i < AMB; i++) {
      const [x, y, z, big, ph] = ambSeed[i];
      const dx = Math.sin(live * 0.07 + ph) * 0.3 * (1 - still);
      tmp.set(x + dx + live * 0.05 * (1 - still), y + Math.sin(live * 0.11 + ph) * 0.1, z);
      set.localToWorld(tmp);
      amb.pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      amb.size[i] = big ? 0.022 : 0.009;
      const c = big ? PM10C : PMC;
      amb.col.set([c.r, c.g, c.b, (big ? 0.55 : 0.45) * (1 - inside)], i * 4);
    }
    amb.geo.attributes.position.needsUpdate = true;
    amb.geo.attributes.aSize.needsUpdate = true;
    amb.geo.attributes.aColor.needsUpdate = true;

    /* ------------------------- inside: PM10 snags early, PM2.5 later, ours never -- */
    const tc = pathT(p);
    for (let i = 0; i < innerSeed.length; i++) {
      const q = innerSeed[i];
      const tp = Math.min(tc + q.lead, q.stop);
      const stuck = smooth(q.stop - 0.25 / WAY.sac, q.stop, tc + q.lead);
      body.at(tp, S2);
      const rf = lerp(q.rad, 0.96, stuck);
      tmp.copy(S2.p).addScaledVector(S2.n, Math.cos(q.ang) * S2.r * rf * (S2.r > 0.007 && tp * WAY.sac < WAY.turn ? 0.62 : 1)).addScaledVector(S2.b, Math.sin(q.ang) * S2.r * rf);
      faceToWorld(tmp);
      inner.pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      // Sizes are symbolic but in proportion: PM10 four times the diameter of PM2.5.
      const rStop = body.at(q.stop, S2).r;
      inner.size[i] = rStop * (q.big ? 0.16 : 0.04);
      const c = q.big ? PM10C : PMC;
      inner.col.set([c.r * 1.3, c.g * 1.3, c.b * 1.3, inside * (q.big ? 0.95 : 0.8)], i * 4);
    }
    inner.geo.attributes.position.needsUpdate = true;
    inner.geo.attributes.aSize.needsUpdate = true;
    inner.geo.attributes.aColor.needsUpdate = true;

    /* ---------------------------------------------------------------- ours -- */
    // In the street it drifts toward the face; inside it rides just ahead of us; in the sac it
    // settles on the wall, true size, and stays.
    // Symbolic size on the way down; its true 2.5 µm once it rests.
    const ourR = lerp(Math.min(0.006, Math.max(0.00000125, s * 0.035)), 0.00000125, smooth(BEAT.sac[0], BEAT.sac[1], p));
    const drift = smooth(0.1, BEAT.push[1], p);
    tmp.copy(set.localToWorld(new THREE.Vector3(-0.7, 1.72, 1.5))).lerp(nostril, drift * drift);
    if (p > BEAT.dive[0] - 0.01) {
      const lead = tc + 0.55 / WAY.sac;
      body.at(Math.min(1, lead), S2);
      // Past the end of the duct it keeps going straight on into the sac, always ahead of us.
      const ahead = faceToWorld(S2.p.clone().addScaledVector(body.out, Math.max(0, lead - 1) * WAY.sac * SAC_R * 1.6));
      tmp.lerp(ahead, smooth(BEAT.dive[0] - 0.01, BEAT.dive[0] + 0.01, p));
      if (p > BEAT.sac[0]) {
        const rest = dirToWorld(body.out.clone()).multiplyScalar(-0.0000013); // just inside the wall
        tmp.lerp(rest, smooth(BEAT.sac[0] + 0.02, BEAT.sac[1], p));
      }
    }
    ours.position.copy(tmp);
    ours.scale.setScalar(ourR);
    halo.pos.set([tmp.x, tmp.y, tmp.z]);
    halo.size[0] = ourR * 9;
    halo.col.set([1.6, 0.75, 0.3, 0.55]);
    halo.geo.attributes.position.needsUpdate = true;
    halo.geo.attributes.aSize.needsUpdate = true;
    halo.geo.attributes.aColor.needsUpdate = true;

    /* -------------------------------------------------------- living motion -- */
    street.update(live, still);
    body.update(live, smooth(BEAT.sac[0], BEAT.still, p), still);
    // Inside, the light is ours: a soft lamp that travels with us.
    hemi.intensity = lerp(1.15, 0.9, inside);
    key.intensity = lerp(0.7, 0.4, inside);

    quality.frame();
    composer.render();
    return s;
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

  return { prepare, render, resize };
}

export { SAC_R };
