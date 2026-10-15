import { geoArea } from "d3-geo";
import type { FeatureCollection, Geometry, Position } from "geojson";
import outlineJson from "../../data/geo/india-outline.json";
import statesJson from "../../data/geo/india-states.json";

type Ring = Position[];

/** d3-geo expects clockwise exterior rings; GeoJSON (RFC 7946) uses counter-clockwise. Fix per polygon. */
function rewindPolygon(rings: Ring[]): Ring[] {
  const area = geoArea({ type: "Polygon", coordinates: rings });
  return area > 2 * Math.PI ? rings.map((r) => r.slice().reverse()) : rings;
}

function rewind<P>(fc: FeatureCollection<Geometry, P>): FeatureCollection<Geometry, P> {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const g = f.geometry;
      if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: rewindPolygon(g.coordinates) } };
      if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map(rewindPolygon) } };
      return f;
    }),
  };
}

export const INDIA_STATES = rewind(statesJson as unknown as FeatureCollection<Geometry, { name: string }>);
export const INDIA_OUTLINE = rewind(outlineJson as unknown as FeatureCollection<Geometry>);
