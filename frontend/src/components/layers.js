import { el } from '../core/dom.js';
import { findAsset } from '../core/assets.js';

/**
 * One artwork layer of a scene.
 *
 *   kind: 'silhouette' — transparent PNG/WebP, stacked normally, parallaxed by the scene.
 *   kind: 'light'      — image or video on pure black, mix-blend-mode: screen so black vanishes.
 *
 * Real artwork is full-frame (all layers of a scene share one canvas size), bottom-anchored
 * and cropped with object-fit: cover. An optional "<key>-mobile" file is used on portrait
 * screens.
 *
 * Until the file exists, a clearly labelled placeholder rectangle is drawn in the band where
 * the artwork is expected to sit — never an illustration.
 *
 * @param {object} o
 * @param {string} o.key           e.g. "scene1/far"
 * @param {'silhouette'|'light'} [o.kind]
 * @param {string} o.note          what the artwork should show (shown on the placeholder)
 * @param {{top:number,height:number}} [o.band]  placeholder band, viewport fractions
 * @param {string} [o.fill]        placeholder fill (CSS colour; silhouettes)
 * @param {string} [o.tint]        placeholder glow colour (CSS colour; light layers)
 */
export function createLayer({ key, kind = 'silhouette', note = '', band = { top: 0, height: 1 }, fill, tint, className = '' }) {
  const root = el('div', `layer layer--${kind} ${className}`.trim(), { 'aria-hidden': 'true' });
  root.dataset.key = key;
  const asset = findAsset(key);
  const mobile = findAsset(`${key}-mobile`);
  let video = null;

  if (asset?.type === 'video') {
    video = el('video', 'layer__media', {
      muted: '',
      playsinline: '',
      loop: '',
      preload: 'none',
      disablepictureinpicture: '',
    });
    video.muted = true;
    if (mobile?.type === 'video' && matchMedia('(max-aspect-ratio: 4/5)').matches) video.src = mobile.url;
    else video.src = asset.url;
    root.append(video);
  } else if (asset) {
    const picture = el('picture');
    if (mobile?.type === 'image') {
      picture.append(el('source', '', { media: '(max-aspect-ratio: 4/5)', srcset: mobile.url }));
    }
    picture.append(el('img', 'layer__media', { src: asset.url, alt: '', loading: 'lazy', decoding: 'async' }));
    root.append(picture);
  } else {
    const ph = el('div', `placeholder placeholder--${kind}`);
    ph.style.top = `${band.top * 100}%`;
    ph.style.height = `${band.height * 100}%`;
    if (fill) ph.style.background = fill;
    if (tint) ph.style.setProperty('--ph-tint', tint);
    const file = `${key.split('/').pop()}.${kind === 'light' ? 'png | .mp4' : 'png'}`;
    ph.append(
      el('span', 'placeholder__label s-tag', {}, `PLACEHOLDER · ${key.split('/')[0]}/${file}`),
      el('span', 'placeholder__note s-tag', {}, note),
    );
    root.append(ph);
  }

  return { el: root, video, hasAsset: !!asset };
}
