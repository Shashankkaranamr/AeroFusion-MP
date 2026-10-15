import { story } from './story.js';

/**
 * The map the story ends on: India's outline, the 33 cities AeroFusion tracks, and where each
 * city's particles come from.
 *
 * OUTLINE: a simplified hand-traced boundary, [lon, lat], good for a dot map at country scale,
 * following India's official depiction (all of Jammu & Kashmir and Ladakh). Before publishing,
 * replace it with a simplified Survey of India boundary — Indian publications must use the
 * official map.
 */
export const OUTLINE = [
  // West coast, Kutch → Kanyakumari
  [68.4, 23.6], [69.1, 22.4], [69.7, 21.6], [70.4, 20.9], [71.0, 20.7], [72.2, 21.6], [72.6, 22.2], [72.8, 21.1],
  [72.85, 20.0], [72.85, 19.0], [73.1, 17.8], [73.35, 16.8], [73.8, 15.5], [74.1, 14.8], [74.8, 12.9], [75.7, 11.3],
  [76.2, 10.0], [76.9, 8.5], [77.5, 8.1],
  // East coast, north to the Sundarbans
  [78.1, 8.9], [79.3, 9.3], [79.85, 10.3], [79.85, 10.9], [80.25, 13.1], [80.1, 14.6], [81.2, 16.2], [82.3, 16.9],
  [83.3, 17.7], [84.9, 19.3], [85.9, 19.8], [86.7, 20.3], [87.1, 21.2], [87.9, 21.6], [88.9, 21.6],
  // Up the Bangladesh border to the Siliguri neck
  [89.05, 22.4], [88.75, 23.3], [88.55, 24.1], [88.05, 24.6], [88.45, 25.15], [88.95, 25.4], [88.8, 26.0], [88.35, 26.35],
  // The north-east: along Bangladesh's north, round by Tripura and Mizoram, up the Myanmar border
  [89.9, 25.3], [91.1, 25.2], [92.2, 24.9], [91.9, 24.2], [91.65, 23.0], [92.2, 23.6], [92.6, 21.95], [93.2, 22.2],
  [93.4, 23.6], [94.15, 23.85], [94.6, 25.0], [95.2, 26.0], [95.6, 26.7], [96.2, 27.3], [97.3, 27.9],
  // Arunachal's north, back west along Bhutan and Sikkim
  [96.6, 28.6], [96.1, 29.4], [95.4, 29.1], [94.3, 28.9], [93.6, 28.0], [91.65, 27.75], [91.6, 26.85], [90.3, 26.85],
  [89.7, 26.75], [89.0, 26.95], [88.85, 27.1], [88.8, 27.9], [88.1, 27.9], [88.0, 27.2],
  // South of Nepal, west to Uttarakhand
  [88.1, 26.45], [87.3, 26.4], [86.0, 26.6], [85.1, 27.0], [84.1, 27.5], [83.3, 27.35], [82.0, 27.8], [81.0, 28.4],
  [80.5, 28.7], [80.05, 28.95], [80.4, 29.8], [80.95, 30.2],
  // The Himalaya: Himachal, Ladakh, Aksai Chin, the north of Jammu & Kashmir
  [79.4, 30.9], [78.7, 31.6], [78.4, 32.5], [78.9, 33.3], [79.5, 33.2], [80.3, 34.0], [80.2, 35.3], [79.0, 35.8],
  [77.8, 35.6], [77.0, 35.9], [75.5, 36.9], [74.6, 37.05], [73.6, 36.9], [72.5, 36.4],
  // West of Jammu & Kashmir, the Punjab border, Rajasthan, back to Kutch
  [73.3, 35.0], [73.5, 34.3], [73.6, 33.3], [74.1, 32.9], [74.65, 32.5], [74.5, 31.7], [74.6, 31.0], [73.9, 30.4],
  [73.4, 29.95], [72.9, 29.0], [71.9, 27.9], [70.5, 28.0], [69.6, 27.0], [70.1, 26.2], [70.3, 25.6], [69.5, 24.7],
  [68.8, 24.3],
];

