/**
 * THE FIELD — one dot per tenth of a µg/m³, on black.
 *
 * Soft grey dots of mixed sizes (after the NYT air-pollution piece). Every dot answers the pointer
 * with the gravity-well physics of the "gravity stars" reference (references/scene 6), ported to
 * plain JS: a softened inverse-square pull with a tangential swirl, so dots fall in, swirl past and
 * are flung back out, then bleed their momentum and settle into their slow drift.
 *
 * The count is strictly proportional to concentration: n = value ÷ perDot. Phones get a coarser
 * perDot (fewer dots, same proportion) and the legend says so.
 *
 * At the end the same dots are pulled back in, spiralling, to where the ember was — warming to
 * its orange as they pack into one blob. All of them, in one WebGL draw call.
 */

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/* Gravity well — the reference's tuning, unchanged. */
const POINTER_RANGE = 260;
const POINTER_ACCEL = 4_000_000;
const SOFTENING_SQ = 676;
const MAX_ACCEL = 5000;
const MAX_SPEED = 1200;
const SWIRL = 0.85;
const DRAG = 0.03;
const SPRING = 2.2; // our addition: offsets ease home, so the field keeps its shape

const TONES = [[150, 154, 162], [172, 170, 168], [196, 190, 180]];
const EMBER = [255, 138, 61];

function createDotLayer(glCanvas, max) {
  const gl = glCanvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `
    attribute vec2 aPos; attribute float aSize; attribute float aAlpha; attribute float aTone;
    uniform vec2 uRes; uniform float uDpr; varying float vA; varying float vTone;
    void main(){
      vec2 c = aPos / uRes * 2.0 - 1.0;
      gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
      gl_PointSize = aSize * 2.0 * uDpr;
      vA = aAlpha; vTone = aTone;
    }`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `
    precision mediump float; varying float vA; varying float vTone; uniform vec3 uTone[3]; uniform vec3 uEmber;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = d < 0.42 ? mix(1.0, 0.9, d / 0.42) : d < 0.6 ? mix(0.9, 0.35, (d - 0.42) / 0.18) : mix(0.35, 0.0, (d - 0.6) / 0.4);
      a *= vA * step(d, 1.0);
      float t = floor(vTone);                 // integer part: grey tone
      float warm = vTone - t;                 // fraction (0..0.99): how far toward ember
      vec3 c = t < 0.5 ? uTone[0] : t < 1.5 ? uTone[1] : uTone[2];
      c = mix(c, uEmber, clamp(warm / 0.99, 0.0, 1.0));
      gl_FragColor = vec4(c * a, a);
    }`));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const data = new Float32Array(max * 5); // x, y, size, alpha, tone(+warmth)
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  const attr = (name, size, offset) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 20, offset); };
  attr('aPos', 2, 0); attr('aSize', 1, 8); attr('aAlpha', 1, 12); attr('aTone', 1, 16);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uDpr = gl.getUniformLocation(prog, 'uDpr');
  gl.uniform3fv(gl.getUniformLocation(prog, 'uTone'), new Float32Array(TONES.flat().map((v) => v / 255)));
  gl.uniform3fv(gl.getUniformLocation(prog, 'uEmber'), new Float32Array(EMBER.map((v) => v / 255)));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    data,
    draw(count, w, h, dpr, bg) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.clearColor(bg / 255, bg / 255, (bg + 2) / 255, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!count) return;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * 5));
      gl.drawArrays(gl.POINTS, 0, count);
    },
  };
}

