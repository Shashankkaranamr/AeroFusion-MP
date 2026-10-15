import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';
import { hexToRgb01 } from '../core/color.js';
import { motion, isMobile } from '../core/motion.js';

/**
 * THE PARTICLE — a PM2.5 speck, after the NYT "air pollution compare" particle, in orange.
 *
 * A soft, matte dust ball: shaded like a real sphere lit from the top-left, a fine dusty
 * surface texture that slowly turns, and a fuzzy, wispy edge instead of a hard outline.
 * It is not made of visible points and it does not glow from inside.
 *
 * States, tweenable 0..1 on `particle.state`:
 *   loose  the ball dissolves into a hollow cluster of dots in mixed sizes
 *   burst  spark: the ball flashes out and dots fly outward and fade
 *   heat   ignition: the matte surface goes ember → white-hot, lit from inside
 * plus x, y (fractions of the parent box), scale, opacity, glow, float, and keepCore
 * (1 = the burst leaves the body behind as the spark instead of fading it out).
 *
 * Two WebGL passes on one canvas: a full-quad shader for the ball, points for the dots.
 */

/* ---------------------------------------------------------------- body pass -- */

const QUAD_VERT = /* glsl */ `
attribute vec2 aQuad;
varying vec2 vUv;
void main() { vUv = aQuad; gl_Position = vec4(aQuad, 0.0, 1.0); }`;

const BODY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uRadius, uWobble, uBreath, uAlpha, uAA, uHeat;
uniform vec2 uLight;
uniform vec3 uShadow, uBase, uLit, uRim, uSpeck, uHot, uWhite;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }

void main() {
  vec2 p = vUv / uRadius;                 // ball radius = 1
  float r = length(p);
  float t = uTime;
  if (r > 1.6) { gl_FragColor = vec4(0.0); return; }

  // Fuzzy outline: the edge radius wanders with noise around the rim, then falls off softly.
  vec2 dir = p / (r + 1e-5);
  float edgeN = fbm(vec3(dir * 3.0, t * 0.12));
  float edge = 1.0 + uBreath + (edgeN - 0.5) * (0.08 + uWobble * 2.0);
  float core = 1.0 - smoothstep(edge - 0.16, edge + 0.03, r);
  // Wisps: fine fibres that reach past the edge.
  float fibre = smoothstep(0.45, 0.78, fbm(vec3(dir * 8.0, r * 6.0 - t * 0.2)));
  float wisp = (1.0 - smoothstep(edge - 0.08, edge + 0.22, r)) * fibre * 0.4;
  float alpha = max(core, wisp);
  if (alpha < 0.002) { gl_FragColor = vec4(0.0); return; }

  // Sphere normal (clamped so the fuzz outside still gets shaded like the limb).
  float rc = min(r / edge, 0.999);
  vec3 n = normalize(vec3(dir * rc, sqrt(1.0 - rc * rc)));
  vec3 L = normalize(vec3(uLight, 0.75));
  float diff = max(dot(n, L), 0.0);

  // Dusty surface that slowly turns with the ball.
  vec3 m = rotX(0.35) * rotY(t * 0.18) * n;
  float tex = fbm(m * 4.5);
  float grain = noise(m * 38.0);
  float shade = (0.06 + 0.94 * diff) * (0.7 + 0.6 * tex) * (0.86 + 0.28 * grain);

  vec3 col = mix(uShadow, uBase, smoothstep(0.08, 0.7, shade));
  col = mix(col, uLit, smoothstep(0.7, 1.15, shade));
  // Light catching the fuzz on the lit limb.
  float limb = pow(1.0 - n.z, 2.0) * smoothstep(-0.2, 0.8, dot(dir, uLight));
  col = mix(col, uRim, limb * 0.55);

  // Ignition: lit from inside. The surface texture fades, the centre goes white-hot and the
  // fuzz burns ember, so it reads as the same ball catching fire rather than a new object.
  float inner = 1.0 - smoothstep(0.0, edge, r);
  vec3 hot = mix(uHot, uWhite, smoothstep(0.3, 0.9, inner));
  col = mix(col, hot * (0.9 + 0.2 * tex), uHeat * mix(0.85, 1.0, inner));
  alpha = mix(alpha, max(alpha, wisp * 1.6), uHeat);

  float a = alpha * uAlpha;
  gl_FragColor = vec4(col * a, a);
}`;

/* ---------------------------------------------------------------- dots pass -- */

const DOT_VERT = /* glsl */ `
precision highp float;
attribute vec3 aPos;
attribute vec4 aData;                     // x seed, y size, z speck, w shell jitter
uniform float uLoose, uBurst, uRadius, uPointPx, uDots, uHeat, uSpread;
uniform mat3 uRot;
uniform vec3 uShadow, uBase, uLit, uSpeck, uHot;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;

