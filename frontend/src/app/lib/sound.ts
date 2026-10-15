/**
 * The dashboard's sound: off by default, and sparing when on (Apple › multimodal feedback:
 * causality, harmony, utility). Procedural, like the story's score — no files:
 *   tick   a soft, short wooden tick on a meaningful press (tab, toggle, preset)
 *   chime  two quiet notes when something lands (a refresh, an answer)
 *   air    a faint, slow wind bed while the sound is on — the story's air, turned down
 * The setting is remembered on this device.
 */
const KEY = "aerofusion:sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let on = false;
const listeners = new Set<(on: boolean) => void>();

try {
  on = localStorage.getItem(KEY) === "on";
} catch {
  /* private mode */
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // brown noise: soft, low, like distant wind
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.2;
  }
  return b;
}

function startBed() {
  const c = ensure();
  if (bed || !master) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 6);
  src.loop = true;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420;
  band.Q.value = 0.6;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 2.5);
  src.connect(band).connect(gain).connect(master);
  src.start();
  bed = { src, gain };
}

function stopBed() {
  if (!bed || !ctx) return;
  const b = bed;
  b.gain.gain.cancelScheduledValues(ctx.currentTime);
  b.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  setTimeout(() => b.src.stop(), 1200);
  bed = null;
}

export const sound = {
  get on() {
    return on;
  },
  async set(next: boolean) {
    on = next;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* private mode */
    }
    if (next) {
      await ensure().resume();
      startBed();
      this.chime();
    } else stopBed();
    listeners.forEach((f) => f(on));
  },
  /** Resume after a reload once the reader interacts (browsers need a gesture to start audio). */
  wakeOnGesture() {
    if (!on) return;
    const go = () => {
      ensure().resume().then(startBed);
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
  },
  subscribe(f: (on: boolean) => void) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
  tick() {
    if (!on || !ctx || !master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1250, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.08);
  },
  chime() {
    if (!on || !ctx || !master) return;
    const t = ctx.currentTime;
    [659.25, 987.77].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const s = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.05, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.9);
      o.connect(g).connect(master!);
      o.start(s);
      o.stop(s + 1);
    });
  },
};
