import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Delhi, side-on, in the toy-clay style of the Scene 2 render — modelled on drone shots of the
 * city (references/scene 3): a dense sprawl of small, many-coloured houses with black water tanks
 * and stair cabins on every roof; brick-red mid-rise towers with strips of warm windows; a thick
 * green canopy lit orange by sodium lamps; the landmarks — Jama Masjid's white domes and
 * minarets, India Gate on its lawns, Qutub Minar's fluted red stages with marble bands — a
 * flyover with traffic and the elevated Metro.
 *
 * Metres; x along the skyline, z toward the camera (front rows ≈ 0, back rows ≈ −560).
 * The final, tightest frame spans roughly x −600…600, so the landmarks all sit inside it.
 */

export const LANDMARKS = {
  jama: -480,
  gate: -255,
  qutub: 135,
};
const FLY = { x0: 300, x1: 1350, y: 9, z: 28 };
const METRO = { x0: -2600, x1: -640, y: 14, z: 30 };

const PAL = {
  houses: ['#e8d3b8', '#d98a5a', '#e0a3a0', '#9fb3c8', '#d9b46a', '#c9c2b0', '#b86a4a', '#e6c9a8', '#a8c0b0', '#d7b3c4', '#f0dcc0'],
  brick: ['#9a4a36', '#8a4030', '#a8583e', '#7e3c2e'],
  glass: ['#5d6f8c', '#6f7f99'],
  redstone: '#b4503a',
  sandstone: '#d9a066',
  marble: '#f0e4d4',
  tank: '#1d1b24',
  canopy: ['#2c7a5e', '#3a8a64', '#2a6f70', '#4a8f5a', '#356b4a'],
  lawn: '#3f6b48',
  concrete: '#8a7a8c',
  concreteDark: '#6e5f72',
  sodium: '#ffb050',
  led: '#e8eeff',
};

