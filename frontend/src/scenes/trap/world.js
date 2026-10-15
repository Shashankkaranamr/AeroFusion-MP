import * as THREE from 'three';
import { createAdaptiveQuality } from '../../core/adaptive.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SKY_VERT, SKY_FRAG, GLOW_VERT, GLOW_FRAG } from '../ride/shaders.js';
import { buildCity } from './city.js';

/**
 * SCENE 4 WORLD — the trap. Delhi side-on, in metres (x along the skyline, y up, z toward us).
 *
 * Same look as the Scene 2 render and the Scene 3 ride: rounded clay shapes, a violet dusk that
 * sinks into night, warm practical lights, bloom. The camera is far away with a long lens, so the
 * frame reads as a flat side view — the step 1.4 diagram — while the buildings keep their depth.
 *
 * A fixed set of particles lives between the ground and the ceiling. Nothing is ever added or
 * removed: each particle keeps its own fraction of the height, so when the ceiling falls they all
 * crowd down with it. Only the room changes.
 */

const rand = (() => { let s = 23; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const rr = (a, b) => a + (b - a) * rand();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lin = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

const COL = {
  ground: '#241a2c',
  road: '#1a1420',
  ceiling: '#f1e2c9',
  pm: '#ffb070',
  haze: '#7a5236',
};
const SPAN = 2600; // half-width of the city, m

export function createTrapWorld({ canvas }) {
  const mobile = () => window.innerWidth < 640;

  /* -------------------------------------------------------------- renderer -- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(18, 16 / 9, 10, 60000);
  scene.fog = new THREE.Fog(new THREE.Color('#6a3264'), 8000, 20000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ------------------------------------------------------------------- sky -- */
  const skyU = {
    uHorizon: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uTop: { value: new THREE.Color() },
    uSun: { value: lin('#ff6b52') }, uGlowCol: { value: lin('#b8703f', 1.1) },
    uSunDir: { value: new THREE.Vector3(-0.8, 0, -0.6).normalize() }, uGlowDir: { value: new THREE.Vector3(0, 0, -1) },
    uSunAmt: { value: 1 }, uGlowAmt: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40000, 48, 24),
    new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG }),
  );
  scene.add(sky);
  const DUSK = { h: lin('#7a3a62'), m: lin('#2e1240'), t: lin('#0c0a24') };
  const NIGHT = { h: lin('#1e1028'), m: lin('#0a0614'), t: lin('#030208') };

  const stars = new THREE.Points(
    (() => {
      const g = new THREE.BufferGeometry();
      const n = 600;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = rr(-1.2, 1.2) - Math.PI / 2;
        const ph = rr(0.08, 1.2);
        pos.set([30000 * Math.cos(th) * Math.cos(ph), 30000 * Math.sin(ph), 30000 * Math.sin(th) * Math.cos(ph)], i * 3);
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return g;
    })(),
    new THREE.PointsMaterial({ color: '#ffe9f5', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }),
  );
  sky.add(stars); // travels with the sky, so it is always at the horizon

  /* ---------------------------------------------------------------- lights -- */
  const hemi = new THREE.HemisphereLight('#a07cff', '#6a2e3e', 1.2);
  const sunset = new THREE.DirectionalLight('#ff9c8c', 1.5);
  sunset.position.set(-3000, 900, 2000);
  const rim = new THREE.DirectionalLight('#6fd6ff', 0.3);
  rim.position.set(3000, 1200, -1500);
  scene.add(hemi, sunset, rim);

  /* ---------------------------------------------------------------- ground -- */
  // A strip of ground under the city only: behind it the sky comes down to the rooftops, as in a
  // side-on diagram, instead of a plain running off to a hard horizon.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: COL.ground, roughness: 1 }));
  ground.position.z = -150;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(40000, 26).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: COL.road, roughness: 1 }));
  road.position.set(0, 0.3, 60);
  scene.add(ground, road);

  /* ----------------------------------------------------------- glow points -- */
  function glowPoints(count) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return { geo, mat: m, pos: geo.attributes.position.array, size: geo.attributes.aSize.array, col: geo.attributes.aColor.array };
  }

  /* ------------------------------------------------------------------ Delhi -- */
  const city = buildCity({ scene, rand, rr, glowPoints, mobile: mobile(), span: SPAN });
  const lights = city.glow;

  /* -------------------------------------------- the particles: a fixed set -- */
  const N = mobile() ? 2200 : 3600;
  const pm = glowPoints(N);
  const seeds = Array.from({ length: N }, () => [rr(-SPAN, SPAN), rr(-380, 160), Math.pow(rand(), 0.85), rr(0, 6.28), rr(0.7, 1.3)]);
  const pmSize = Float32Array.from({ length: N }, () => rr(0.8, 1.4));
  pmSize[0] = 2.6; // ours: a brighter dot among thousands
  seeds[0] = [-40, 120, 0.55, 0, 1];
  const pmC = lin(COL.pm, 1.5);
  const ourC = lin('#ffc27a', 3);

  /* ----------------------------------------------- the ceiling and its haze -- */
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(40000, 1, 1), new THREE.MeshBasicMaterial({ color: lin(COL.ceiling, 1.5), fog: false }));
  ceiling.position.z = 170;
  scene.add(ceiling);
  const hazeU = { uTop: { value: 1500 }, uDensity: { value: 0 }, uColor: { value: lin(COL.haze, 1.2) }, uLine: { value: lin(COL.ceiling, 0.9) } };
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: hazeU, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTop, uDensity; uniform vec3 uColor, uLine; varying vec3 vW;
      void main(){
        float h = vW.y / uTop;
        if (h > 1.0 || h < 0.0) discard;
        // Trapped smog: densest at the lid and at the ground, glowing faintly under the ceiling.
        float a = uDensity * (0.35 + 0.4 * smoothstep(0.55, 1.0, h) + 0.25 * (1.0 - smoothstep(0.0, 0.3, h)));
        vec3 c = mix(uColor, uLine, smoothstep(0.85, 1.0, h) * 0.5);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const hazeBack = new THREE.Mesh(new THREE.PlaneGeometry(40000, 4000), hazeMat);
  hazeBack.position.set(0, 2000, -480);
  const hazeFront = new THREE.Mesh(new THREE.PlaneGeometry(40000, 4000), hazeMat.clone());
  hazeFront.position.set(0, 2000, 140);
  scene.add(hazeBack, hazeFront);

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
    camera.fov = w < h ? 30 : 18;
    camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- render -- */
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const frame = { ground: 0, top: 0, ceiling: 0, metresPerPx: 1, x: 0 };

  /**
   * q: scene progress. time: seconds of living motion. night: 0 dusk … 1 deep night.
   * pblh: ceiling height (m). wind: m/s. still: 0..1, everything holding still (step 3.4).
   */
  function render({ q, time, night, pblh, wind, still }) {
    const portrait = W < H;
    /* ------------------------------ framing: zoom in as the room shrinks -- */
    // The view tightens with the ceiling, but more slowly, so the ceiling visibly falls on screen
    // while the city grows: 1,500 m fills most of the frame; 150 m is pressed onto the rooftops.
    const V = 2700 * Math.pow(pblh / 1500, 0.74) * (portrait ? 1.25 : 1);
    const fovR = (camera.fov * Math.PI) / 180;
    const D = V / 2 / Math.tan(fovR / 2);
    const cy = V * 0.42;
    const cx = lerp(-160, 0, q);
    // The drop: we arrive from above, out of the dome, pitched down, and level out.
    const drop = smooth(0, 0.09, q);
    camera.position.set(cx, cy + (1 - drop) * V * 1.4, 300 + D);
    look.set(cx, cy + (1 - drop) * V * 0.25, 0);
    camera.lookAt(look);
    camera.far = 90000;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    scene.fog.near = D * 1.05;
    scene.fog.far = D * 3;

    /* ---------------------------------------------------------- light, sky -- */
    hemi.intensity = lerp(1.15, 0.62, night); // moonlight keeps the rooftops readable
    sunset.intensity = lerp(1.4, 0, night);
    rim.intensity = lerp(0.3, 0.15, night);
    skyU.uHorizon.value.copy(DUSK.h).lerp(NIGHT.h, night);
    skyU.uMid.value.copy(DUSK.m).lerp(NIGHT.m, night);
    skyU.uTop.value.copy(DUSK.t).lerp(NIGHT.t, night);
    skyU.uSunAmt.value = 1 - night;
    scene.fog.color.copy(skyU.uHorizon.value).multiplyScalar(0.8);
    stars.material.opacity = smooth(0.4, 1, night) * 0.8;
    const lit = smooth(0.05, 0.5, night);
    city.update(time, lit, still);

    /* ------------------------------------------------------ the particles -- */
    const top = Math.max(20, pblh);
    // Sizes track the zoom (about 3–5 px), so the crowding, not the lens, is what thickens the smear.
    for (let i = 0; i < N; i++) pm.size[i] = pmSize[i] * V * 0.0024;
    pm.geo.attributes.aSize.needsUpdate = true;
    const crowd = 1500 / top; // the same particles in this much less room
    const drift = wind * (1 - still);
    for (let i = 0; i < N; i++) {
      const [x0, z, u, ph, sp] = seeds[i];
      // Carried along by a wind that dies through the night; a slow churn on top.
      const x = ((x0 + time * drift * 6 * sp + SPAN) % (2 * SPAN) + 2 * SPAN) % (2 * SPAN) - SPAN;
      const wob = Math.sin(time * 0.4 * sp + ph) * (1 - still);
      const y = 3 + u * (top - 6) + wob * top * 0.015;
      pm.pos[i * 3] = x;
      pm.pos[i * 3 + 1] = y;
      pm.pos[i * 3 + 2] = z;
      const c = i === 0 ? ourC : pmC;
      const a = i === 0 ? 1 : Math.min(0.95, 0.55 + 0.04 * crowd);
      pm.col.set([c.r, c.g, c.b, a], i * 4);
    }
    pm.geo.attributes.position.needsUpdate = true;
    pm.geo.attributes.aColor.needsUpdate = true;

    /* --------------------------------------------- the ceiling and the smog -- */
    ceiling.position.y = pblh;
    ceiling.scale.set(1, V / 900, V / 900);
    hazeU.uTop.value = pblh;
    hazeBack.material.uniforms.uDensity.value = Math.min(0.75, 0.1 + 0.05 * crowd);
    hazeFront.material.uniforms.uTop.value = pblh;
    hazeFront.material.uniforms.uDensity.value = Math.min(0.32, 0.015 * crowd);

    // Point sizes are world sizes: pixels per metre at distance 1.
    const dpr = renderer.getPixelRatio();
    const scale = (H * dpr) / (2 * Math.tan(fovR / 2));
    pm.mat.uniforms.uScale.value = scale;
    lights.mat.uniforms.uScale.value = scale;

    quality.frame();
    composer.render();

    // Where things land on screen, for the ruler and the labels.
    const toY = (h) => ((1 - tmp.set(cx, h, 0).project(camera).y) / 2) * H;
    frame.ground = toY(0);
    frame.ceiling = toY(pblh);
    frame.top = toY(V);
    frame.metresPerPx = V / H;
    tmp.copy(city.qutubTop).project(camera);
    frame.qutubX = ((tmp.x + 1) / 2) * W;
    frame.qutubY = ((1 - tmp.y) / 2) * H;
    return frame;
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
