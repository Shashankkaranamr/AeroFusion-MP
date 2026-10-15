import { tokens } from '../tokens.js';
import { mixHex, lerp } from './color.js';

const MIN_PER_DAY = 1440;

/** "6:40 PM", "18:40", "6 PM" → minutes since midnight. Numbers pass through. */
export function parseClock(value) {
  if (typeof value === 'number') return value;
  const m = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) throw new Error(`Unreadable clock time: "${value}"`);
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

/** minutes → "1:42 PM" */
export function formatClock(minutes) {
  const m = ((Math.floor(minutes) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Minutes between `from` and `to` at progress p. If `to` is earlier than `from` the range
 * runs forward through midnight (11 PM → 2 AM), never backwards. `days` adds whole days on top
 * (1:42 PM → 5:40 PM with days 1 runs 28 hours).
 */
export function clockAt(from, to, p, days = 0) {
  const span = ((((to - from) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY) + days * MIN_PER_DAY;
  return (from + span * p) % MIN_PER_DAY;
}

function sample(keys, minutes, mix) {
  const m = ((minutes % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (m <= t1) return mix(v0, v1, (m - t0) / (t1 - t0 || 1));
  }
  return keys[keys.length - 1][1];
}

/** Background colour for a clock time. */
export function skyAt(minutes) {
  const { sky } = tokens.color;
  return sample(tokens.dayCycle.sky, minutes, (a, b, t) => mixHex(sky[a], sky[b], smooth(t)));
}

/** Horizon-glow strength (0..1) for a clock time. */
export function horizonAt(minutes) {
  return sample(tokens.dayCycle.horizon, minutes, (a, b, t) => lerp(a, b, smooth(t)));
}

const smooth = (t) => t * t * (3 - 2 * t);
