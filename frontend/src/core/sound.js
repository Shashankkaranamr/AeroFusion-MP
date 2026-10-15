/**
 * SOUND — a quiet, generated score (Web Audio; no files). Off until the reader turns it on.
 *
 * It follows the story rather than playing over it: each frame it reads which scene is on screen,
 * how far into it the reader is, and how fast they are scrolling, and eases a handful of layers:
 *
 *   drone     two low, slowly beating tones under everything
 *   wind      filtered noise; rises with altitude, with the ride, and with scroll speed
 *   rumble    deep noise: the fire's roar, the city's body
 *   crackle   short bright noise grains: burning stubble
 *   hum       the city at night (a mains-like low tone), muffled as the ceiling falls
 *   breath    a slow in/out of air (the street); a heartbeat inside the body
 *   shimmer   two soft high tones: the dots, the logo; one chime when the blob lands in the corner
 *
 * Levels are deliberately low: the restraint is the point.
 */
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Target levels (0..1) for a moment of the story. */
function mix({ scene, p, speed }) {
  const m = { drone: 0.5, wind: 0.05, rumble: 0, crackle: 0, hum: 0, breath: 0, heart: 0, shimmer: 0, muffle: 0, windTone: 0.4 };
  switch (scene) {
    case 'particle':
      m.drone = 0.55;
      m.shimmer = 0.15 * (1 - smooth(0.4, 0.55, p));
      m.wind = 0.08 + 0.5 * smooth(0.52, 0.6, p) * (1 - smooth(0.7, 0.85, p)); // the blast's whoosh
      m.rumble = 0.35 * smooth(0.5, 0.6, p) * (1 - smooth(0.7, 0.9, p));
      break;
    case 'spark':
      m.drone = 0.45;
      m.crackle = smooth(0.15, 0.55, p);
      m.rumble = 0.15 + 0.45 * smooth(0.25, 0.8, p);
      m.wind = 0.12 + 0.15 * smooth(0.6, 1, p);
      break;
    case 'ride': {
      const climb = smooth(0.03, 0.13, p) * (1 - smooth(0.13, 0.15, p)); // up through the smoke
      const orbit = smooth(0.14, 0.17, p) * (1 - smooth(0.27, 0.29, p));
      const dive = smooth(0.27, 0.29, p) * (1 - smooth(0.31, 0.37, p));
      m.crackle = 0.6 * (1 - smooth(0, 0.08, p));
      m.rumble = 0.35 * (1 - smooth(0, 0.1, p));
      m.wind = 0.3 + 0.5 * climb + 0.6 * dive - 0.25 * orbit;
      m.windTone = 0.4 + 0.4 * climb + 0.5 * dive;
      m.shimmer = 0.35 * orbit;
      m.drone = 0.5 - 0.2 * orbit;
      if (p > 0.37) { m.wind = 0.42; m.windTone = 0.45; m.hum = 0.12 * smooth(0.85, 1, p); }
      break;
    }
    case 'trap':
      m.drone = 0.4;
      m.hum = 0.25 + 0.4 * smooth(0.05, 0.8, p);
      m.rumble = 0.15 + 0.25 * smooth(0.1, 0.8, p);
      m.wind = 0.15 * (1 - smooth(0.1, 0.6, p)); // the air goes still
      m.muffle = smooth(0.1, 0.82, p); // the room closes in
      { const still = smooth(0.82, 0.88, p); m.hum *= 1 - 0.7 * still; m.rumble *= 1 - 0.6 * still; m.drone *= 1 - 0.5 * still; }
      break;
    case 'breath':
      m.drone = 0.3;
      m.hum = 0.18 * (1 - smooth(0.25, 0.33, p));
      m.breath = 0.55 * (1 - smooth(0.3, 0.36, p)) + 0.35 * smooth(0.36, 0.45, p) * (1 - smooth(0.88, 0.95, p));
      m.muffle = smooth(0.3, 0.4, p);
      m.heart = smooth(0.34, 0.45, p) * (1 - 0.6 * smooth(0.9, 0.97, p));
      break;
    case 'alone':
      m.drone = 0.25 + 0.25 * smooth(0.45, 0.7, p);
      m.shimmer = 0.1 + 0.4 * smooth(0.1, 0.6, p) * (1 - smooth(0.74, 0.8, p)) + 0.35 * smooth(0.8, 0.92, p);
      m.wind = 0.05 + 0.2 * smooth(0.78, 0.88, p) * (1 - smooth(0.9, 0.95, p)); // the gathering rush
      break;
    default:
  }
  // Scrolling fast pushes air.
  m.wind = Math.min(1, m.wind + Math.min(0.35, speed * 0.004));
  return m;
}