/** A window texture: a grid, some lit. `cols` × `rows`, lit share `p`. */
function windowTexture(rand, cols, rows, p, strips = false) {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, 64, 128);
  const cw = 64 / cols;
  const rh = 128 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() > p) continue;
      x.fillStyle = rand() < 0.82 ? '#ffcf8a' : '#d8e6ff';
      if (strips) x.fillRect(c * cw + cw * 0.15, r * rh + rh * 0.3, cw * 0.7, rh * 0.45);
      else x.fillRect(c * cw + cw * 0.3, r * rh + rh * 0.3, cw * 0.4, rh * 0.4);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity({ scene, rand, rr, glowPoints, mobile, span }) {
  const lit = { windows: [], floodlit: [] };
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
  // Monuments are floodlit at night: their stone glows warm as the city lights up.
  const stone = (color) => {
    const m = mat(color, { emissive: new THREE.Color(color), emissiveIntensity: 0 });
    lit.floodlit.push(m);
    return m;
  };
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const C = new THREE.Color();
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const inLandmark = (x, z) =>
    z > -300 && ((x > LANDMARKS.jama - 85 && x < LANDMARKS.jama + 85) || (x > LANDMARKS.gate - 95 && x < LANDMARKS.gate + 95) || (x > LANDMARKS.qutub - 70 && x < LANDMARKS.qutub + 90));

  /* ------------------------------------------------------- the sprawl -- */
  const houses = [];
  for (let z = -470; z <= -45; z += rr(18, 26)) {
    for (let x = -span; x < span;) {
      const near = Math.abs(x) < 1150;
      const w = rr(10, 20);
      if (!inLandmark(x, z) && (near || rand() < 0.55)) {
        // Taller toward the back, so rooftops step up behind each other.
        const back = (-z - 45) / 425;
        houses.push({ x, z: z + rr(-4, 4), w, h: rr(6, 13) + back * rr(0, 9), d: rr(10, 16) });
      }
      x += w + rr(0.5, 3) + (near ? 0 : rr(4, 14));
    }
  }
  {
    const houseMat = new THREE.MeshStandardMaterial({ roughness: 0.8, emissive: new THREE.Color('#ffffff'), emissiveMap: windowTexture(rand, 3, 4, 0.55), emissiveIntensity: 0 });
    lit.windows.push([houseMat, 1.25]);
    const mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), houseMat, houses.length);
    houses.forEach((b, i) => {
      M.compose(P.set(b.x, b.h / 2, b.z), Q.identity(), S.set(b.w, b.h, b.d));
      mesh.setMatrixAt(i, M);
      mesh.setColorAt(i, C.set(pick(PAL.houses)).multiplyScalar(0.72));
    });
    scene.add(mesh);
  }
  // Rooftops: black water tanks and stair cabins — the texture of every Delhi roof.
  {
    const tanks = houses.filter(() => rand() < 0.6);
    const tankMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), mat(PAL.tank, { roughness: 0.5 }), tanks.length);
    tanks.forEach((b, i) => {
      const r = rr(1.1, 1.7);
      M.compose(P.set(b.x + rr(-b.w / 3, b.w / 3), b.h + 1.1, b.z + rr(-b.d / 3, b.d / 3)), Q.identity(), S.set(r, 2.2, r));
      tankMesh.setMatrixAt(i, M);
    });
    scene.add(tankMesh);
    const cabins = houses.filter(() => rand() < 0.4);
    const cabinMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.15), mat('#ffffff'), cabins.length);
    cabins.forEach((b, i) => {
      M.compose(P.set(b.x + rr(-b.w / 4, b.w / 4), b.h + 1.6, b.z + rr(-b.d / 4, b.d / 4)), Q.identity(), S.set(3.4, 3.2, 3.4));
      cabinMesh.setMatrixAt(i, M);
      cabinMesh.setColorAt(i, C.set(pick(PAL.houses)).multiplyScalar(0.62));
    });
    scene.add(cabinMesh);
  }

  /* ------------------------------------------------- mid-rise towers -- */
  // Business districts, not a fence: a few clusters (think Connaught Place, Nehru Place,
  // Rajendra Place) and the odd lone tower.
  const towers = [];
  const clusters = [[-1050, 9], [-640, 4], [-20, 6], [560, 8], [1250, 7], [-1900, 6], [1900, 5]];
  for (const [cxl, n] of clusters) {
    for (let k = 0; k < n; k++) {
      const x = cxl + rr(-110, 110);
      if (Math.abs(x - LANDMARKS.qutub) < 70) continue; // keep the Minar's silhouette clear
      const hero = k === 0;
      towers.push({ x, z: rr(-580, -490), w: rr(16, hero ? 40 : 30), h: hero ? rr(80, 98) : rr(34, 75), d: rr(16, 28), glass: rand() < 0.3 });
    }
  }
  for (let i = 0; i < 10; i++) towers.push({ x: rr(-span, span), z: rr(-560, -470), w: rr(16, 26), h: rr(30, 55), d: rr(16, 22), glass: false });
  {
    const brickMat = new THREE.MeshStandardMaterial({ roughness: 0.75, emissive: new THREE.Color('#ffffff'), emissiveMap: windowTexture(rand, 4, 14, 0.62, true), emissiveIntensity: 0 });
    const glassMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1, emissive: new THREE.Color('#ffffff'), emissiveMap: windowTexture(rand, 6, 16, 0.5, true), emissiveIntensity: 0 });
    lit.windows.push([brickMat, 1.25], [glassMat, 1.1]);
    for (const [list, m, pal] of [[towers.filter((t) => !t.glass), brickMat, PAL.brick], [towers.filter((t) => t.glass), glassMat, PAL.glass]]) {
      const mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.05), m, list.length);
      list.forEach((t, i) => {
        M.compose(P.set(t.x, t.h / 2, t.z), Q.identity(), S.set(t.w, t.h, t.d));
        mesh.setMatrixAt(i, M);
        mesh.setColorAt(i, C.set(pick(pal)).multiplyScalar(0.85));
      });
      scene.add(mesh);
    }
  }

  /* ----------------------------------------------------------- canopy -- */
  // Lutyens' Delhi is a forest from above: clumps in the gaps, avenues by the monuments.
  {
    const trees = [];
    const n = mobile ? 1600 : 2600;
    for (let i = 0; i < n; i++) {
      const x = rr(-span, span);
      const z = rr(-480, 50);
      const r = rr(4, 9) * (inLandmark(x, z) ? 1.15 : 1);
      if (Math.abs(x) > 1300 && rand() < 0.5) continue;
      trees.push([x, z, r]);
    }
    // Avenue and lawns around India Gate, gardens around the Qutub complex.
    for (let x = LANDMARKS.gate - 90; x <= LANDMARKS.gate + 90; x += 11) for (const z of [-150, -110, 0, 30]) trees.push([x + rr(-2, 2), z + rr(-3, 3), rr(5, 7)]);
    for (let i = 0; i < 40; i++) trees.push([LANDMARKS.qutub + rr(-60, 85), rr(-200, -10), rr(5, 9)]);
    const mesh = new THREE.InstancedMesh(mergeVertices(new THREE.IcosahedronGeometry(1, 2)), mat('#ffffff', { roughness: 0.85 }), trees.length);
    trees.forEach(([x, z, r], i) => {
      M.compose(P.set(x, r * 0.95, z), Q.identity(), S.set(r, r * rr(0.95, 1.25), r));
      mesh.setMatrixAt(i, M);
      mesh.setColorAt(i, C.set(pick(PAL.canopy)).multiplyScalar(0.62));
    });
    mesh.geometry.computeVertexNormals();
    scene.add(mesh);
    // Lawns.
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(200, 230).rotateX(-Math.PI / 2), mat(PAL.lawn, { roughness: 1 }));
    lawn.position.set(LANDMARKS.gate, 0.4, -80);
    const lawn2 = lawn.clone();
    lawn2.scale.set(0.8, 1, 1);
    lawn2.position.set(LANDMARKS.qutub + 10, 0.4, -100);
    scene.add(lawn, lawn2);
  }

  /* ------------------------------------------------------------ India Gate -- */
  {
    const g = new THREE.Group();
    const s = stone(PAL.sandstone);
    const box = (w, h, d, x, y, z = 0, m = s) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.5, w / 8)), m);
      b.position.set(x, y + h / 2, z);
      g.add(b);
    };
    box(36, 2.2, 14, 0, 0); // plinth
    for (const sx of [-1, 1]) {
      box(9, 26, 10.5, sx * 10.5, 2.2); // piers
      box(10.4, 1.6, 11.6, sx * 10.5, 9.5); // string course
    }
    box(32, 6.5, 11.5, 0, 28.2); // lintel over the arch
    box(33.5, 1.4, 12.5, 0, 34.7); // cornice
    box(27, 3.2, 10, 0, 36.1); // attic
    box(20, 2, 8, 0, 39.3); // stepped crown
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.2, 1.6, 20), s);
    bowl.position.set(0, 42.1, 0);
    g.add(bowl);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(6.1, 1.8, 10, 28, Math.PI), s);
    arch.position.set(0, 22, 0);
    g.add(arch);
    // The canopy (chhatri) behind it.
    const c = new THREE.Group();
    for (const [px, pz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 10, 8), s);
      post.position.set(px, 6, pz);
      c.add(post);
    }
    const roof = new THREE.Mesh(new RoundedBoxGeometry(11, 1.4, 11, 2, 0.4), s);
    roof.position.y = 11.5;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), s);
    dome.position.y = 12.2;
    const base = new THREE.Mesh(new RoundedBoxGeometry(13, 1, 13, 2, 0.3), s);
    base.position.y = 0.5;
    c.add(roof, dome, base);
    c.position.set(0, 0, -95);
    g.add(c);
    g.position.set(LANDMARKS.gate, 0, -45);
    scene.add(g);
  }

  /* ------------------------------------------------------------ Qutub Minar -- */
  {
    const g = new THREE.Group();
    // Fluted stages: alternating round and angular flutes, like the real tower's first storey.
    const fluted = (r0, r1, h, flutes) => {
      const geo = new THREE.CylinderGeometry(r1, r0, h, flutes * 4, 6);
      const p = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const a = Math.atan2(v.z, v.x);
        const k = 1 + 0.07 * Math.abs(Math.sin(a * flutes));
        p.setXYZ(i, v.x * k, v.y, v.z * k);
      }
      geo.computeVertexNormals();
      return geo;
    };
    const stages = [[7.4, 6.0, 29, PAL.redstone], [6.0, 4.8, 15.5, PAL.redstone], [4.8, 3.9, 11.5, PAL.redstone], [3.9, 3.2, 8.5, PAL.marble], [3.2, 2.6, 6.5, PAL.marble]];
    let y = 0;
    stages.forEach(([r0, r1, h, col], i) => {
      const m = new THREE.Mesh(fluted(r0, r1, h, 12), stone(col));
      m.position.y = y + h / 2;
      g.add(m);
      // Inscribed bands.
      for (let b = 1; b <= 2; b++) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(lerpR(r0, r1, b / 3) + 0.25, lerpR(r0, r1, b / 3) + 0.25, 0.7, 24), stone(PAL.sandstone));
        band.position.y = y + (h * b) / 3;
        g.add(band);
      }
      y += h;
      // Balcony on brackets.
      const balcony = new THREE.Mesh(new THREE.CylinderGeometry(r1 + 1.5, r1 + 0.6, 1.6, 24), stone(i < 2 ? PAL.sandstone : PAL.marble));
      balcony.position.y = y;
      g.add(balcony);
    });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 2.8, 12), stone(PAL.sandstone));
    lantern.position.y = y + 1.4;
    g.add(lantern); // ≈ 73 m
    // The complex: Alai Darwaza (white dome on red), arched screen, the Iron Pillar.
    const gate = new THREE.Mesh(new RoundedBoxGeometry(16, 14, 16, 2, 0.6), stone(PAL.redstone));
    gate.position.set(-34, 7, 18);
    const gdome = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone(PAL.marble));
    gdome.position.set(-34, 14, 18);
    g.add(gate, gdome);
    for (let k = 0; k < 4; k++) {
      const ax = 26 + k * 13;
      for (const sx of [-5, 5]) {
        const pier = new THREE.Mesh(new RoundedBoxGeometry(3.4, 14, 4, 1, 0.3), stone(PAL.redstone));
        pier.position.set(ax + sx, 7, -14);
        g.add(pier);
      }
      const a = new THREE.Mesh(new THREE.TorusGeometry(5, 1.6, 8, 18, Math.PI), stone(PAL.redstone));
      a.position.set(ax, 14, -14);
      g.add(a);
    }
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 7.2, 10), mat('#2a2630', { roughness: 0.4, metalness: 0.4 }));
    pillar.position.set(14, 3.6, 16);
    g.add(pillar);
    g.position.set(LANDMARKS.qutub, 0, -60);
    scene.add(g);
  }

  /* ------------------------------------------------------------ Jama Masjid -- */
  {
    const g = new THREE.Group();
    const red = stone(PAL.redstone);
    const white = stone(PAL.marble);
    const box = (w, h, d, x, y, z, m = red) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.5), m);
      b.position.set(x, y + h / 2, z);
      g.add(b);
    };
    // Onion dome: a lathe profile with a finial.
    const onion = (r, m = white) => {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const rr2 = r * (Math.sin(Math.PI * t * 0.95) * (1 - 0.25 * t) + 0.12 * (1 - t));
        pts.push(new THREE.Vector2(Math.max(0.05, rr2), t * r * 1.7));
      }
      const d = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), m);
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * r, 0.04 * r, 0.6 * r, 8), stone(PAL.sandstone));
      fin.position.y = r * 1.95;
      d.add(fin);
      return d;
    };
    box(120, 10, 70, 0, 0, 0); // the raised platform
    box(120, 6, 4, 0, 10, 33); // front wall of the courtyard
    box(28, 18, 10, 0, 10, 34); // the great gate
    const gArch = new THREE.Mesh(new THREE.TorusGeometry(5, 1.5, 8, 18, Math.PI), white);
    gArch.position.set(0, 21, 39.5);
    g.add(gArch);
    box(64, 18, 16, 0, 10, -26); // the prayer hall
    for (let k = -3; k <= 3; k++) box(1.2, 18.2, 16.4, k * 9, 10, -26, white); // marble stripes
    for (const [x, r] of [[-17, 7], [0, 9.5], [17, 7]]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 4, 24), white);
      drum.position.set(x, 30, -26);
      const d = onion(r);
      d.position.set(x, 32, -26);
      g.add(drum, d);
    }
    // Two minarets, white-capped chhatris.
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 41, 16), red);
      m.position.set(sx * 38, 10 + 20.5, -26);
      for (const by of [12, 24, 36]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.2, 0.8, 16), white);
        ring.position.set(sx * 38, 10 + by, -26);
        g.add(ring);
      }
      const ch = onion(2.6);
      ch.position.set(sx * 38, 51, -26);
      g.add(m, ch);
    }
    // Corner pavilions.
    for (const [cx, cz] of [[-58, 33], [58, 33], [-58, -33], [58, -33]]) {
      box(6, 6, 6, cx, 10, cz);
      const ch = onion(3);
      ch.position.set(cx, 16, cz);
      g.add(ch);
    }
    g.position.set(LANDMARKS.jama, 0, -150);
    scene.add(g);
  }

  /* ------------------------------------------------- flyover and Metro -- */
  {
    const deck = new THREE.Mesh(new RoundedBoxGeometry(FLY.x1 - FLY.x0, 2.4, 16, 2, 0.6), mat(PAL.concrete));
    deck.position.set((FLY.x0 + FLY.x1) / 2, FLY.y, FLY.z);
    scene.add(deck);
    const pier = new RoundedBoxGeometry(4, FLY.y, 6, 2, 0.6);
    for (let x = FLY.x0 + 30; x < FLY.x1; x += 55) {
      const p = new THREE.Mesh(pier, mat(PAL.concreteDark));
      p.position.set(x, FLY.y / 2, FLY.z);
      scene.add(p);
    }
    for (const [x, dir] of [[FLY.x0, -1], [FLY.x1, 1]]) {
      const ramp = new THREE.Mesh(new RoundedBoxGeometry(120, 2.4, 16, 2, 0.6), mat(PAL.concrete));
      ramp.position.set(x + dir * 58, FLY.y / 2, FLY.z);
      ramp.rotation.z = dir * -Math.atan2(FLY.y, 120);
      scene.add(ramp);
    }
    const viaduct = new THREE.Mesh(new RoundedBoxGeometry(METRO.x1 - METRO.x0, 2, 10, 2, 0.5), mat(PAL.concrete));
    viaduct.position.set((METRO.x0 + METRO.x1) / 2, METRO.y, METRO.z);
    scene.add(viaduct);
    for (let x = METRO.x0 + 20; x < METRO.x1; x += 32) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(2.6, METRO.y, 3, 1, 0.4), mat(PAL.concreteDark));
      p.position.set(x, METRO.y / 2, METRO.z);
      scene.add(p);
    }
  }
  // The train: six cars with a band of lit windows.
  const trainMat = new THREE.MeshStandardMaterial({ color: '#c9ccd6', roughness: 0.5, emissive: new THREE.Color('#ffe9c8'), emissiveMap: windowTexture(rand, 8, 2, 0.95, true), emissiveIntensity: 0 });
  lit.windows.push([trainMat, 1.4]);
  const train = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const car = new THREE.Mesh(new RoundedBoxGeometry(20, 3.6, 3.4, 2, 0.8), trainMat);
    car.position.x = k * 21;
    train.add(car);
  }
  train.position.set(METRO.x0, METRO.y + 3, METRO.z);
  scene.add(train);

  /* -------------------------------------------------------------- lights -- */
  const ROAD_LAMPS = 150;
  const LANE_LAMPS = mobile ? 380 : 650;
  const CARS = 70;
  const AVIATION = towers.length;
  const glow = glowPoints(ROAD_LAMPS + LANE_LAMPS + CARS * 2 + AVIATION);
  let o = 0;
  for (let i = 0; i < ROAD_LAMPS; i++, o++) {
    glow.pos.set([-span + (i / ROAD_LAMPS) * span * 2, 8, 60], o * 3);
    glow.size[o] = 4;
  }
  // Sodium lamps in the lanes between the houses: pockets of orange under the canopy.
  for (let i = 0; i < LANE_LAMPS; i++, o++) {
    glow.pos.set([rr(-1400, 1400), rr(4, 7), rr(-440, -40)], o * 3);
    glow.size[o] = rr(3, 5);
  }
  const carStart = o;
  const carSeed = Array.from({ length: CARS }, () => [rand(), rand() < 0.5 ? 1 : -1, rr(0.6, 1), rand() < 0.55]);
  for (let i = 0; i < CARS * 2; i++) glow.size[carStart + i] = 2.2;
  o += CARS * 2;
  const avStart = o;
  towers.forEach((t, i) => {
    glow.pos.set([t.x, t.h + 1.5, t.z], (avStart + i) * 3);
    glow.size[avStart + i] = 3;
  });

  const sodium = new THREE.Color(PAL.sodium).multiplyScalar(2.4);
  const led = new THREE.Color(PAL.led).multiplyScalar(2);

  /** lit: 0 dusk … 1 night (lights on). still: 0..1, traffic stopping (step 3.4). */
  function update(time, litAmt, still) {
    for (const [m, k] of lit.windows) m.emissiveIntensity = litAmt * k;
    for (const m of lit.floodlit) m.emissiveIntensity = litAmt * 0.34;
    let i = 0;
    for (; i < ROAD_LAMPS; i++) glow.col.set([led.r, led.g, led.b, litAmt * 0.85], i * 4);
    for (; i < ROAD_LAMPS + LANE_LAMPS; i++) glow.col.set([sodium.r, sodium.g, sodium.b, litAmt * 0.8], i * 4);
    const traffic = 1 - still * 0.9;
    for (let c = 0; c < CARS; c++) {
      const [ph, dir, sp, onFly] = carSeed[c];
      const u = (((ph + dir * time * 0.02 * sp * traffic) % 1) + 1) % 1;
      const k = carStart + c * 2;
      const x = onFly ? FLY.x0 + u * (FLY.x1 - FLY.x0) : -span + u * span * 2;
      const y = onFly ? FLY.y + 2 : 1.6;
      const z = (onFly ? FLY.z : 66) + dir * 4;
      glow.pos.set([x, y, z], k * 3);
      glow.pos.set([x - dir * 4, y, z], (k + 1) * 3);
      glow.col.set([2.6, 2.4, 2.0, 0.9], k * 4);
      glow.col.set([2.4, 0.3, 0.2, 0.8], (k + 1) * 4);
    }
    // Aviation lights blink on the towers.
    for (let t = 0; t < AVIATION; t++) {
      const on = Math.sin(time * 2.4 + t * 1.7) > 0.35 ? 1 : 0.15;
      glow.col.set([3, 0.25, 0.2, on * litAmt], (avStart + t) * 4);
    }
    glow.geo.attributes.position.needsUpdate = true;
    glow.geo.attributes.aColor.needsUpdate = true;
    // The Metro runs, until everything holds still.
    const run = ((time * 0.012 * (1 - still)) % 1) * (METRO.x1 - METRO.x0 + 200) - 130;
    train.position.x = METRO.x0 + run;
  }

  return { update, glow, qutubTop: new THREE.Vector3(LANDMARKS.qutub, 76, -60) };
}

function lerpR(a, b, t) {
  return a + (b - a) * t;
}
