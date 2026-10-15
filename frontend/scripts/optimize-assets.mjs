#!/usr/bin/env node
/**
 * Compress artwork in /assets in place.
 *
 *   npm run optimize               all scenes
 *   npm run optimize -- scene1     one scene
 *
 * PNG/JPG  → WebP (alpha kept), max 2560 px wide, quality 82.
 * MP4/MOV  → H.264 MP4, no audio, max 1920 px wide, CRF 26, faststart (light layers).
 * Originals move to assets/_originals/ (git-ignored, never shipped). Frame-sequence folders
 * (made by `npm run frames`) are skipped.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, extname, dirname, relative, basename } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const ROOT = 'assets';
const only = process.argv[2];
const IMG = new Set(['.png', '.jpg', '.jpeg']);
const VID = new Set(['.mp4', '.mov']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === '_originals') continue;
    if (statSync(p).isDirectory()) {
      // A folder of numbered webps is a frame sequence: already optimized.
      if (readdirSync(p).some((f) => /^\d+\.webp$/.test(f))) continue;
      yield* walk(p);
    } else yield p;
  }
}

const ff = (args) => spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }).status === 0;
const mb = (p) => (statSync(p).size / 1048576).toFixed(2);

function stash(file) {
  const dest = join(ROOT, '_originals', relative(ROOT, file));
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(file, dest);
  return dest;
}

const start = only ? join(ROOT, only) : ROOT;
if (!existsSync(start)) {
  console.error(`Nothing at ${start}`);
  process.exit(1);
}

for (const file of walk(start)) {
  const ext = extname(file).toLowerCase();
  const base = join(dirname(file), basename(file, extname(file)));

  if (IMG.has(ext)) {
    const out = `${base}.webp`;
    const ok = ff(['-i', file, '-vf', "scale='min(2560,iw)':-2:flags=lanczos", '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', out]);
    if (ok) console.log(`${file} (${mb(file)} MB) → ${out} (${mb(out)} MB)`), stash(file);
  } else if (VID.has(ext)) {
    const orig = stash(file);
    const out = `${base}.mp4`;
    const ok = ff(['-i', orig, '-an', '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    if (ok) console.log(`${file} (${mb(orig)} MB) → ${out} (${mb(out)} MB)`);
    else renameSync(orig, file);
  }
}
