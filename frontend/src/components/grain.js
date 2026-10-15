import { tokens } from '../tokens.js';
import { el } from '../core/dom.js';

/**
 * Film grain. One noise tile is generated once, then an oversized layer is jumped to a new
 * random offset ~12 times a second (CSS steps, no JS per frame). Static under reduced motion.
 */
export function createGrain() {
  const size = tokens.grain.tile;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    // Mostly transparent; light and dark flecks so grain reads on dark AND lit areas.
    const light = v > 0.5;
    const a = Math.pow(Math.abs(v - 0.5) * 2, 2.2) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);

  const node = el('div', 'grain', { 'aria-hidden': 'true' });
  node.style.backgroundImage = `url(${c.toDataURL('image/png')})`;
  node.style.animationDuration = `${10 / tokens.timing.grainFps}s`;
  return { el: node };
}
