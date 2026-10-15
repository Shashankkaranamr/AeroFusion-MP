export type Region = "nw" | "north" | "east" | "northeast" | "west" | "central" | "south" | "hill";

export type Landmark =
  | "indiaGate"
  | "gateway"
  | "victoria"
  | "charminar"
  | "vidhana"
  | "gopuram"
  | "taj"
  | "dome"
  | "generic";

export interface City {
  slug: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  /** Long-run mean PM2.5 used by the demo simulator (µg/m³). */
  base: number;
  region: Region;
  coastal: boolean;
  /** Elevation temperature offset (°C). */
  elev: number;
  /** Urban population, millions (approx.). */
  pop: number;
  /** CAAQMS-style monitoring stations represented in the demo. */
  stations: number;
  landmark: Landmark;
}

export const CITIES: City[] = [
  { slug: "delhi", name: "Delhi", state: "NCT of Delhi", lat: 28.6139, lon: 77.209, base: 100, region: "nw", coastal: false, elev: 0, pop: 33.8, stations: 40, landmark: "indiaGate" },
  { slug: "ghaziabad", name: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lon: 77.4538, base: 96, region: "nw", coastal: false, elev: 0, pop: 2.4, stations: 4, landmark: "generic" },
  { slug: "noida", name: "Noida", state: "Uttar Pradesh", lat: 28.5355, lon: 77.391, base: 90, region: "nw", coastal: false, elev: 0, pop: 1.0, stations: 4, landmark: "generic" },
  { slug: "gurugram", name: "Gurugram", state: "Haryana", lat: 28.4595, lon: 77.0266, base: 84, region: "nw", coastal: false, elev: 0, pop: 1.5, stations: 4, landmark: "generic" },
  { slug: "faridabad", name: "Faridabad", state: "Haryana", lat: 28.4089, lon: 77.3178, base: 88, region: "nw", coastal: false, elev: 0, pop: 1.9, stations: 3, landmark: "generic" },
  { slug: "chandigarh", name: "Chandigarh", state: "Chandigarh", lat: 30.7333, lon: 76.7794, base: 50, region: "nw", coastal: false, elev: -1, pop: 1.2, stations: 3, landmark: "generic" },
  { slug: "ludhiana", name: "Ludhiana", state: "Punjab", lat: 30.901, lon: 75.8573, base: 64, region: "nw", coastal: false, elev: 0, pop: 1.8, stations: 2, landmark: "generic" },
  { slug: "amritsar", name: "Amritsar", state: "Punjab", lat: 31.634, lon: 74.8723, base: 60, region: "nw", coastal: false, elev: 0, pop: 1.3, stations: 2, landmark: "dome" },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan", lat: 26.9124, lon: 75.7873, base: 56, region: "west", coastal: false, elev: -1, pop: 4.1, stations: 6, landmark: "dome" },
  { slug: "jodhpur", name: "Jodhpur", state: "Rajasthan", lat: 26.2389, lon: 73.0243, base: 58, region: "west", coastal: false, elev: 0, pop: 1.6, stations: 2, landmark: "generic" },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lon: 80.9462, base: 78, region: "north", coastal: false, elev: 0, pop: 3.9, stations: 6, landmark: "dome" },
  { slug: "kanpur", name: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lon: 80.3319, base: 82, region: "north", coastal: false, elev: 0, pop: 3.2, stations: 4, landmark: "generic" },
  { slug: "agra", name: "Agra", state: "Uttar Pradesh", lat: 27.1767, lon: 78.0081, base: 70, region: "north", coastal: false, elev: 0, pop: 2.0, stations: 3, landmark: "taj" },
  { slug: "varanasi", name: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lon: 82.9739, base: 72, region: "north", coastal: false, elev: 0, pop: 1.7, stations: 3, landmark: "generic" },
  { slug: "patna", name: "Patna", state: "Bihar", lat: 25.5941, lon: 85.1376, base: 84, region: "east", coastal: false, elev: 0, pop: 2.5, stations: 5, landmark: "generic" },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal", lat: 22.5726, lon: 88.3639, base: 56, region: "east", coastal: true, elev: 0, pop: 15.1, stations: 14, landmark: "victoria" },
  { slug: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", lat: 20.2961, lon: 85.8245, base: 42, region: "east", coastal: true, elev: 0, pop: 1.2, stations: 2, landmark: "gopuram" },
  { slug: "guwahati", name: "Guwahati", state: "Assam", lat: 26.1445, lon: 91.7362, base: 52, region: "northeast", coastal: false, elev: 0, pop: 1.1, stations: 3, landmark: "generic" },
  { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lon: 72.5714, base: 50, region: "west", coastal: false, elev: 0, pop: 8.6, stations: 9, landmark: "dome" },
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777, base: 40, region: "west", coastal: true, elev: 0, pop: 21.3, stations: 28, landmark: "gateway" },
  { slug: "pune", name: "Pune", state: "Maharashtra", lat: 18.5204, lon: 73.8567, base: 40, region: "west", coastal: false, elev: -2, pop: 7.2, stations: 8, landmark: "generic" },
  { slug: "nagpur", name: "Nagpur", state: "Maharashtra", lat: 21.1458, lon: 79.0882, base: 46, region: "central", coastal: false, elev: 0, pop: 2.9, stations: 4, landmark: "generic" },
  { slug: "bhopal", name: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lon: 77.4126, base: 46, region: "central", coastal: false, elev: -1.5, pop: 2.4, stations: 3, landmark: "dome" },
  { slug: "indore", name: "Indore", state: "Madhya Pradesh", lat: 22.7196, lon: 75.8577, base: 47, region: "central", coastal: false, elev: -2, pop: 3.3, stations: 3, landmark: "generic" },
  { slug: "raipur", name: "Raipur", state: "Chhattisgarh", lat: 21.2514, lon: 81.6296, base: 52, region: "central", coastal: false, elev: 0, pop: 1.4, stations: 2, landmark: "generic" },
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana", lat: 17.385, lon: 78.4867, base: 38, region: "south", coastal: false, elev: -2, pop: 10.8, stations: 14, landmark: "charminar" },
  { slug: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lon: 83.2185, base: 40, region: "south", coastal: true, elev: 0, pop: 2.2, stations: 3, landmark: "generic" },
  { slug: "bengaluru", name: "Bengaluru", state: "Karnataka", lat: 12.9716, lon: 77.5946, base: 30, region: "south", coastal: false, elev: -6, pop: 13.6, stations: 12, landmark: "vidhana" },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707, base: 28, region: "south", coastal: true, elev: 0, pop: 11.8, stations: 9, landmark: "gopuram" },
  { slug: "kochi", name: "Kochi", state: "Kerala", lat: 9.9312, lon: 76.2673, base: 24, region: "south", coastal: true, elev: 0, pop: 2.2, stations: 3, landmark: "generic" },
  { slug: "thiruvananthapuram", name: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lon: 76.9366, base: 22, region: "south", coastal: true, elev: 0, pop: 1.7, stations: 2, landmark: "gopuram" },
  { slug: "srinagar", name: "Srinagar", state: "Jammu & Kashmir", lat: 34.0837, lon: 74.7973, base: 36, region: "hill", coastal: false, elev: -9, pop: 1.6, stations: 2, landmark: "generic" },
  { slug: "dehradun", name: "Dehradun", state: "Uttarakhand", lat: 30.3165, lon: 78.0322, base: 44, region: "hill", coastal: false, elev: -3, pop: 0.8, stations: 2, landmark: "generic" },
];

