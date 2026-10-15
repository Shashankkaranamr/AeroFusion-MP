import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Street level, grey dawn — after the references (references/scene 5): a chai stall against a
 * blue shutter (steel pot on the stove, kettle, glass jars, strips of snack packets, a bare bulb
 * under a blue tarp), a green-and-yellow auto-rickshaw at the kerb, yellow-and-black kerb
 * stones, a sodium lamp still on, wires overhead, people in sweaters with kulhads.
 *
 * Metres. The person we follow stands at the origin of `set`, facing +z (toward the road);
 * the stall is behind them. Toy-clay shapes, in the quiet, desaturated colours of a smog morning.
 */

const PAL = {
  asphalt: '#4e4d54',
  footpath: '#837a76',
  kerbY: '#c9a640',
  kerbK: '#2a2a2e',
  shutter: '#4f6f8f',
  wall: '#a89a8a',
  wood: '#7e5f45',
  steel: '#b9bdc6',
  tarp: '#3f6f9a',
  jarLid: '#e2c23a',
  snacks: ['#e8c84a', '#d9574a', '#4aa86a', '#4a7ad0', '#e88a3a'],
  kulhad: '#b0623e',
  skin: '#b07a5a',
  sweater: '#6a7180',
  sweater2: '#7a5a5a',
  trousers: '#3a3e4a',
  muffler: '#8a3a3a',
  cap: '#45444f',
  autoGreen: '#2f7f4a',
  autoYellow: '#e1c13a',
  tyre: '#1e1e22',
  building: ['#9a8f86', '#8e8a92', '#a39383', '#7f8790'],
  lamp: '#ffc070',
};

