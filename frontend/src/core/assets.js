/**
 * Artwork lookup.
 *
 * Everything under /assets is discovered at build time. A scene asks for a key like
 * "scene1/far" and gets the best file that exists, or null — in which case it draws a
 * labelled placeholder. Dropping a file into /assets/sceneN/ is all it takes to replace one.
 *
 * Preference: video (light layers) → avif → webp → png → jpg. So once `npm run optimize`
 * has produced far.webp, the PNG original is no longer what ships.
 */

const files = import.meta.glob(
  [
    '/assets/**/*.{png,webp,avif,jpg,jpeg,mp4,webm}',
    '!/assets/_originals/**',
    // Delivered alongside renders but never shown on the page: keep them out of the build.
    '!/assets/**/keyframes/**',
    '!/assets/**/render/**',
    '!/assets/**/contact_sheet*',
    '!/assets/scene2/*.mp4',
  ],
  { eager: true, query: '?url', import: 'default' },
);

const ORDER = ['webm', 'mp4', 'avif', 'webp', 'png', 'jpg', 'jpeg'];
const VIDEO = new Set(['webm', 'mp4']);

/** "scene1/far" → { webp: url, png: url } */
const byKey = new Map();
for (const [path, url] of Object.entries(files)) {
  const rel = path.replace(/^\/assets\//, '');
  const dot = rel.lastIndexOf('.');
  const key = rel.slice(0, dot);
  const ext = rel.slice(dot + 1).toLowerCase();
  if (!byKey.has(key)) byKey.set(key, {});
  byKey.get(key)[ext] = url;
}

/**
 * @param {string} key e.g. "scene1/fire"
 * @param {{ prefer?: 'image' | 'video' }} [opts]
 * @returns {{ url: string, type: 'image' | 'video', ext: string } | null}
 */
export function findAsset(key, { prefer } = {}) {
  const found = byKey.get(key);
  if (!found) return null;
  const order =
    prefer === 'image' ? ORDER.filter((e) => !VIDEO.has(e)).concat([...VIDEO]) : ORDER;
  for (const ext of order) {
    if (found[ext]) return { url: found[ext], ext, type: VIDEO.has(ext) ? 'video' : 'image' };
  }
  return null;
}

/**
 * Frame sequence written by `npm run frames` — e.g. "scene3/transition" →
 * [".../transition/0001.webp", ...] in order. Also takes renders named frame_0000.webp….
 * Empty array if none.
 */
export function findSequence(dir) {
  const prefix = `${dir.replace(/\/$/, '')}/`;
  return [...byKey.keys()]
    .filter((k) => k.startsWith(prefix) && /^(frame_)?\d+$/.test(k.slice(prefix.length)))
    .sort()
    .map((k) => findAsset(k, { prefer: 'image' }).url);
}