export function createField({ canvas, mobile }) {
  const perDot = mobile ? 0.2 : 0.1;
  const MAX = Math.ceil(500 / perDot);
  const dots = createDotLayer(canvas, MAX);

  /* ------------------------------------------------------------- the dots -- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const homeX = new Float32Array(MAX);
  const homeY = new Float32Array(MAX);
  const edgeX = new Float32Array(MAX);
  const edgeY = new Float32Array(MAX);
  const driftX = new Float32Array(MAX);
  const driftY = new Float32Array(MAX);
  const depth = new Float32Array(MAX);
  const phase = new Float32Array(MAX);
  const tone = new Uint8Array(MAX);
  const present = new Float32Array(MAX);
  const ox = new Float32Array(MAX);
  const oy = new Float32Array(MAX);
  const vx = new Float32Array(MAX);
  const vy = new Float32Array(MAX);
  const blobA = new Float32Array(MAX); // where in the blob each dot ends: angle, radius 0..1
  const blobR = new Float32Array(MAX);
  const gatherDelay = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) {
    homeX[i] = rnd();
    homeY[i] = rnd();
    // They arrive from the nearest edge, pushed a little past it.
    const dx = homeX[i] - 0.5;
    const dy = homeY[i] - 0.5;
    const k = 0.75 / Math.max(Math.abs(dx), Math.abs(dy), 1e-3);
    edgeX[i] = 0.5 + dx * k;
    edgeY[i] = 0.5 + dy * k;
    const a = rnd() * TAU;
    const z = rnd() ** 1.6;
    depth[i] = z;
    driftX[i] = Math.cos(a) * (0.002 + z * 0.006);
    driftY[i] = Math.sin(a) * (0.002 + z * 0.006);
    phase[i] = rnd() * TAU;
    tone[i] = Math.min(2, Math.floor(((rnd() + rnd()) / 2) * 3));
    blobA[i] = rnd() * TAU;
    blobR[i] = Math.sqrt(rnd());
    // The nearest come in first; the far ones follow.
    gatherDelay[i] = Math.min(1, Math.hypot(dx, dy) / 0.71) * 0.45 + rnd() * 0.08;
  }

  let W = 1;
  let H = 1;
  let dpr = 1;
  function resize(w, h) {
    W = w;
    H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  /* --------------------------------------------------------------- pointer -- */
  const pointer = { x: 0, y: 0, on: false };
  function setPointer(x, y, on) {
    pointer.x = x;
    pointer.y = y;
    pointer.on = on;
  }

  /* -------------------------------------------------------------- the frame -- */
  let driftT = 0;
  /**
   * value: µg/m³ shown; drift 0..1 (0 = frozen); gather 0..1 (into the blob); warm 0..1 (toward
   * ember); fade 0..1 (the dots hand over to the ember itself); blob: radius px of the blob;
   * reduced: no pointer, no twinkle.
   */
  function render({ value, drift, gather = 0, warm = 0, fade = 0, blob = 30, reduced, time, dt }) {
    if (!dots) return;
    const n = Math.min(MAX, Math.round(value / perDot));
    driftT += dt * drift;
    // As the room fills the black closes up; it opens again as the dots are gathered in.
    const fillUp = Math.min(1, Math.max(0, (value - 60) / 427)) ** 1.4 * (1 - gather);
    const g = Math.round(5 + 46 * fillUp);
    const D = dots.data;
    let drawn = 0;

    const k = Math.min(1, dt * 1.6); // presence eases over ~0.6 s
    const damping = (1 - DRAG) ** (dt * 60);
    const spring = Math.exp(-SPRING * dt);
    const usePointer = pointer.on && !reduced && gather < 0.5;
    const sizeK = (mobile ? 0.82 : 1) * (W / 1920 > 0.5 ? 1 : 0.85);
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < MAX; i++) {
      present[i] += ((i < n ? 1 : 0) - present[i]) * k;
      const pr = present[i];
      if (pr < 0.003) continue;
      const z = depth[i];
      // Home: drifting slowly, wrapping at the edges.
      const hx = ((((homeX[i] + driftX[i] * driftT) % 1) + 1) % 1) * W;
      const hy = ((((homeY[i] + driftY[i] * driftT) % 1) + 1) % 1) * H;
      // Arriving from the edge.
      const e = ease(pr);
      let x = edgeX[i] * W + (hx - edgeX[i] * W) * e;
      let y = edgeY[i] * H + (hy - edgeY[i] * H) * e;
      // Gathered back in: a spiral into the blob.
      let m = 0;
      if (gather > 0) {
        m = easeInOut(clamp01((gather - gatherDelay[i]) / 0.5));
        const a = blobA[i] + (1 - m) * 1.4; // swirl as they come
        const r = blobR[i] * blob;
        const tx = cx + Math.cos(a) * r;
        const ty = cy + Math.sin(a) * r;
        x += (tx - x) * m;
        y += (ty - y) * m;
      }
      // The gravity well.
      if (usePointer) {
        const reach = POINTER_RANGE * (0.6 + z * 0.8);
        const dx = pointer.x - (x + ox[i]);
        const dy = pointer.y - (y + oy[i]);
        const d2 = dx * dx + dy * dy;
        if (d2 < reach * reach) {
          const d = Math.sqrt(d2);
          const soft = Math.sqrt(d2 + SOFTENING_SQ);
          const fade2 = 1 - d / reach;
          const str = Math.min((POINTER_ACCEL * (0.35 + z)) / (soft * soft), MAX_ACCEL) * fade2 * fade2;
          const nx = dx / soft;
          const ny = dy / soft;
          vx[i] += (nx * str - ny * str * SWIRL) * dt;
          vy[i] += (ny * str + nx * str * SWIRL) * dt;
        }
      }
      vx[i] *= damping;
      vy[i] *= damping;
      const sp = vx[i] * vx[i] + vy[i] * vy[i];
      if (sp > MAX_SPEED * MAX_SPEED) {
        const s = MAX_SPEED / Math.sqrt(sp);
        vx[i] *= s;
        vy[i] *= s;
      }
      ox[i] = (ox[i] + vx[i] * dt) * spring;
      oy[i] = (oy[i] + vy[i] * dt) * spring;
      x += ox[i] * (1 - m);
      y += oy[i] * (1 - m);

      const tw = reduced ? 1 : 1 - 0.28 * drift * (1 - Math.sin(time * 1.1 + phase[i])) * 0.5;
      const r = (4.6 + z * 8.4) * sizeK * (1 - m * 0.55);
      const al = (0.5 + z * 0.45) * tw * pr * (1 - fade);
      const o = drawn++ * 5;
      D[o] = x;
      D[o + 1] = y;
      D[o + 2] = r;
      D[o + 3] = Math.min(1, al);
      D[o + 4] = tone[i] + Math.min(0.99, warm * m);
    }
    dots.draw(drawn, W, H, dpr, g);
  }

  return { resize, render, setPointer, perDot };
}
