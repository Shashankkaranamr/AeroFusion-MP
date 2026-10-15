/**
 * The radial "dive" wipe of the farm-to-orbit transition (references/new transition from farm,
 * main.js, composite pass, uW2) — the same noise, the same timing, the same output pipeline, so
 * that at full cover this pass draws the transition's frame, and the ride can take over under it.
 *
 * Coordinates are the transition FRAME's (16:9, drawn cover-fit by the frame sequence): uCrop is
 * the visible fraction of that frame on this screen, so the wipe lands on the same pixels.
 * Composited over our image already in display space (after OutputPass).
 */
import { Vector2 } from 'three';

const NOISE = /* glsl */ `
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(0.8,0.6,-0.6,0.8);for(int i=0;i<5;i++){s+=a*vnoise(p);p=m*p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
vec3 s2l(vec3 c){return pow(c,vec3(2.2));}
`;

export const DIVE_WIPE = {
  uniforms: {
    tDiffuse: { value: null },
    uT: { value: 10.6 },
    uW2: { value: 1 },
    uCrop: { value: new Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uT, uW2; uniform vec2 uCrop; varying vec2 vUv;
    ${NOISE}
    vec3 l2s(vec3 c){ c=max(c,0.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
    vec3 shoulder(vec3 c){ vec3 k=0.8+0.2*(1.-exp(-(c-0.8)/0.2)); return mix(c,k,step(0.8,c)); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 fuv = 0.5 + (vUv - 0.5) * uCrop;
      vec2 p = (fuv - 0.5) * vec2(16.0 / 9.0, 1.0);
      float r=length(p); vec2 dir=p/max(r,1e-3);
      float z=log(r+0.03)*2.2-uT*3.2;
      float n=fbm(dir*4.0)*0.55+fbm(vec2(dot(dir,vec2(5.1,2.3)),z))*0.45;
      float n2=fbm(dir*9.0+vec2(3.3,1.1))*0.5+fbm(vec2(dot(dir,vec2(-2.7,7.9)),z*1.6))*0.5;
      float v=(n*0.6+n2*0.25)*0.7+uW2*1.15-0.1-(1.-uW2)*(0.25-r*0.4);
      float m=smoothstep(0.47,0.53,v);
      vec3 ac=mix(s2l(vec3(0.33,0.10,0.33)),s2l(vec3(0.85,0.45,0.75)),clamp(n2*1.3,0.,1.));
      vec3 w = l2s(shoulder(ac));
      float vg = 1.-0.28*pow(length(fuv-.5)*1.35,2.4); w *= vg;
      w += (hash12(gl_FragCoord.xy+fract(uT*7.13)*311.)-0.5)*0.035;
      gl_FragColor = vec4(mix(c, w, m), 1.0);
    }`,
};
