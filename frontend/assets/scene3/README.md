# Scene 3 opening: farm → orbit (frame sequence)

`rise/frame_0000.webp … frame_0318.webp` are 1920×1080 at 30 fps. `rise-1280/` holds the same frames at 1280×720 for phones. Together they make the 10.6 s opening of Scene 3.

The frames come from two renders, joined where a full-screen wipe hides the cut:

| Frames | Seconds | Source |
|---|---|---|
| 0–147 | 0 – 4.9 | **Scene 2's own render** (`assets/scene2/render/anim.js`), extended past its last frame. The fire keeps burning and the smoke keeps billowing while the camera follows the new transition's farm climb (`poseA`) from Scene 2's final camera. It climbs over a plain of fires and ends under the transition's **cloud wipe**. |
| 148–318 | 4.9 – 10.6 | **The new transition** (`references/new transition from farm`), re-rendered at 1920×1080: the orbit, with the satellite finding the fire. It ends under the transition's **dive wipe**. |

## Why the joins are invisible

- **Frame 0 is Scene 2's last frame.** The extension starts from Scene 2's final camera and fire state. Against the shipped `scene2/webp/frame_0359.webp` it measures 47 dB PSNR with grain blurred out, i.e. visually identical.
- **Frame 147 is a full-screen cloud, drawn identically by both renders.** The extension's wipe pass is the transition's own shader and output pipeline, at the same moment. It measures 94 dB PSNR against the transition rendered at that moment, so the pixels match.
- **Frame 318 is the dive wipe at full cover.** The live ride (`src/scenes/ride/diveWipe.js`) draws the same wipe at the same moment, then clears it to reveal the ride.

## Re-rendering

1. Render the extension with `renderExt(e)` for e = i/30, i = 0…147. It is in `assets/scene3/render/anim.js` (Scene 2's `anim.js`, extended), which adds `renderExt`, extra far fire sites, a field patchwork that fades in with altitude, and height-scaled fog and sky.
2. Render the transition with `renderAt(t)` for t = i/30, i = 148…318.
3. Capture both with page screenshots at 1920×1080. Encode as WebP at quality 72, and make the 1280×720 set at quality 80.
