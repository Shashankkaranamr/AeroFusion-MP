#!/usr/bin/env node
/**
 * Video → compressed WebP frame sequence for scroll scrubbing.
 *
 *   npm run frames -- assets/scene3/transition.mp4
 *   npm run frames -- assets/scene3/transition.mp4 --fps 24 --width 1600 --quality 70
 *   npm run frames -- assets/scene2/clip.mp4 --start 28 --name sequence
 *
 * --start N   skip the first N frames of the source (frame-accurate)
 * --name X    output folder name (default: the video's file name)
 *
 * Writes assets/scene3/transition/0001.webp … and moves the source video to
 * assets/_originals/ so it isn't shipped. Use in a scene with:
 *   createFrameSequence({ dir: 'scene3/transition' })
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, basename, extname, join, relative } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
if (!input) {
  console.error('Usage: npm run frames -- <video> [--fps 24] [--width 1600] [--quality 70] [--keep]');
  process.exit(1);
}

const fps = Number(opt('fps', 24));
const width = Number(opt('width', 1600));
const quality = Number(opt('quality', 70));
const start = Number(opt('start', 0));
const outDir = join(dirname(input), opt('name', basename(input, extname(input))));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const run = spawnSync(
  ffmpeg,
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-an',
    '-vf', `trim=start_frame=${start},setpts=PTS-STARTPTS,fps=${fps},scale='min(${width},iw)':-2:flags=lanczos`,
    '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', '-preset', 'picture',
    join(outDir, '%04d.webp'),
  ],
  { stdio: 'inherit' },
);
if (run.status !== 0) process.exit(run.status ?? 1);

const frames = readdirSync(outDir).filter((f) => f.endsWith('.webp'));
const bytes = frames.reduce((s, f) => s + statSync(join(outDir, f)).size, 0);
console.log(`${frames.length} frames → ${relative('.', outDir)}  (${(bytes / 1048576).toFixed(1)} MB total)`);

if (!args.includes('--keep')) {
  const dest = join('assets', '_originals', relative('assets', input));
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(input, dest);
  console.log(`source moved → ${dest}`);
}
