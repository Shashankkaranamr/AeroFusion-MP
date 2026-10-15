import { el } from '../core/dom.js';
import { findSequence } from '../core/assets.js';

/**
 * Scroll-scrubbed WebP frame sequence (made by `npm run frames`, or rendered).
 *
 * Smoothness, in order of what matters:
 *   1. Nothing is ever decoded on the main thread mid-scroll. Frames are fetched once as
 *      compressed bytes (~100 KB each), and a small WINDOW of them around the playhead is
 *      decoded off-thread into ImageBitmaps, reaching further ahead in the direction of travel.
 *      A full sequence decoded at once would be gigabytes; the browser would evict it and then
 *      re-decode inside drawImage — the stall that reads as jitter.
 *   2. Between two frames, both are drawn and cross-faded by the fractional position, so a
 *      24–30 fps render scrubs as a continuous blend instead of stepping frame to frame.
 *   3. The canvas is never larger than the frame itself on screen (no point drawing 1920-pixel
 *      frames into a 5K backing store), which keeps the two full-screen draws per frame cheap.
 *   4. Until a frame is ready, the nearest ready one stands in.
 *
 * anchor: 'center' (default) or 'bottom' — where cover-fit cropping is anchored. Use 'center'
 * whenever something in the frame must line up with something drawn on the page.
 *
 * range: [first, last] — 0-based, inclusive. Use only these frames of the folder (e.g. a scene
 * that needs just the opening of a shared sequence). progress 0..1 spans the range.
 *
 * Drive it from a scene timeline: tl.to(seq.state, { progress: 1 }, at).
 */
const AHEAD = 14; // decoded frames kept ahead of the playhead (in the direction of travel)
const BEHIND = 6;
const DECODES = 3; // concurrent off-thread decodes

export function createFrameSequence({ dir, blend = 'normal', note = '', anchor = 'center', concurrency = 6, range }) {
  const all = findSequence(dir);
  const urls = range ? all.slice(range[0], range[1] + 1) : all;
  const root = el('div', `layer layer--sequence${blend === 'screen' ? ' layer--light' : ''}`, { 'aria-hidden': 'true' });
  const state = { progress: 0 };

  if (!urls.length) {
    const ph = el('div', 'placeholder placeholder--light');
    ph.style.top = '0';
    ph.style.height = '100%';
    ph.append(
      el('span', 'placeholder__label s-tag', {}, `PLACEHOLDER · ${dir}/ frame sequence`),
      el('span', 'placeholder__note s-tag', {}, note),
    );
    root.append(ph);
    return { el: root, state, load() {}, render() {} };
  }

  const canvas = el('canvas', 'layer__media');
  root.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  const n = urls.length;
  const blobs = new Array(n).fill(null); // compressed bytes
  const bitmaps = new Array(n).fill(null); // decoded, ready to draw
  const pending = new Set();
  let frameW = 0;
  let frameH = 0;
  let started = false;
  let drawnKey = '';
  let lastExact = 0;
  let dirn = 1;

  function load() {
    if (started) return;
    started = true;
    let next = 0;
    const worker = () => {
      if (next >= n) return;
      const i = next++;
      fetch(urls[i])
        .then((r) => r.blob())
        .then((b) => {
          blobs[i] = b;
          schedule(); // it may be inside the window
        })
        .catch(() => {})
        .finally(worker);
    };
    for (let k = 0; k < concurrency; k++) worker();
  }

  /** Decode what the window needs; release what it no longer does. */
  function schedule() {
    const c = Math.round(lastExact);
    const lo = Math.max(0, c - (dirn > 0 ? BEHIND : AHEAD));
    const hi = Math.min(n - 1, c + (dirn > 0 ? AHEAD : BEHIND));
    for (let i = 0; i < n; i++) {
      if (bitmaps[i] && (i < lo - 4 || i > hi + 4)) {
        bitmaps[i].close();
        bitmaps[i] = null;
      }
    }
    // Nearest first, so the frame on screen is never the one waiting.
    for (let d = 0; d <= Math.max(AHEAD, BEHIND) && pending.size < DECODES; d++) {
      for (const i of dirn > 0 ? [c + d, c - d] : [c - d, c + d]) {
        if (i < lo || i > hi || bitmaps[i] || pending.has(i) || !blobs[i]) continue;
        if (pending.size >= DECODES) break;
        pending.add(i);
        createImageBitmap(blobs[i])
          .then((bmp) => {
            frameW = bmp.width;
            frameH = bmp.height;
            if (bitmaps[i]) bmp.close();
            else bitmaps[i] = bmp;
            drawnKey = ''; // a better frame may now be available
          })
          .catch(() => {})
          .finally(() => {
            pending.delete(i);
            schedule();
          });
      }
    }
  }

  function nearestReady(i) {
    for (let d = 0; d < n; d++) {
      if (bitmaps[i - d]) return i - d;
      if (bitmaps[i + d]) return i + d;
    }
    return -1;
  }

  function drawCover(bmp, alpha) {
    const w = canvas.width;
    const h = canvas.height;
    const s = Math.max(w / bmp.width, h / bmp.height);
    const dw = bmp.width * s;
    const dh = bmp.height * s;
    const y = anchor === 'bottom' ? h - dh : (h - dh) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bmp, (w - dw) / 2, y, dw, dh);
  }

  function render() {
    // Backing store: device pixels, but never more than one per frame pixel.
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    if (frameW) dpr = Math.min(dpr, Math.max(1, 1 / Math.max(cw / frameW, ch / frameH)));
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingQuality = 'high';
      drawnKey = ''; // resizing clears the canvas
    }

    const exact = Math.min(1, Math.max(0, state.progress)) * (n - 1);
    if (exact !== lastExact) {
      dirn = exact > lastExact ? 1 : -1;
      lastExact = exact;
      schedule();
    }
    const a = Math.floor(exact);
    const b = Math.min(n - 1, a + 1);
    const t = exact - a;

    // Both neighbours ready → blend. Otherwise show the nearest ready frame.
    let key;
    if (bitmaps[a] && bitmaps[b] && t > 0.02 && t < 0.98) {
      key = `${a}:${b}:${t.toFixed(3)}`;
      if (key === drawnKey) return;
      ctx.clearRect(0, 0, w, h);
      drawCover(bitmaps[a], 1);
      drawCover(bitmaps[b], t);
    } else {
      const i = nearestReady(Math.round(exact));
      if (i < 0) return;
      key = String(i);
      if (key === drawnKey) return;
      ctx.clearRect(0, 0, w, h);
      drawCover(bitmaps[i], 1);
    }
    ctx.globalAlpha = 1;
    drawnKey = key;
  }

  return { el: root, state, load, render };
}