export function createSound({ getMoment }) {
  let ctx = null;
  let on = false;
  let L = null; // layer gains and params
  let lastHeart = 0;
  let chimed = false;

  function noiseBuffer(seconds, brown) {
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    const muffle = ctx.createBiquadFilter(); // everything closes in when the room does
    muffle.type = 'lowpass';
    muffle.frequency.value = 18000;
    muffle.connect(master);
    master.connect(ctx.destination);
    const brown = noiseBuffer(4, true);
    const white = noiseBuffer(2, false);
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const gain = (to = muffle) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(to); return g; };

    // drone
    const drone = gain();
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 420; dl.connect(drone);
    for (const [f, a] of [[55, 0.5], [82.6, 0.35], [110.3, 0.12]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(dl); o.start();
    }
    // wind
    const wind = gain();
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.Q.value = 0.6; wf.frequency.value = 500;
    loop(brown).connect(wf).connect(wind);
    // rumble
    const rumble = gain();
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 140;
    loop(brown).connect(rf).connect(rumble);
    // crackle (grains are scheduled per frame)
    const crackle = gain();
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 1800; cf.connect(crackle);
    // hum
    const hum = gain();
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 320; hf.connect(hum);
    for (const [f, a] of [[100, 0.5], [200, 0.18], [150.4, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(hf); o.start();
    }
    // breath: air through a band, its level shaped per frame (in, out)
    const breath = gain();
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 0.9; bf.frequency.value = 900;
    loop(white).connect(bf).connect(breath);
    // heart (thumps scheduled per frame)
    const heart = gain(master); // the heart is not muffled: it is the inside
    // shimmer
    const shimmer = gain();
    for (const [f, a] of [[1318.5, 0.22], [1975.5, 0.12], [659.3, 0.18]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = a;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15 + f / 20000; const lg = ctx.createGain(); lg.gain.value = a * 0.8;
      lfo.connect(lg).connect(og.gain); lfo.start();
      o.connect(og).connect(shimmer); o.start();
    }
    L = { master, muffle, drone, wind, wf, rumble, crackle, cf, hum, breath, heart, shimmer, white };
  }

  function grain(level) {
    const s = ctx.createBufferSource();
    s.buffer = L.white;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const len = 0.008 + Math.random() * 0.03;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level * (0.3 + Math.random() * 0.7), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(g).connect(L.cf);
    s.start(t, Math.random() * 1.5, len + 0.02);
  }
  function thump(level) {
    const t = ctx.currentTime;
    for (const [dt, a] of [[0, 1], [0.24, 0.6]]) { // lub-dub
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(62, t + dt);
      o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(level * a, t + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
      o.connect(g).connect(L.heart);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    }
  }
  function chime() {
    const t = ctx.currentTime;
    for (const [f, a, d] of [[523.25, 0.16, 2.6], [783.99, 0.1, 2.2], [1046.5, 0.06, 1.8]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(L.master);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  const set = (param, v, k = 0.25) => param.setTargetAtTime(v, ctx.currentTime, k);

  /** Call every frame. */
  function update() {
    if (!ctx || !on) return;
    const moment = getMoment();
    const m = mix(moment);
    set(L.drone.gain, 0.06 * m.drone, 0.6);
    set(L.wind.gain, 0.22 * m.wind, 0.25);
    set(L.wf.frequency, 300 + 900 * m.windTone, 0.4);
    set(L.rumble.gain, 0.28 * m.rumble, 0.4);
    set(L.crackle.gain, 0.9 * m.crackle, 0.2);
    set(L.hum.gain, 0.05 * m.hum, 0.5);
    set(L.shimmer.gain, 0.025 * m.shimmer, 0.6);
    set(L.muffle.frequency, 18000 * Math.pow(0.02, m.muffle), 0.5);
    // breathing: ~4.5 s in, out
    const tb = ctx.currentTime / 4.6;
    const cycle = Math.max(0, Math.sin(tb * Math.PI * 2)) ** 1.5 * 0.9 + 0.1;
    set(L.breath.gain, 0.12 * m.breath * cycle, 0.15);
    // crackle grains
    if (m.crackle > 0.02) { const n = Math.random() < m.crackle * 0.9 ? 1 + (Math.random() < m.crackle * 0.4 ? 1 : 0) : 0; for (let i = 0; i < n; i++) grain(0.5 * m.crackle); }
    // heartbeat (~66 bpm)
    if (m.heart > 0.02 && ctx.currentTime - lastHeart > 0.91) { lastHeart = ctx.currentTime; thump(0.5 * m.heart); }
    // the logo lands: once
    const landed = moment.scene === 'alone' && moment.p > 0.985;
    if (landed && !chimed) chime();
    chimed = landed;
  }

  return {
    get on() { return on; },
    async toggle() {
      if (!ctx) build();
      on = !on;
      if (on) await ctx.resume();
      L.master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, on ? 0.6 : 0.2);
      return on;
    },
    /** Silence the story while the dashboard has the page (its own sound is separate). */
    setMuted(m) {
      if (!ctx) return;
      L.master.gain.setTargetAtTime(on && !m ? 0.9 : 0, ctx.currentTime, 0.2);
    },
    /** A moment of the story to sound, for skip: the end, landed. */
    chime() { if (ctx && on) chime(); },
    update,
  };
}
