"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import { categoryForPm } from "@/lib/aqi";
import { INDIA_OUTLINE } from "@/lib/geo/india";
import { cn } from "@/lib/utils";
import { WindFlow, type InflowLink } from "./wind-flow";

// The bundler can't serve MapLibre's module worker, so serve a copy from /public.
if (typeof window !== "undefined") setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type Basemap = "satellite" | "dark" | "light";

export interface RealMapCity {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  pm25: number | null;
  wind: number | null;
  windDir: number | null;
}

export interface RealMapFire {
  lat: number;
  lon: number;
  frp: number;
  confidence: string;
}

const ESRI_ATTR = "Labels & basemap: Esri, HERE, Garmin, © OpenStreetMap contributors";

function rasterStyle(id: string, tiles: string, attribution: string, bg: string, labels?: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: id === "gibs" ? 9 : 18, attribution },
      ...(labels ? { labels: { type: "raster" as const, tiles: [labels], tileSize: 256, attribution: ESRI_ATTR } } : {}),
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": bg } },
      { id, type: "raster", source: id },
      ...(labels ? [{ id: "labels", type: "raster" as const, source: "labels", paint: { "raster-opacity": 0.9 } }] : []),
    ],
  };
}

function gibsDate() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function satelliteStyle(): StyleSpecification {
  return rasterStyle(
    "gibs",
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    "Imagery: NASA GIBS / Worldview (VIIRS S-NPP)",
    "#06101f",
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  );
}

const STYLES: Record<Basemap, () => StyleSpecification> = {
  satellite: satelliteStyle,
  dark: () => rasterStyle("esri", "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", ESRI_ATTR, "#0b0f19", "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"),
  light: () => rasterStyle("esri", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", ESRI_ATTR, "#e8eef3"),
};

export function RealMap({
  cities,
  fires,
  basemap,
  heat = true,
  showFires = true,
  wind = true,
  labels = true,
  aod = false,
  links = false,
  onLinks,
  selected,
  onSelect,
  className,
}: {
  cities: RealMapCity[];
  fires: RealMapFire[];
  basemap: Basemap;
  heat?: boolean;
  showFires?: boolean;
  wind?: boolean;
  labels?: boolean;
  aod?: boolean;
  /** animated transport arrows into the selected city (needs wind) */
  links?: boolean;
  onLinks?: (l: InflowLink[]) => void;
  selected?: string;
  onSelect?: (slug: string) => void;
  className?: string;
}) {
  const ref = useRef<MapRef>(null);
  const style = useMemo(() => STYLES[basemap](), [basemap]);

  const cityGeo = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: cities
        .filter((c) => c.pm25 !== null)
        .map((c) => ({ type: "Feature", properties: { pm25: c.pm25, slug: c.slug }, geometry: { type: "Point", coordinates: [c.lon, c.lat] } })),
    }),
    [cities],
  );
  const fireGeo = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: fires.map((f) => ({ type: "Feature", properties: { frp: f.frp, high: f.confidence === "high" ? 1 : 0 }, geometry: { type: "Point", coordinates: [f.lon, f.lat] } })),
    }),
    [fires],
  );

  // fly to the selected city
  useEffect(() => {
    const c = cities.find((x) => x.slug === selected);
    if (c && ref.current) ref.current.flyTo({ center: [c.lon, c.lat], zoom: Math.max(ref.current.getZoom(), 5.2), duration: 1400, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to selection changes
  }, [selected]);

  return (
    <div className={cn("relative size-full", className)}>
      <Map
        ref={ref}
        initialViewState={{ longitude: 80.5, latitude: 22.5, zoom: 3.9 }}
        minZoom={3}
        maxZoom={11}
        mapStyle={style}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
      >
        <NavigationControl position="bottom-left" showCompass={false} />

        {aod && (
          <Source
            id="aod"
            type="raster"
            tiles={[`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol/default/${gibsDate()}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`]}
            tileSize={256}
            maxzoom={6}
          >
            <Layer id="aod-layer" type="raster" paint={{ "raster-opacity": 0.65 }} />
          </Source>
        )}

        <Source id="india" type="geojson" data={INDIA_OUTLINE}>
          <Layer id="india-glow" type="line" paint={{ "line-color": "#5eead4", "line-width": 6, "line-opacity": 0.15, "line-blur": 4 }} />
          <Layer id="india-line" type="line" paint={{ "line-color": "#99f6e4", "line-width": 1.2, "line-opacity": 0.75 }} />
        </Source>

        {heat && (
          <Source id="pm" type="geojson" data={cityGeo}>
            <Layer
              id="pm-heat"
              type="heatmap"
              paint={{
                "heatmap-weight": ["interpolate", ["linear"], ["get", "pm25"], 0, 0, 30, 0.25, 60, 0.5, 120, 0.85, 250, 1],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 1, 8, 2.2],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 38, 6, 90, 9, 180],
                "heatmap-opacity": 0.6,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(0,0,0,0)",
                  0.15,
                  "rgba(16,185,129,0.55)",
                  0.35,
                  "rgba(132,204,22,0.7)",
                  0.55,
                  "rgba(234,179,8,0.8)",
                  0.75,
                  "rgba(249,115,22,0.85)",
                  0.9,
                  "rgba(239,68,68,0.9)",
                  1,
                  "rgba(162,28,175,0.95)",
                ],
              }}
            />
          </Source>
        )}

        {showFires && (
          <Source id="fires" type="geojson" data={fireGeo}>
            <Layer
              id="fire-glow"
              type="circle"
              paint={{ "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 9], "circle-color": "#ff6a00", "circle-opacity": 0.35, "circle-blur": 1 }}
            />
            <Layer
              id="fire-dot"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 8, 3.5],
                "circle-color": ["case", ["==", ["get", "high"], 1], "#ffd166", "#ff8c42"],
                "circle-opacity": 0.95,
              }}
            />
          </Source>
        )}

        {wind && <WindFlow cities={cities} selected={selected} showLinks={links} onLinks={onLinks} />}

        {cities.map((c) => {
          if (c.pm25 === null) return null;
          const cat = categoryForPm(c.pm25);
          const isSel = c.slug === selected;
          return (
            <Marker key={c.slug} longitude={c.lon} latitude={c.lat} anchor="center" onClick={(e) => (e.originalEvent.stopPropagation(), onSelect?.(c.slug))}>
              <button className="group relative flex items-center" aria-label={c.name}>
                <span
                  className={cn("relative block rounded-full ring-2 ring-white transition-transform group-hover:scale-125", isSel ? "size-4" : "size-3")}
                  style={{ background: cat.color, boxShadow: `0 0 12px ${cat.color}` }}
                />
                {(labels || isSel) && (
                  <span
                    className={cn(
                      "ml-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-lg",
                      isSel ? "bg-white text-slate-900" : "bg-black/55 text-white backdrop-blur-sm",
                    )}
                  >
                    {c.name} <span className="font-num opacity-80">{Math.round(c.pm25)}</span>
                  </span>
                )}
              </button>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
