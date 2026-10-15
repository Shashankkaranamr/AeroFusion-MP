import { el } from '../core/dom.js';
import { formatClock } from '../core/timeOfDay.js';

const R = 30; // arc radius in viewBox units
const CX = 36;
const BASE = 36;

/**
 * The corner clock: a small arc with a sun (6 AM → 6 PM) or moon (6 PM → 6 AM) travelling
 * left to right along it, and the time in monospace.
 *
 * It is a dumb view: the scene runner passes it the active scene's minutes every frame, and
 * each scene sets its own start/end time (see scene.clock in src/scenes/).
 */
export function createClock() {
  const root = el('div', 'clock s-tag', { 'aria-hidden': 'true' });
  root.innerHTML = `
    <svg class="clock__arc" viewBox="0 0 72 40" width="72" height="40">
      <path class="clock__path" d="M${CX - R} ${BASE} A${R} ${R} 0 0 1 ${CX + R} ${BASE}" />
      <line class="clock__ground" x1="2" y1="${BASE}" x2="70" y2="${BASE}" />
      <circle class="clock__halo" r="6" />
      <circle class="clock__dot" r="2.4" />
    </svg>
    <span class="clock__time"></span>`;
  const halo = root.querySelector('.clock__halo');
  const dot = root.querySelector('.clock__dot');
  const time = root.querySelector('.clock__time');

  let lastMinute = -1;
  let lastVisible = -1;

  function set(minutes, visible = 1) {
    const v = Math.round(visible * 100) / 100;
    if (v !== lastVisible) {
      root.style.opacity = String(v);
      lastVisible = v;
    }
    if (v === 0) return;

    const m = ((minutes % 1440) + 1440) % 1440;
    const day = m >= 360 && m < 1080;
    const t = day ? (m - 360) / 720 : ((m - 1080 + 1440) % 1440) / 720;
    const a = Math.PI * t;
    const x = CX - R * Math.cos(a);
    const y = BASE - R * Math.sin(a);
    dot.setAttribute('cx', x.toFixed(2));
    dot.setAttribute('cy', y.toFixed(2));
    halo.setAttribute('cx', x.toFixed(2));
    halo.setAttribute('cy', y.toFixed(2));
    root.classList.toggle('is-night', !day);

    const whole = Math.floor(m);
    if (whole !== lastMinute) {
      time.textContent = formatClock(whole);
      lastMinute = whole;
    }
  }

  return { el: root, set };
}