export function buildStreet({ set, rand, rr }) {
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...o });
  const rbox = (w, h, d, color, r = 0.04, o) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)), mat(color, o));
  const at = (m, x, y, z) => {
    m.position.set(x, y, z);
    set.add(m);
    return m;
  };
  const capsule = (r, len, color) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color));

  /* --------------------------------------------------------- the street -- */
  at(new THREE.Mesh(new THREE.PlaneGeometry(80, 12).rotateX(-Math.PI / 2), mat(PAL.asphalt, { roughness: 0.95 })), 0, 0, 7.6);
  at(new THREE.Mesh(new THREE.PlaneGeometry(80, 3.6).rotateX(-Math.PI / 2), mat(PAL.footpath, { roughness: 1 })), 0, 0.12, -0.2);
  // Kerb stones, painted yellow and black.
  for (let x = -30; x < 30; x += 0.9) {
    at(rbox(0.88, 0.24, 0.3, Math.round(x / 0.9) % 2 ? PAL.kerbY : PAL.kerbK, 0.04), x, 0.12, 1.6);
  }
  // A white lane line, fading into the haze.
  for (let x = -30; x < 30; x += 3) at(rbox(1.6, 0.01, 0.12, '#cfcfcf'), x, 0.01, 6);

  /* ----------------------------------------------------------- the stall -- */
  const stall = new THREE.Group();
  stall.position.set(0, 0, -1.25);
  set.add(stall);
  const put = (m, x, y, z) => {
    m.position.set(x, y, z);
    stall.add(m);
    return m;
  };
  put(rbox(5, 3.2, 0.3, PAL.wall), 0, 1.6, -0.75); // shopfront wall
  put(rbox(2.6, 2.3, 0.08, PAL.shutter, 0.02), 0, 1.25, -0.58); // blue shutter
  for (let y = 0.2; y < 2.4; y += 0.12) put(rbox(2.6, 0.012, 0.09, '#3f5d79', 0.004), 0, y, -0.55); // its slats
  put(rbox(2.3, 1.0, 0.7, PAL.wood, 0.05), 0, 0.5, 0.05); // the counter
  put(rbox(2.4, 0.06, 0.78, '#9a8a78', 0.02), 0, 1.03, 0.05); // its steel-wrapped top
  // Stove and the big steel pot, steaming.
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.12, 20), mat('#2a2a30')), 0.45, 1.12, 0.05);
  const pot = put(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.32, 28), mat(PAL.steel, { metalness: 0.6, roughness: 0.35 })), 0.45, 1.34, 0.05);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 28), mat(PAL.steel, { metalness: 0.6, roughness: 0.3 })), 0.45, 1.51, 0.05);
  // The aluminium kettle.
  const kettle = new THREE.Group();
  kettle.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), mat(PAL.steel, { metalness: 0.55, roughness: 0.35 })));
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 0.16, 10), mat(PAL.steel, { metalness: 0.55, roughness: 0.35 }));
  spout.position.set(0.12, 0.03, 0);
  spout.rotation.z = -0.9;
  kettle.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 8, 16, Math.PI), mat('#222'));
  handle.position.y = 0.08;
  kettle.add(handle);
  put(kettle, -0.3, 1.16, 0.12);
  // Glass jars of rusks and biscuits, yellow lids.
  for (let k = 0; k < 4; k++) {
    const jar = put(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 16), mat('#e9e2d0', { transparent: true, opacity: 0.55, roughness: 0.2 })), 0.82 + (k % 2) * 0.22, 1.18, -0.12 + Math.floor(k / 2) * 0.24);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.04, 16), mat(PAL.jarLid));
    lid.position.y = 0.14;
    jar.add(lid);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.14, 12), mat(k % 2 ? '#c99a5a' : '#d9b07a'));
    fill.position.y = -0.04;
    jar.add(fill);
  }
  // Kulhads stacked on the counter.
  for (let k = 0; k < 7; k++) put(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.08, 12), mat(PAL.kulhad)), -0.75 + (k % 4) * 0.09, 1.1 + Math.floor(k / 4) * 0.08, 0.15);
  // Strips of snack packets hanging from the awning.
  for (let s = 0; s < 4; s++) {
    for (let k = 0; k < 9; k++) {
      put(rbox(0.13, 0.09, 0.015, PAL.snacks[(s + k) % PAL.snacks.length], 0.01), 1.08 + s * 0.15, 2.1 - k * 0.1, 0.2);
    }
  }
  // Tarp awning and its bare bulb.
  const tarp = put(rbox(3.4, 0.03, 1.8, PAL.tarp, 0.01), 0, 2.45, 0.35);
  tarp.rotation.x = 0.12;
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), mat('#222')), -0.1, 2.28, 0.25);
  const bulb = put(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.lamp).multiplyScalar(3), toneMapped: true })), -0.1, 2.14, 0.25);
  const bulbLight = new THREE.PointLight(PAL.lamp, 2.2, 6, 2);
  bulbLight.position.set(-0.1, 2.1, 0.4);
  stall.add(bulbLight);

  /* ----------------------------------------------------------- people -- */
  // A toy-clay figure. Returns the group and its parts.
  function figure({ sweater = PAL.sweater, seated = false } = {}) {
    const g = new THREE.Group();
    const legs = seated ? 0.45 : 0.82;
    for (const sx of [-1, 1]) {
      const leg = capsule(0.07, legs - 0.14, PAL.trousers);
      leg.position.set(sx * 0.09, legs / 2, seated ? 0.18 : 0);
      if (seated) leg.rotation.x = Math.PI / 2;
      g.add(leg);
    }
    const torso = capsule(0.17, 0.36, sweater);
    torso.position.y = legs + 0.3;
    g.add(torso);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 10, 20), mat(PAL.muffler));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = legs + 0.6;
    g.add(scarf);
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = capsule(0.05, 0.42, sweater);
      arm.position.set(sx * 0.22, legs + 0.32, 0.02);
      arm.rotation.z = sx * 0.12;
      g.add(arm);
      arms.push(arm);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), mat(PAL.skin, { roughness: 0.7 }));
    head.position.y = legs + 0.74;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.116, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(PAL.cap, { roughness: 0.95 }));
    cap.position.y = legs + 0.75;
    g.add(cap);
    return { g, head, arms, legs };
  }

  // The chaiwala behind the counter, and two men on the bench with their cups.
  const chaiwala = figure({ sweater: '#5a6c88' });
  chaiwala.g.position.set(0.3, 0, -1.95);
  set.add(chaiwala.g);
  for (const [x, sw] of [[-2.1, PAL.sweater2], [-2.6, '#7a7468']]) {
    const f = figure({ sweater: sw, seated: true });
    f.g.position.set(x, 0.12, -0.9);
    set.add(f.g);
  }
  at(rbox(1.5, 0.08, 0.4, PAL.wood, 0.03), -2.35, 0.5, -0.9);
  for (const x of [-2.95, -1.75]) at(rbox(0.08, 0.4, 0.35, PAL.wood, 0.02), x, 0.3, -0.9);

  // The one we follow: steps out of the doorway, to the counter, turns to the street.
  const you = figure();
  set.add(you.g);
  const H = you.legs + 0.74; // head centre height
  const face = new THREE.Group();
  face.position.y = H;
  you.g.add(face);
  const dark = mat('#1d1418', { roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), dark);
    eye.position.set(sx * 0.036, 0.022, 0.097);
    face.add(eye);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.026, 4, 8), mat('#2a1e1e'));
    brow.position.set(sx * 0.037, 0.046, 0.098);
    brow.rotation.z = Math.PI / 2 + sx * 0.12;
    face.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), mat(PAL.skin, { roughness: 0.7 }));
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(sx * 0.108, 0, 0);
    face.add(ear);
  }
  // The nose, and its nostrils: the way in.
  const nose = new THREE.Group();
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 6, 12), mat(PAL.skin, { roughness: 0.7 }));
  bridge.position.set(0, 0.005, 0.106);
  bridge.rotation.x = -0.35;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 16), mat(PAL.skin, { roughness: 0.7 }));
  tip.scale.set(1.15, 0.9, 1);
  tip.position.set(0, -0.022, 0.116);
  nose.add(bridge, tip);
  for (const sx of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 20), new THREE.MeshBasicMaterial({ color: '#120808' }));
    nostril.scale.set(1, 0.68, 1);
    nostril.position.set(sx * 0.009, -0.0385, 0.121);
    nostril.rotation.x = Math.PI / 2 - 0.6;
    nose.add(nostril);
  }
  face.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14, Math.PI * 0.8), dark);
  mouth.position.set(0, -0.058, 0.098);
  mouth.rotation.z = Math.PI + 0.3;
  face.add(mouth);
  // The kulhad in their hand, steaming.
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.085, 14), mat(PAL.kulhad));
  cup.position.set(0.1, you.legs + 0.36, 0.25);
  you.g.add(cup);
  you.arms[1].rotation.set(-1.05, 0, 0.22);
  you.arms[1].position.set(0.18, you.legs + 0.36, 0.12);

  /* ------------------------------------------------------- the auto -- */
  const auto = new THREE.Group();
  const body = rbox(1.25, 0.55, 1.15, PAL.autoGreen, 0.18);
  body.position.set(0.2, 0.62, 0);
  const nosePiece = rbox(0.55, 0.85, 0.75, PAL.autoGreen, 0.2);
  nosePiece.position.set(-0.75, 0.75, 0);
  const canopy = rbox(1.85, 0.16, 1.25, PAL.autoYellow, 0.08);
  canopy.position.set(-0.05, 1.68, 0);
  const back = rbox(0.12, 1.0, 1.2, PAL.autoYellow, 0.05);
  back.position.set(0.82, 1.2, 0);
  for (const sx of [-1, 1]) {
    const post = rbox(0.06, 0.95, 0.06, '#2a2a2e', 0.02);
    post.position.set(-0.92, 1.2, sx * 0.55);
    auto.add(post);
  }
  const seat = rbox(0.5, 0.3, 1.05, '#2a2a2e', 0.08);
  seat.position.set(0.45, 1.0, 0);
  auto.add(body, nosePiece, canopy, back, seat);
  for (const [x, z] of [[-0.95, 0], [0.55, 0.6], [0.55, -0.6]]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 10, 20), mat(PAL.tyre));
    w.position.set(x, 0.24, z);
    auto.add(w);
  }
  const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2d0').multiplyScalar(2.2) }));
  headlamp.position.set(-1.05, 0.95, 0);
  auto.add(headlamp);
  auto.position.set(2.8, 0, 3.0);
  auto.rotation.y = 0.12;
  set.add(auto);

  /* --------------------------------------------- the street beyond, in haze -- */
  // Shopfronts and walls receding along the footpath; across the road, buildings in the smog.
  for (let x = -26; x < 26; x += rr(3, 5.5)) {
    if (Math.abs(x) < 3.2) continue;
    const h = rr(5, 11);
    at(rbox(rr(2.6, 5), h, 4, PAL.building[Math.floor(rand() * PAL.building.length)], 0.1), x, h / 2, -4.2);
    at(rbox(rr(1.2, 2.5), rr(0.4, 0.9), 0.08, PAL.snacks[Math.floor(rand() * PAL.snacks.length)], 0.03), x, rr(2.8, 3.4), -2.15); // a shop sign
  }
  for (let x = -34; x < 34; x += rr(4, 7)) {
    const h = rr(7, 18);
    at(rbox(rr(4, 7), h, 5, PAL.building[Math.floor(rand() * PAL.building.length)], 0.15), x, h / 2, 17 + rr(-1, 2));
  }
  // Sodium lamp, still on in the grey.
  const lampPost = rbox(0.12, 6, 0.12, '#3a3a40', 0.03);
  at(lampPost, 8.5, 3, 1.5); // far down the street, a shape in the smog
  const arm = rbox(1.2, 0.08, 0.08, '#3a3a40', 0.03);
  at(arm, 8.0, 5.95, 1.5);
  const sodium = at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.lamp).multiplyScalar(2.5) })), 7.5, 5.85, 1.5);
  // Overhead wires.
  const wireMat = new THREE.LineBasicMaterial({ color: '#2a2a30', transparent: true, opacity: 0.7 });
  for (let k = 0; k < 6; k++) {
    const y = 5.2 + k * 0.18;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const x = -30 + i * 2;
      pts.push(new THREE.Vector3(x, y - Math.sin((i % 6) / 6 * Math.PI) * 0.35, 1.1 + k * 0.2));
    }
    set.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }

  /* ---------------------------------------------------------- steam -- */
  const steamTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const puffs = [];
  const sources = [[pot, 0.6], [cup, 0.25]];
  for (const [src, k] of sources) {
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      set.add(sp);
      puffs.push({ sp, src, k, ph: i / 10 });
    }
  }
  const wp = new THREE.Vector3();

  /** Living motion: steam rising, the bulb's flicker, the auto's idle. */
  function update(time, still) {
    const t = time * (1 - still);
    for (const p of puffs) {
      const u = (p.ph + t * 0.25) % 1;
      p.src.getWorldPosition(wp);
      set.worldToLocal(wp);
      p.sp.position.set(wp.x + Math.sin(u * 6 + p.ph * 9) * 0.05 * p.k, wp.y + 0.08 + u * 0.7 * p.k, wp.z);
      const s = (0.08 + u * 0.35) * p.k;
      p.sp.scale.set(s, s, s);
      p.sp.material.opacity = Math.sin(u * Math.PI) * 0.45;
    }
    bulb.scale.setScalar(1 + Math.sin(t * 13) * 0.02);
    auto.position.y = Math.sin(t * 40) * 0.004; // idling
    sodium.visible = true;
  }

  return { you, face, nose, H, update };
}
