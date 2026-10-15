/* Shaders for the Scene 3 world. Same sky as the Scene 2 render (assets/scene2/render/anim.js),
   with a night mix and a city glow added. */

export const SKY_VERT = /* glsl */ `
varying vec3 vP;
void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const SKY_FRAG = /* glsl */ `
varying vec3 vP;
uniform vec3 uHorizon, uMid, uTop, uSun, uGlowCol;
uniform vec3 uSunDir, uGlowDir;
uniform float uSunAmt, uGlowAmt;
void main() {
  float y = vP.y;
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.28, y));
  c = mix(c, uTop, smoothstep(0.28, 0.75, y));
  vec3 hz = normalize(vec3(vP.x, 0.0, vP.z));
  float sun = pow(max(0.0, dot(uSunDir, hz)), 2.0);
  c += uSun * (0.18 + 0.5 * sun) * smoothstep(0.0, 0.16, y) * exp(-y * 7.0) * uSunAmt;
  // A city's light, scattered in its own haze: a low, wide glow on the horizon toward it.
  float g = pow(max(0.0, dot(uGlowDir, hz)), 40.0);
  c += uGlowCol * g * exp(-max(y, 0.0) * 16.0) * uGlowAmt;
  gl_FragColor = vec4(c, 1.0);
}`;

/** Wind streamlines: short streaks that drift downwind forever, wrapped around the camera. */
export const STREAK_VERT = /* glsl */ `
attribute vec4 aSeed;          // x,z in box (0..1), y height (0..1), w phase
attribute float aEnd;          // 0 head, 1 tail
uniform float uTime, uBox, uLen, uSpeed;
uniform vec2 uWind;
uniform vec3 uCenter;
varying float vA;
void main() {
  float phase = fract(aSeed.w + uTime * uSpeed / uBox);
  vec2 p = (aSeed.xz - 0.5) * uBox + uWind * phase * uBox;
  // Wrap into a box around the camera's target so the field never runs out.
  p = mod(p - uCenter.xz + 0.5 * uBox, uBox) - 0.5 * uBox + uCenter.xz;
  p -= uWind * uLen * aEnd;
  vec3 pos = vec3(p.x, 0.35 + aSeed.y * 2.6, p.y);
  float edge = 1.0 - smoothstep(0.3, 0.5, length(p - uCenter.xz) / uBox);
  vA = edge * (1.0 - aEnd) * sin(3.14159 * phase);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

export const STREAK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() { gl_FragColor = vec4(uColor, vA * uOpacity); }`;

/** Glowing points: the river of light, fires, city lights. Soft round sprites, additive. */
export const GLOW_VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;         // rgb, alpha
uniform float uScale;
varying vec4 vC;
void main() {
  vC = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

export const GLOW_FRAG = /* glsl */ `
varying vec4 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 4.0) * vC.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vC.rgb, a);   // additive blending multiplies by a
}`;

/** A city's dome of haze: brown, densest low and at the rim, soft everywhere. */
export const DOME_VERT = /* glsl */ `
varying vec3 vN, vV;
varying float vY;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const DOME_FRAG = /* glsl */ `
uniform vec3 uColor, uGlow;
uniform float uOpacity, uLit;
varying vec3 vN, vV;
varying float vY;
void main() {
  // Haze, not glass: a denser band just inside the silhouette gives the dome its shape, and the
  // very edge fades to nothing, so overlapping domes melt into one.
  float facing = max(dot(normalize(vN), normalize(vV)), 0.0);
  float low = 1.0 - smoothstep(0.0, 1.0, vY);
  float edge = smoothstep(0.0, 0.28, facing);
  float band = 1.0 - smoothstep(0.2, 0.75, facing);
  float a = edge * (0.34 + 0.3 * band + 0.3 * low) * 0.62 * uOpacity;
  // Lit from below by the city.
  vec3 c = mix(uColor, uGlow, uLit * low * 0.6) + uGlow * band * 0.1;
  gl_FragColor = vec4(c, a);
}`;
