# Scene 0 → Scene 1: the ember becomes a Punjab field fire

One continuous camera move: 360 frames, 1920×1080 (the MP4 plays them at 30 fps, 12 s).

1. **Ember:** the orange dot from the mockup, on `#0b0d14`
2. **Burst:** it explodes into sparks
3. **Fall:** one spark drifts down into dark stubble
4. **Catch:** the straw ignites
5. **Pull back:** the fire spreads, smoke rises, and the dusk world fades in
6. **Drone view:** the final Scene 1 composition

Phase timings, frame ranges, suggested on-screen copy and the colour palette are in `timeline.json`.

## What's in the folder

| Path | Use |
|---|---|
| `aerofusion_s00-s01_1080p30.mp4` | Preview, or drop into Premiere / DaVinci / After Effects |
| `webp/frame_0000.webp … frame_0359.webp` | **Scroll-scrubbed playback on the website** (canvas image sequence) |
| `webp-1280/` | Same 360 frames at 1280×720 for phones (~30 MB total vs ~82 MB) |
| `keyframes/` | 7 key stills for storyboards and design tools |
| `timeline.json` | Machine-readable phases, frames, copy and palette |
| `render/` | The Three.js scene + renderer. Re-render at any size or frame count |

## Using it on the website (smooth scroll scrubbing)

Scroll position picks the frame, drawn on a `<canvas>`. To keep it smooth: preload and decode every frame, ease with `scrub: 1`, don't snap, and blend the two nearest frames. Use **Lenis** for the scroll itself.

```js
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

// 1) smooth scroll, driven by GSAP's ticker so both stay in sync
const lenis = new Lenis({ lerp: 0.08 });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// 2) preload + decode all frames before the section becomes interactive
const N = 360, small = innerWidth < 900;
const src = (i) => `/seq/s01${small ? "-1280" : ""}/frame_${String(i).padStart(4, "0")}.webp`;
const imgs = Array.from({ length: N }, (_, i) => Object.assign(new Image(), { src: src(i) }));
await Promise.all(imgs.map((im) => im.decode()));

// 3) canvas sized to its display size
const canvas = document.querySelector("#s01"), ctx = canvas.getContext("2d");
const fit = () => { const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2); canvas.width = r.width * d; canvas.height = r.height * d; draw(); };

// 4) blend neighbouring frames, no snapping
const state = { f: 0 };
function draw() {
  const i = Math.min(N - 1, Math.floor(state.f)), a = state.f - i;
  ctx.globalAlpha = 1; ctx.drawImage(imgs[i], 0, 0, canvas.width, canvas.height);
  if (a > 0.001 && imgs[i + 1]) { ctx.globalAlpha = a; ctx.drawImage(imgs[i + 1], 0, 0, canvas.width, canvas.height); }
}
addEventListener("resize", fit); fit();

gsap.to(state, {
  f: N - 1, ease: "none", onUpdate: draw,
  scrollTrigger: { trigger: "#scene-01", start: "top top", end: "+=350%", scrub: 1, pin: true },
});
```

- Fade the copy for each phase in and out using the frame ranges in `timeline.json`.
- Put `webp/` in `/seq/s01/` and `webp-1280/` in `/seq/s01-1280/`.
- Don't scrub the MP4 in a `<video>` element; seeking is jittery. It's for previews and video editors.

## Using it in video or motion tools
- **After Effects / Premiere / DaVinci:** import the MP4, or render a lossless PNG sequence (below) and import it as an image sequence at 30 fps.
- **Spline / Rive / Figma:** use the stills in `keyframes/`.

## Re-rendering (any resolution, any frame count)
The scene is deterministic: frame = `renderAt(t)` with `t` from 0 to 1, so motion is identical at any frame count.

```bash
cd render
npm i three@0.170.0 playwright
npx playwright install chromium
python -m http.server 8765            # in one terminal
python frames.py out --range 360 0 360   # PNG frames, 1920×1080
```

Change resolution with `anim.html?w=1280&h=720`, and set the viewport to match in `frames.py`. If you change the frame count (e.g. `--range 600 0 600`), the motion stays the same and just gets smoother.

## Tweaking the scene (`render/anim.js`)
- **Timing:** the `T` object at the top, plus `worldF` (world fade-in) and `fireP` (fire spread).
- **Camera path:** the `OFFK` keyframes and `targetAt()`.
- **Smoke shape:** `lumpGeo()` (lumpiness) and `addPlume()` (size and lean).
- **Colours:** listed in `timeline.json → style.palette` and set in the code.
