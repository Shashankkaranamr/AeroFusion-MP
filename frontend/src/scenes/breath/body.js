import * as THREE from 'three';

/**
 * The way in: nostril → nasal passage → pharynx → windpipe → bronchi → bronchioles → one air sac.
 *
 * Built in the head's own frame (metres; origin at the centre of the head, +z out of the face),
 * so it starts exactly at the clay nostril. One path the camera flies down, its radius shrinking
 * from 9 mm to a tenth of a millimetre; the walls are translucent, clinical pink, so the
 * branching tree around the path shows through. At the end, an air sac about 0.2 mm across,
 * capillaries behind its wall, a red blood cell, and the spot where the particle comes to rest.
 */

/** Path waypoints [x, y, z, radius] — from just outside the right nostril to an air sac. */
const PATH = [
  [-0.009, -0.052, 0.134, 0.004], // outside, below the nostril
  [-0.009, -0.0385, 0.121, 0.0045], // the nostril
  [-0.008, -0.03, 0.1, 0.006], // vestibule: the hairs
  [-0.005, -0.028, 0.06, 0.008], // nasal cavity
  [-0.002, -0.04, 0.02, 0.011], // nasopharynx: the turn down
  [0, -0.09, 0.008, 0.011], // pharynx
  [0, -0.14, 0.015, 0.0095], // larynx
  [0, -0.17, 0.02, 0.009], // windpipe
  [0, -0.23, 0.022, 0.009],
  [0, -0.285, 0.02, 0.0085], // carina: the first fork
  [-0.025, -0.31, 0.02, 0.006], // right main bronchus
  [-0.045, -0.335, 0.025, 0.0045],
  [-0.06, -0.355, 0.03, 0.003],
  [-0.07, -0.368, 0.034, 0.002],
  [-0.076, -0.376, 0.036, 0.0013],
  [-0.08, -0.381, 0.037, 0.0008],
  [-0.0825, -0.3838, 0.0375, 0.0005],
  [-0.084, -0.3853, 0.0377, 0.0003], // terminal bronchiole
  [-0.0848, -0.3861, 0.0378, 0.00018],
  [-0.0852, -0.3865, 0.03785, 0.00012], // alveolar duct
  [-0.08535, -0.38665, 0.03787, 0.00011], // the air sac's centre
];
export const WAY = { nostril: 1, hairs: 2, nasal: 3, turn: 4, larynx: 6, carina: 9, terminal: 17, sac: PATH.length - 1 };
const N = PATH.length;
const RINGS_PER = 28;
const RADIAL = 28;
export const SAC_R = 0.00011;

const WALL_VERT = /* glsl */ `
attribute float aRing;
varying vec3 vN, vV;
varying vec2 vUv;
varying float vRing, vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  vUv = uv;
  vRing = aRing;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const WALL_FRAG = /* glsl */ `