export const CITY_BY_SLUG: Record<string, City> = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

export const DEFAULT_CITY = "delhi";

export function getCity(slug: string | null | undefined): City {
  return (slug && CITY_BY_SLUG[slug]) || CITY_BY_SLUG[DEFAULT_CITY];
}

/** Region labels used for spatial attributions (approximate state centroids). */
export const SOURCE_REGIONS = [
  { id: "punjab", name: "Punjab", lat: 30.9, lon: 75.4 },
  { id: "haryana", name: "Haryana", lat: 29.2, lon: 76.3 },
  { id: "west-up", name: "West UP", lat: 28.4, lon: 78.6 },
  { id: "rajasthan", name: "Rajasthan", lat: 27.0, lon: 74.2 },
  { id: "east-up", name: "East UP", lat: 26.4, lon: 82.4 },
  { id: "bihar", name: "Bihar", lat: 25.9, lon: 85.6 },
  { id: "mp", name: "Madhya Pradesh", lat: 23.5, lon: 78.4 },
  { id: "gujarat", name: "Gujarat", lat: 22.6, lon: 71.6 },
  { id: "maharashtra", name: "Maharashtra", lat: 19.6, lon: 75.6 },
  { id: "odisha", name: "Odisha", lat: 20.5, lon: 84.4 },
  { id: "wb", name: "West Bengal", lat: 23.4, lon: 87.8 },
  { id: "telangana", name: "Telangana", lat: 17.9, lon: 79.1 },
  { id: "karnataka", name: "Karnataka", lat: 14.6, lon: 75.9 },
  { id: "tn", name: "Tamil Nadu", lat: 11.1, lon: 78.4 },
  { id: "ap", name: "Andhra Pradesh", lat: 15.9, lon: 79.7 },
  { id: "kerala", name: "Kerala", lat: 10.4, lon: 76.4 },
  { id: "assam", name: "Assam", lat: 26.3, lon: 92.9 },
] as const;