/** The 33 cities AeroFusion tracks. [name, lat, lon]. PLACEHOLDER list until the product's is wired. */
export const CITIES = [
  ['Delhi', 28.614, 77.209], ['Gurugram', 28.459, 77.026], ['Noida', 28.535, 77.391], ['Ghaziabad', 28.669, 77.453],
  ['Faridabad', 28.408, 77.317], ['Chandigarh', 30.733, 76.779], ['Ludhiana', 30.901, 75.857], ['Amritsar', 31.634, 74.872],
  ['Dehradun', 30.316, 78.032], ['Jaipur', 26.912, 75.787], ['Jodhpur', 26.238, 73.024], ['Agra', 27.177, 78.008],
  ['Lucknow', 26.847, 80.947], ['Kanpur', 26.449, 80.331], ['Varanasi', 25.318, 82.974], ['Patna', 25.594, 85.138],
  ['Ranchi', 23.344, 85.31], ['Kolkata', 22.573, 88.364], ['Guwahati', 26.144, 91.736], ['Bhubaneswar', 20.296, 85.825],
  ['Raipur', 21.251, 81.63], ['Bhopal', 23.26, 77.413], ['Indore', 22.72, 75.858], ['Ahmedabad', 23.023, 72.571],
  ['Surat', 21.17, 72.831], ['Mumbai', 19.076, 72.878], ['Pune', 18.52, 73.857], ['Nagpur', 21.146, 79.088],
  ['Hyderabad', 17.385, 78.487], ['Visakhapatnam', 17.687, 83.218], ['Bengaluru', 12.972, 77.595], ['Chennai', 13.083, 80.271],
  ['Kochi', 9.931, 76.267],
];

/** Where the stubble burns: the middle of the Punjab–Haryana belt. */
export const FIRE_BELT = { lat: 30.4, lon: 75.6 };
const WIND_TO = 135; // the post-monsoon wind carries smoke toward the southeast (bearing, degrees)

const rad = (d) => (d * Math.PI) / 180;
function distanceKm(aLat, aLon, bLat, bLon) {
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
function bearing(aLat, aLon, bLat, bLon) {
  const y = Math.sin(rad(bLon - aLon)) * Math.cos(rad(bLat));
  const x = Math.cos(rad(aLat)) * Math.sin(rad(bLat)) - Math.sin(rad(aLat)) * Math.cos(rad(bLat)) * Math.cos(rad(bLon - aLon));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

const byName = new Map(CITIES.map((c) => [c[0], c]));

/**
 * Share of a city's PM2.5 that started in a field — fireShare(). PLACEHOLDER MODEL until the
 * API's value is wired: falls off with distance from the fire belt and with how far the city
 * sits off the smoke's downwind path.
 */
export function fireShare(city) {
  const c = byName.get(city);
  if (!c) return 0;
  const [, lat, lon] = c;
  const d = distanceKm(FIRE_BELT.lat, FIRE_BELT.lon, lat, lon);
  const off = Math.abs(((bearing(FIRE_BELT.lat, FIRE_BELT.lon, lat, lon) - WIND_TO + 540) % 360) - 180);
  const downwind = 0.35 + 0.65 * Math.max(0, Math.cos(rad(off)));
  return Math.min(0.42, 0.36 * Math.exp(-d / 600) * downwind * (d < 60 ? 1.2 : 1));
}

/** Fires upwind of a city yesterday — the API's value where we have it, else the model. */
export function firesUpwind(city) {
  return story.fires.upwindOf[city] ?? Math.round(story.fires.total * fireShare(city) * 0.68);
}

/** "roughly 1 in 4" from a share. */
export function oneIn(share) {
  if (share < 0.02) return 'fewer than 1 in 50';
  return `roughly 1 in ${Math.max(2, Math.round(1 / share))}`;
}

/**
 * Where a city's particles come from: the transport arrows. PLACEHOLDER MODEL: fires (above),
 * the wider Indo-Gangetic plain carried in on the wind, and the city's own (traffic, industry,
 * dust, cooking) — the rest.
 */
export function sources(city) {
  const c = byName.get(city);
  const [, lat, lon] = c;
  const fire = fireShare(city);
  const igp = lat > 22 && lon > 74 && lon < 89 ? 0.18 : 0.1; // on the plain, the neighbours' smoke adds up
  const out = [];
  if (fire >= 0.02) out.push({ id: 'fire', label: 'Stubble fires · Punjab & Haryana', share: fire, from: [FIRE_BELT.lat, FIRE_BELT.lon] });
  // Regional: dust and smoke carried in from the west and south-west (the Thar side), a few
  // hundred kilometres out.
  out.push({ id: 'region', label: 'Regional · carried in on the wind', share: igp, from: [lat - 1.6, lon - 3.8] });
  out.push({ id: 'local', label: 'Local · traffic, industry, dust', share: Math.max(0, 1 - fire - igp), from: null });
  return out;
}

/** Point-in-polygon (even–odd), [lon, lat]. */
export function insideIndia(lon, lat) {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const BOUNDS = { lonMin: 68, lonMax: 97.5, latMin: 7.8, latMax: 37.2 };
export { distanceKm };