uniform vec3 uDeep, uRim, uFog;
uniform float uFogNear, uFogFar, uAlpha, uIri;
varying vec3 vN, vV;
varying vec2 vUv;
varying float vRing, vDepth;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float fres = f * f;
  vec3 c = mix(uDeep, uRim, fres);
  // Cartilage rings in the windpipe and bronchi; a soft sheen elsewhere.
  float ring = vRing * smoothstep(0.55, 0.95, sin(vUv.x * 6.2831));
  c = mix(c, uRim * 1.12, ring * 0.45);
  // The air sac's wall is thinner than a soap bubble: a faint interference sheen.
  c += uIri * fres * 0.22 * (0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vec3(0.0, 0.33, 0.67))));
  float a = uAlpha * (0.22 + 0.78 * fres) + ring * 0.12;
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(mix(c, uFog, fog), a * (1.0 - fog * 0.85));
}`;

export function wallMaterial({ deep, rim, alpha = 0.7, iri = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: new THREE.Color(deep) }, uRim: { value: new THREE.Color(rim) }, uFog: { value: new THREE.Color('#1a0c10') },
      uFogNear: { value: 0.01 }, uFogFar: { value: 0.1 }, uAlpha: { value: alpha }, uIri: { value: iri },
    },
    vertexShader: WALL_VERT,
    fragmentShader: WALL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function buildBody({ face, rand, rr }) {
  const root = new THREE.Group();
  face.add(root);
  const mats = [];
  const wall = (o) => {
    const m = wallMaterial(o);
    mats.push(m);
    return m;
  };

  /* -------------------------------------------- the path and its frames -- */
  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const M = (N - 1) * RINGS_PER;
  const pos = [];
  const rad = [];
  for (let k = 0; k <= M; k++) {
    const t = k / M;
    pos.push(curve.getPoint(t));
    rad.push(radiusAt(t));
  }
  // Parallel-transport frames: no twist, so the camera never rolls on its way down.
  const tan = [];
  const nor = [];
  const bin = [];
  for (let k = 0; k <= M; k++) tan.push(pos[Math.min(M, k + 1)].clone().sub(pos[Math.max(0, k - 1)]).normalize());
  let n = new THREE.Vector3(0, 1, 0);
  n.sub(tan[0].clone().multiplyScalar(n.dot(tan[0]))).normalize();
  for (let k = 0; k <= M; k++) {
    n = n.clone().sub(tan[k].clone().multiplyScalar(n.dot(tan[k]))).normalize();
    nor.push(n);
    bin.push(new THREE.Vector3().crossVectors(tan[k], n).normalize());
  }

  function radiusAt(t) {
    const f = Math.min(N - 1.0001, Math.max(0, t * (N - 1)));
    const i = Math.floor(f);
    const u = f - i;
    return PATH[i][3] ** (1 - u) * PATH[i + 1][3] ** u; // geometric: shrinks evenly in scale
  }
  /** Sample the path at t: position, frame, radius (face-local). */
  function at(t, out) {
    const f = Math.min(M, Math.max(0, t * M));
    const k = Math.min(M - 1, Math.floor(f));
    const u = f - k;
    out.p.copy(pos[k]).lerp(pos[k + 1], u);
    out.t.copy(tan[k]).lerp(tan[k + 1], u).normalize();
    out.n.copy(nor[k]).lerp(nor[k + 1], u).normalize();
    out.b.copy(bin[k]).lerp(bin[k + 1], u).normalize();
    out.r = rad[k] * (1 - u) + rad[k + 1] * u;
    return out;
  }

  /* ----------------------------------------------- the airway, tapered -- */
  {
    const verts = [];
    const norms = [];
    const uvs = [];
    const rings = [];
    const idx = [];
    let along = 0;
    // From just inside the nostril (the clay nose is the outside) to just inside the sac.
    const first = Math.round(RINGS_PER * 1.15);
    const last = M - Math.round(RINGS_PER * 0.6);
    for (let k = first; k <= last; k++) {
      if (k > 0) along += pos[k].distanceTo(pos[k - 1]) / Math.max(rad[k], 1e-6);
      const t = k / M;
      const seg = t * (N - 1);
      const ringy = seg >= WAY.larynx + 0.5 && seg <= WAY.terminal - 2 ? 1 : 0; // cartilage
      for (let j = 0; j <= RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        // The nasal passage is a flattened slot; everything else round.
        const flat = seg < WAY.turn ? 0.8 : 1;
        const dir = nor[k].clone().multiplyScalar(Math.cos(a) * flat).addScaledVector(bin[k], Math.sin(a));
        verts.push(...pos[k].clone().addScaledVector(dir, rad[k]).toArray());
        norms.push(...dir.normalize().toArray());
        uvs.push(along * 0.55, j / RADIAL);
        rings.push(ringy);
      }
    }
    for (let k = 0; k < last - first; k++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = k * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('aRing', new THREE.Float32BufferAttribute(rings, 1));
    g.setIndex(idx);
    const airway = new THREE.Mesh(g, wall({ deep: '#4a1e28', rim: '#e0a0a8', alpha: 0.72 }));
    airway.frustumCulled = false;
    airway.renderOrder = 2;
    root.add(airway);
  }

  /* --------------------------------------------------------- nasal hairs -- */
  // Coarse hairs just inside the nostril, leaning inward: where the big dust snags.
  {
    const n = 60;
    const hair = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), new THREE.MeshStandardMaterial({ color: '#6a4a40', roughness: 0.7 }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
    for (let i = 0; i < n; i++) {
      at(rr(WAY.nostril + 0.2, WAY.hairs + 0.9) / (N - 1), s);
      const a = rr(0, Math.PI * 2);
      const radial = s.n.clone().multiplyScalar(Math.cos(a) * 0.8).addScaledVector(s.b, Math.sin(a)).normalize();
      const base = s.p.clone().addScaledVector(radial, s.r * 0.98);
      const len = s.r * rr(0.3, 0.55);
      // Point inward and a little forward, so they comb the passing air.
      const dir = radial.clone().negate().addScaledVector(s.t, 0.7).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.compose(base.addScaledVector(dir, len / 2), q, new THREE.Vector3(s.r * 0.014, len, s.r * 0.014));
      hair.setMatrixAt(i, m);
    }
    root.add(hair);
  }

  /* ------------------------------------ the rest of the tree, branching -- */
  // At every fork after the carina, the sibling branch heads off and divides twice more.
  {
    const branchMat = wall({ deep: '#3a1820', rim: '#c88a94', alpha: 0.42 });
    const tmp = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
    const grow = (start, dir, r, len, depth) => {
      const end = start.clone().addScaledVector(dir, len);
      const mid = start.clone().lerp(end, 0.5).addScaledVector(new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(), len * 0.08);
      const c = new THREE.QuadraticBezierCurve3(start, mid, end);
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 10, r, 14, false), branchMat);
      m.frustumCulled = false;
      root.add(m);
      if (depth <= 0) return;
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1))).normalize();
      for (const sgn of [-1, 1]) {
        const d2 = dir.clone().applyAxisAngle(side, sgn * rr(0.45, 0.7)).normalize();
        grow(end, d2, r * 0.78, len * 0.78, depth - 1);
      }
    };
    for (let w = WAY.carina; w < WAY.terminal; w++) {
      at(w / (N - 1), tmp);
      // Sibling: mirror our next direction across the fork's plane.
      const next = tmp.t.clone();
      const out = next.clone().applyAxisAngle(tmp.n, w === WAY.carina ? 1.4 : rr(0.9, 1.2) * (w % 2 ? 1 : -1)).normalize();
      grow(tmp.p.clone(), out, tmp.r * 0.85, tmp.r * 7, w < WAY.carina + 3 ? 3 : 2);
    }
  }

  /* --------------------------------------------- the air sac and its bed -- */
  const sac = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
  at(1, sac);
  const C = sac.p.clone();
  const out = sac.t.clone(); // straight ahead as we come in: the wall we will rest on
  const W = C.clone().addScaledVector(out, SAC_R); // the resting point on its inner wall
  const sacMat = wall({ deep: '#7a4650', rim: '#f6d6dc', alpha: 0.62, iri: 1.2 });
  const sacMesh = new THREE.Mesh(new THREE.SphereGeometry(SAC_R, 64, 48), sacMat);
  sacMesh.position.copy(C);
  root.add(sacMesh);
  // Neighbouring sacs, clustered like grapes behind the wall.
  const nbMat = wall({ deep: '#4a2630', rim: '#d8a8b0', alpha: 0.32, iri: 0.6 });
  for (let i = 0; i < 9; i++) {
    const d = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
    if (d.dot(out) < -0.5) continue; // not back up the duct
    const m = new THREE.Mesh(new THREE.SphereGeometry(SAC_R * rr(0.85, 1.05), 40, 30), nbMat);
    m.position.copy(C).addScaledVector(d, SAC_R * rr(1.75, 2.0));
    root.add(m);
  }
  // Capillaries hugging the outside of the wall, around where we land.
  const capMat = wall({ deep: '#4a0c16', rim: '#b8303c', alpha: 0.55 });
  const u1 = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0)).normalize();
  const u2 = new THREE.Vector3().crossVectors(out, u1).normalize();
  const CAP_R = 0.0000045;
  // Two families of vessels crossing at an angle: a woven net over the outside of the sac.
  const capillaries = [];
  const onSac = (a, b) => out.clone().multiplyScalar(Math.cos(a) * Math.cos(b)).addScaledVector(u1, Math.sin(a) * Math.cos(b)).addScaledVector(u2, Math.sin(b)).normalize();
  for (const [ax, ay] of [[1, 0.35], [-0.35, 1]]) {
    for (let k = -4; k <= 4; k++) {
      const pts = [];
      for (let i = -9; i <= 9; i++) {
        const s1 = i * 0.11;
        const s2 = k * 0.2 + Math.sin(i * 1.3 + k * 2.1) * 0.035;
        pts.push(C.clone().addScaledVector(onSac(s1 * ax - s2 * ay * 0.3, s1 * ay * 0.3 + s2 * (ax > 0 ? 1 : -1) * 0.9 + (ax > 0 ? 0 : s1)), SAC_R + CAP_R * 1.6));
      }
      const c = new THREE.CatmullRomCurve3(pts);
      capillaries.push(c);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(c, 80, CAP_R, 10, false), capMat));
    }
  }
  // A red blood cell: a biconcave disc, 7.5 µm across, drifting along the capillary nearest us.
  const rbc = (() => {
    const R = 0.00000375;
    const prof = [];
    for (let i = 0; i <= 20; i++) {
      const x = i / 20;
      const h = R * 0.55 * (0.24 + 2.0 * x * x - 1.72 * x ** 4) * Math.sqrt(Math.max(0, 1 - x * x)) + R * 0.02;
      prof.push(new THREE.Vector2(x * R, h));
    }
    for (let i = 20; i >= 0; i--) prof.push(new THREE.Vector2((i / 20) * R, -prof[i].y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), new THREE.MeshStandardMaterial({ color: '#d8323e', roughness: 0.5, emissive: new THREE.Color('#5a0a12'), emissiveIntensity: 0.6 }));
    root.add(m);
    return m;
  })();
  const rbcPath = capillaries[4]; // the one running right past where we land
  const Y = new THREE.Vector3(0, 1, 0);

  /** Living motion and the end of it. */
  function update(time, travel, still) {
    // The cell drifts past, slows, and stops when everything does.
    const u = 0.2 + 0.31 * travel; // comes to rest right beside where we land
    const p = rbcPath.getPointAt(Math.min(0.98, u));
    rbc.position.copy(p);
    // Face-on to us (its dimple toward the camera), turning slowly as it tumbles along.
    rbc.quaternion.setFromUnitVectors(Y, out);
    rbc.rotateX(0.35);
    rbc.rotateY(time * 0.25 * (1 - still));
  }

  return { root, at, mats, C, W, out, update, rbc };
}