void main() {
  float seed = aData.x;
  vec3 dir = normalize(aPos + vec3(1e-4));
  vec3 p = mix(aPos, dir * (1.25 + aData.w * 0.22), uLoose);   // loose: hollow shell
  p += dir * uBurst * (0.4 + seed * 2.4) * uSpread;            // burst: fly out (uSpread keeps
                                                               // the throw when the core shrinks)
  vec3 q = uRot * p;
  gl_Position = vec4(q.xy * uRadius, 0.0, 1.0);

  float keep = mix(1.0, step(seed, 0.3), uLoose);
  // A burning ball throws fewer, bigger embers than a cold one sheds dust.
  keep *= mix(1.0, step(fract(seed * 7.31), 0.32), uHeat);
  vAlpha = uDots * keep * (1.0 - smoothstep(0.35, 1.0, uBurst) * (0.3 + 0.7 * seed));

  // Flat tones: back dots in shadow, front dots lit, a few specks.
  vec3 col = q.z > 0.0 ? uBase : uShadow;
  if (q.z > 0.45) col = uLit;
  if (aData.z > 0.5) col = uSpeck;
  // Embers thrown by a burning ball are hot: lift them toward the hot core, the brightest most.
  vColor = mix(col, aData.y > 0.6 ? uSpeck : uHot, uHeat * 0.85);

  float looseSize = 1.6 + pow(aData.y, 3.0) * 6.0;
  float burstSize = mix(1.3 + seed * 2.2, 3.0 + pow(aData.y, 2.0) * 6.0, uHeat);
  gl_PointSize = mix(burstSize, looseSize, uLoose) * uPointPx;
  vSoft = uHeat * (1.0 - uLoose);
}`;

const DOT_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
void main() {
  float d = length(gl_PointCoord - 0.5);
  // Crisp flat disc; hot embers get a soft bokeh edge like the video's.
  float a = (1.0 - smoothstep(mix(0.4, 0.16, vSoft), 0.5, d)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

/* ------------------------------------------------------------------ helpers -- */

/** Deterministic RNG so the particle looks the same on every load. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDots(count, speckShare) {
  const rand = mulberry32(25);
  const pos = new Float32Array(count * 3);
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = Math.cbrt(rand());
    pos.set([s * Math.cos(th) * r, u * r, s * Math.sin(th) * r], i * 3);
    data.set([rand(), rand(), rand() < speckShare ? 1 : 0, rand() * 2 - 1], i * 4);
  }
  return { pos, data };
}

function program(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  const u = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(prog, i).name;
    u[name] = gl.getUniformLocation(prog, name);
  }
  return { prog, u };
}

function buffer(gl, prog, name, arr, size) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  return { buf, loc: gl.getAttribLocation(prog, name), size };
}

function bindAll(gl, attrs) {
  for (const { buf, loc, size } of attrs) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function diameterFor(width = window.innerWidth) {
  const d = isMobile() ? tokens.particle.diameterMobile : tokens.particle.diameter;
  return Math.round(Math.min(d.max, Math.max(d.min, (width * d.vw) / 100)));
}

/* ----------------------------------------------------------------- component -- */

/**
 * `diameter` fixes the on-screen size in CSS px (a number, or a function read on resize) for small
 * uses of the same ember — the logo's blob and the cursor. Left out, it follows the story's size.
 */
export function createParticle({ count, diameter: fixed } = {}) {
  const P = tokens.particle;
  const T = P.tones;
  const root = el('div', 'particle', { 'aria-hidden': 'true' });
  const glow = el('div', 'particle__glow');
  const canvas = el('canvas', 'particle__canvas');
  root.append(glow, canvas);

  /** Public, tweenable. x/y are fractions of the parent box. */
  const state = { x: 0.5, y: 0.5, scale: 1, opacity: 1, glow: 1, loose: 0, burst: 0, heat: 0, keepCore: 0, float: 1 };

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  let body, dots, quadAttrs, dotAttrs, n;

  if (gl) {
    body = program(gl, QUAD_VERT, BODY_FRAG);
    dots = program(gl, DOT_VERT, DOT_FRAG);
    quadAttrs = [buffer(gl, body.prog, 'aQuad', new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2)];
    n = count ?? (isMobile() ? P.countMobile : P.count);
    const { pos, data } = buildDots(n, P.speckShare);
    dotAttrs = [buffer(gl, dots.prog, 'aPos', pos, 3), buffer(gl, dots.prog, 'aData', data, 4)];

    const [lx, ly] = P.rimLight;
    const ll = Math.hypot(lx, ly);
    gl.useProgram(body.prog);
    gl.uniform2f(body.u.uLight, lx / ll, ly / ll);
    for (const [prog, names] of [[body, ['uShadow', 'uBase', 'uLit', 'uRim', 'uSpeck']], [dots, ['uShadow', 'uBase', 'uLit', 'uSpeck']]]) {
      gl.useProgram(prog.prog);
      for (const name of names) gl.uniform3fv(prog.u[name], hexToRgb01(T[name.slice(1).toLowerCase()]));
      gl.uniform3fv(prog.u.uHot, hexToRgb01(T.hot));
    }
    gl.useProgram(body.prog);
    gl.uniform3fv(body.u.uWhite, hexToRgb01(T.white));

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied "over": flat paint, not light
    gl.clearColor(0, 0, 0, 0);
  } else {
    root.classList.add('particle--fallback');
  }

  let diameter = 0;
  let box = { w: 1, h: 1 };
  let dpr = 1;

  function resize() {
    diameter = typeof fixed === 'function' ? fixed() : fixed ?? diameterFor();
    const css = diameter * P.canvasScale;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    root.style.setProperty('--d', `${diameter}px`);
    root.style.width = root.style.height = `${css}px`;
    canvas.width = canvas.height = Math.round(css * dpr);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    const parent = root.parentElement;
    box = parent ? { w: parent.clientWidth, h: parent.clientHeight } : box;
  }

  let clock = 0;
  let lastT = null;
  const rotM = new Float32Array(9);

  /** Call every frame while visible. `t` in seconds. */
  function render(t) {
    if (!diameter) resize();
    const dt = lastT === null ? 0 : Math.min(0.1, t - lastT);
    lastT = t;
    clock += dt * motion.timeScale * P.swirlSpeed;

    const css = diameter * P.canvasScale;
    const bob = state.float * (motion.reduced ? 0 : Math.sin(clock * 0.6) * diameter * 0.05);
    const x = state.x * box.w - css / 2;
    const y = state.y * box.h - css / 2 + bob;
    root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    root.style.opacity = String(state.opacity);
    // Matte at rest; burning, the haze becomes real light around the hot core.
    const glowAlpha = (P.glow + (1 - P.glow) * state.heat) * state.glow * (1 - state.loose * 0.7);
    glow.style.opacity = String(Math.min(1, glowAlpha));
    root.style.setProperty('--heat', state.heat.toFixed(3));
    const glowScale = state.scale * (1 + state.burst * 1.6 * (1 - state.keepCore)) * (1 + state.heat * 0.6);
    glow.style.transform = `translate(-50%, -50%) scale(${glowScale.toFixed(3)})`;

    if (!gl || state.opacity <= 0.001) return;

    const radius = (1 / P.canvasScale) * state.scale;
    const bodyAlpha = 1 - Math.max(smooth(0, 0.6, state.loose), smooth(0, 0.3, state.burst) * (1 - state.keepCore));
    const dotAlpha = Math.max(smooth(0, 0.6, state.loose), smooth(0, 0.25, state.burst));
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (bodyAlpha > 0.001) {
      gl.useProgram(body.prog);
      bindAll(gl, quadAttrs);
      const r = radius * (1 + Math.min(1, state.burst) * 0.3 * (1 - state.keepCore));
      gl.uniform1f(body.u.uTime, clock);
      gl.uniform1f(body.u.uRadius, r);
      gl.uniform1f(body.u.uWobble, P.wobble);
      gl.uniform1f(body.u.uBreath, Math.sin(clock * 0.8) * P.breathe);
      gl.uniform1f(body.u.uAlpha, bodyAlpha);
      gl.uniform1f(body.u.uHeat, state.heat);
      gl.uniform1f(body.u.uAA, 1 / (r * canvas.width * 0.5)); // one device pixel, in radius units
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    if (dotAlpha > 0.001) {
      const yaw = clock * 0.12;
      const pitch = 0.35 + Math.sin(clock * 0.21) * 0.15;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      rotM.set([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]); // Rx(pitch)·Ry(yaw)
      gl.useProgram(dots.prog);
      bindAll(gl, dotAttrs);
      gl.uniform1f(dots.u.uLoose, state.loose);
      gl.uniform1f(dots.u.uBurst, state.burst);
      gl.uniform1f(dots.u.uRadius, radius);
      gl.uniform1f(dots.u.uPointPx, dpr * Math.min(1.3, Math.max(0.85, diameter / 80)));
      gl.uniform1f(dots.u.uDots, dotAlpha);
      gl.uniform1f(dots.u.uHeat, state.heat);
      gl.uniform1f(dots.u.uSpread, 1 / Math.max(0.05, Math.min(1, state.scale)));
      gl.uniformMatrix3fv(dots.u.uRot, false, rotM);
      gl.drawArrays(gl.POINTS, 0, n);
    }
  }

  window.addEventListener('resize', resize);

  return { el: root, state, render, resize };
}
