import type { ReactNode } from "react";
import { add, Box, Disc, Face, iso, Line, Part, route, up, W, Wire, Beam, Globe, type P2, type P3 } from "./iso";
import {
  Attention, Bubbles, Cabinet, Cards, Chip, Clock, ConvGrid, Drum, GroundDish, Hub, Laptop, LeadBars, MapPlate, ModelGraph,
  Padlock, Person, Phone, RankScatter, Satellite, Server, Sheet, Shield, Slab, Station, Supercomputer, WaveletBands,
} from "./parts";

/**
 * The four stages of the pipeline as isometric scenes. Every scene spans x −600…600 and has the trunk
 * (the wire that runs through all four pages) at y = TRUNK_Y, running EXT past both sides; the page
 * scales each scene so its trunk lands on the same screen line, so side by side they join into one wire.
 */

export const VB_X = -600;
export const VB_W = 1200;
export const TRUNK_Y = 520;
/** How far the trunk runs past the frame on each side, so it reaches the screen's edges. */
export const EXT = 1400;

export interface LegendItem {
  n: number;
  title: string;
  body: string;
  /** Live source id whose health is shown beside the item. */
  source?: string;
  /** Exact settings from the code, shown as chips. */
  spec?: string[];
}

export interface Scene {
  id: "sources" | "fusion" | "tensor" | "explanation";
  step: string;
  title: string;
  lede: string;
  /** Top of the frame (y); the frame is x −600…600, y top…top + height. */
  top: number;
  height: number;
  legend: LegendItem[];
  draw: (k: string) => ReactNode;
}

const trunkIn = (to: P3 | P2): (P2 | P3)[] => {
  const t = Array.isArray(to) && to.length === 3 ? iso(to as P3) : (to as P2);
  return [[VB_X - EXT, TRUNK_Y], [t[0] - 40, TRUNK_Y], to];
};
const trunkOut = (from: P3 | P2): (P2 | P3)[] => {
  const f = from.length === 3 ? iso(from as P3) : (from as P2);
  return [from, [f[0] + 40, TRUNK_Y], [VB_X + VB_W + EXT, TRUNK_Y]];
};

/* ================================================================== 01 · Sources ================= */

function sources(k: string) {
  const V = (sx: number, sy: number, z = 0) => W(sx, sy + (-110), z);
  const s1 = V(-470, 0, 380);
  const s2 = V(-200, -40, 400);
  const s3 = V(40, -10, 390);
  const dish = V(-320, 300);
  const feed = up(add(dish, [-6, -10, 0]), 72);
  const firms = V(-215, 360);
  const gibs = V(-90, 395);
  const ecmwf = V(110, 235);
  const gfs = V(300, 240);
  const om = V(205, 345);
  const metno = V(355, 315);
  const st = [V(-505, 470), V(-430, 525), V(-345, 575)];
  const xkdr = V(-175, 520);
  const clock = V(55, 575);
  const hub = V(380, 455);
  const hw = 110;
  const hd = 80;
  // the hub's input ports on its left (+y) face, at ground level in front of it
  const port = (i: number): P3 => [hub[0] + 12 + ((hw - 24) * i) / 5, hub[1] + hd + 26, 0];
  const portUp = (i: number): P3 => [hub[0] + 12 + ((hw - 24) * i) / 5, hub[1] + hd, 19];
  const into = (i: number, from: P3, yFirst = false): (P2 | P3)[] => [...route(from, port(i), yFirst), portUp(i)];
  const out: P3 = [hub[0] + hw, hub[1] + hd / 2, 22];
  const sat = (s: P3): P3 => [s[0] + 13, s[1] + 13, s[2] - 10];

  return (
    <g>
      {/* links first: they run under everything */}
      <Beam id={`${k}b1`} from={sat(s1)} to={feed} />
      <Beam id={`${k}b2`} from={sat(s2)} to={feed} dur={2.9} />
      <Beam id={`${k}b3`} from={sat(s3)} to={feed} dur={3.2} />
      <Wire id={`${k}w1`} pts={route(add(dish, [0, 34, 0]), add(firms, [22, 0, 0]), true)} dur={3} />
      <Wire id={`${k}w2`} pts={route(add(dish, [34, 0, 0]), add(gibs, [22, 0, 0]))} dur={3.4} />
      <Wire id={`${k}w3`} pts={route(add(ecmwf, [40, 40, 0]), add(om, [0, 22, 0]), true)} dur={3} />
      <Wire id={`${k}w4`} pts={route(add(gfs, [22, 44, 0]), add(om, [44, 22, 0]), true)} dur={3.2} />
      {st.map((p, i) => (
        <Wire key={i} id={`${k}st${i}`} pts={route(add(p, [40, 13, 0]), add(xkdr, [0, 22, 0]))} dur={3.6} packets={1} />
      ))}
      <Wire id={`${k}h0`} pts={into(0, add(firms, [44, 22, 0]), true)} dur={4.6} />
      <Wire id={`${k}h1`} pts={into(1, add(gibs, [44, 22, 0]), true)} dur={4.2} packets={1} />
      <Wire id={`${k}h2`} pts={into(2, add(xkdr, [44, 22, 0]))} dur={4.4} />
      <Wire id={`${k}h3`} pts={into(3, add(om, [22, 44, 0]), true)} dur={3.4} packets={3} />
      <Wire id={`${k}h4`} pts={into(4, add(clock, [0, -30, 0]), true)} dur={3} packets={1} />
      <Wire id={`${k}h5`} pts={into(5, add(metno, [22, 44, 0]), true)} dashed />
      <Wire id={`${k}trunk`} pts={trunkOut(out)} packets={9} dur={9} ember />

      {/* the sky */}
      <Part n={1} at={add(s1, [13, 13, 30])}>
        <Satellite o={s1} bob={0} />
      </Part>
      <Part n={2} at={add(s2, [13, 13, 30])}>
        <Satellite o={s2} bob={1.5} />
      </Part>
      <Part n={3} at={add(s3, [13, 13, 30])}>
        <Satellite o={s3} bob={3} wing={60} />
      </Part>
      <Part n={7} at={up(add(ecmwf, [40, 20, 0]), 160)} lead={22}>
        <Supercomputer o={ecmwf} />
        <Globe c={up(add(ecmwf, [44, 20, 0]), 128)} r={30} />
      </Part>
      <Part n={8} at={up(add(gfs, [22, 22, 0]), 70)}>
        <Server o={gfs} h={66} units={4} />
      </Part>
      <Part n={10} at={up(add(metno, [22, 22, 0]), 74)}>
        <Server o={metno} h={70} units={4} tone="mid" />
      </Part>

      {/* the ground, far to near */}
      <Part n={4} at={up(dish, 112)}>
        <GroundDish o={dish} />
      </Part>
      <Part n={5} at={up(add(firms, [22, 22, 0]), 94)}>
        <Server o={firms} />
      </Part>
      <Part n={9} at={up(add(om, [22, 22, 0]), 94)}>
        <Server o={om} units={5} />
      </Part>
      <Part n={6} at={up(add(gibs, [22, 22, 0]), 80)}>
        <Server o={gibs} h={76} units={4} />
      </Part>
      {st.map((p, i) => (
        <Part key={i} n={11} at={up(add(p, [30, 12, 0]), 112)} lead={i === 1 ? 24 : 34} quiet={i > 0}>
          <Station o={p} />
        </Part>
      ))}
      <Part n={12} at={up(add(xkdr, [22, 22, 0]), 106)}>
        <Server o={xkdr} h={80} units={4} />
        <Padlock o={up(add(xkdr, [44, 44, 0]), 70)} />
      </Part>
      <Part n={13} at={up(clock, 30)}>
        <Clock o={clock} />
      </Part>
      <Part n={14} at={up(add(hub, [hw / 2, hd / 2, 0]), 100)}>
        <Hub o={hub} ports={6} w={hw} d={hd} />
      </Part>
    </g>
  );
}

const SOURCES: Scene = {
  id: "sources",
  step: "01",
  title: "Sources",
  lede: "Six feeds, from satellites, models and ground stations, fetched together every 12 hours.",
  top: -200,
  height: 760,
  draw: sources,
  legend: [
    { n: 1, title: "NOAA-20", body: "Polar-orbiting satellite. Its VIIRS instrument detects active fires at 375 m; its OMPS instrument maps the UV aerosol index (smoke and dust).", spec: ["VIIRS 375 m", "OMPS aerosol index"] },
    { n: 2, title: "Suomi NPP", body: "VIIRS's second pass over India each day: more fire detections in FIRMS.", spec: ["VIIRS C2"] },
    { n: 3, title: "Terra", body: "MODIS: true-colour imagery, aerosol optical depth and daytime land-surface temperature for the imagery panels.", spec: ["MODIS"] },
    { n: 4, title: "NASA ground segment", body: "EOSDIS ground stations receive the downlinks; LANCE processes them in near real time for FIRMS and GIBS." },
    { n: 5, title: "NASA FIRMS", body: "Two public 24-hour CSVs for South Asia (VIIRS NOAA-20 and S-NPP). We keep fires inside India's box with their FRP, confidence, time and day/night flag.", source: "firms", spec: ["6–37.5° N, 68–98° E", "24 h", "no key"] },
    { n: 6, title: "NASA GIBS", body: "WMS GetMap links for six layers over India and eight city crops, dated yesterday. The server only probes one 64 × 64 tile; your browser loads the images.", source: "gibs", spec: ["6 layers", "8 city crops", "EPSG:4326"] },
    { n: 7, title: "ECMWF", body: "Runs CAMS, the Copernicus atmospheric-composition model (PM2.5, PM10, AOD, dust, NO₂, CO), and the IFS weather model. A model, not measurements.", source: "cams" },
    { n: 8, title: "NOAA GFS", body: "The US global weather model; Open-Meteo blends it with ECMWF's." },
    { n: 9, title: "Open-Meteo", body: "One request each for all 33 cities: air quality (current and hourly, 2 days back, 4 ahead) and weather (temperature, humidity, wind, pressure, rain, boundary-layer height). A relay is tried if a call fails.", source: "weather", spec: ["33 cities / request", "past 2 d · next 4 d", "CC BY 4.0"] },
    { n: 10, title: "MET Norway", body: "The weather fallback. When Open-Meteo answers 429 (rate-limited), each city is asked here instead; it has no boundary-layer height.", spec: ["on HTTP 429", "8 at a time"] },
    { n: 11, title: "CPCB CAAQMS stations", body: "Ground stations of the Central Pollution Control Board: measured PM2.5, the only measurements in the system. They reach the archive days later." },
    { n: 12, title: "XKDR India Air Quality API", body: "The CPCB archive, behind an API key. For each city: stations within 30 km, their daily PM2.5 for the same month two years back, its mean and 90th percentile.", source: "cpcb", spec: ["Bearer key", "≤ 30 km", "≤ 12 stations"] },
    { n: 13, title: "Calendar", body: "The server's clock: the hour in IST, later encoded as a point on a circle.", source: "calendar" },
    { n: 14, title: "LiveService (FastAPI on Render)", body: "One async HTTP client fetches every source at once (asyncio.gather). Weather is refetched at most every 30 min and the CPCB archive at most every 12 h. A source that fails keeps its last good copy for up to 6 h.", spec: ["every 12 h", "httpx · 45 s timeout", "asyncio.gather"] },
  ],
};

/* ================================================================== 02 · Fusion ================== */

function fusion(k: string) {
  const V = (sx: number, sy: number, z = 0) => W(sx, sy + (-130), z);
  const cab = V(-465, 470);
  const align = V(-345, 420);
  const map = V(-40, 168);
  const mw = 262;
  const md = 282;
  const wind = V(255, 470);
  const hour = V(335, 352);
  const slab = V(420, 470);
  const tiles = V(300, 175);
  const firePts: [number, number][] = [[30.9, 75.8], [30.4, 76.4], [29.9, 75.1], [30.2, 74.6], [29.4, 76.2], [31.3, 75.3], [28.9, 76.9], [23.2, 80.1], [21.8, 82.6], [20.6, 84.1], [19.2, 82.9], [24.4, 78.5], [26.1, 91.8], [23.7, 92.7], [18.4, 76.6], [12.9, 77.9]];

  return (
    <g>
      <Wire id={`${k}in`} pts={trunkIn(add(cab, [0, 22, 20]))} packets={9} dur={9} ember />
      <Wire id={`${k}a`} pts={route(add(cab, [54, 22, 0]), add(align, [0, 16, 0]))} dur={2.6} />
      <Wire id={`${k}b`} pts={route(add(align, [110, 16, 0]), add(map, [mw * 0.18, md, 0]), true)} dur={3.2} packets={3} />
      <Wire id={`${k}c`} pts={route(add(map, [mw, md * 0.82, 0]), add(wind, [0, 30, 0]), true)} dur={3} />
      <Wire id={`${k}d`} pts={route(add(map, [mw, md * 0.45, 0]), add(hour, [0, 0, 0]))} dur={3} />
      <Wire id={`${k}e`} pts={route(add(wind, [60, 30, 0]), add(slab, [0, 40, 0]))} dur={2.6} />
      <Wire id={`${k}f`} pts={route(add(hour, [30, 0, 0]), add(slab, [60, 0, 0]), true)} dur={2.6} />
      <Wire id={`${k}g`} pts={route(add(map, [mw * 0.7, 0, 0]), add(tiles, [0, 40, 0]), true)} dashed />
      <Wire id={`${k}trunk`} pts={trunkOut(add(slab, [120, 40, 3]))} packets={9} dur={9} ember />

      <Part n={9} at={up(add(tiles, [30, 20, 0]), 40)}>
        {[0, 1, 2].map((i) => (
          <Box key={i} at={add(tiles, [i * 6, -i * 6, i * 12])} size={[60, 40, 3]} tone={i === 2 ? "edge" : "mid"} top={(m) => <Line pts={[m(4, 32), m(18, 18), m(28, 26), m(42, 10), m(56, 24)]} tone="lo" />} />
        ))}
      </Part>

      <Part n={3} at={add(map, [mw * 0.52, md * 0.1, 30])} lead={40}>
        <MapPlate o={map} w={mw} d={md}>
          {(m) => {
            const delhi = m(28.61, 77.21);
            const kmU = mw / ((97.5 - 67.5) * 100);
            const ring = (c: P3, rkm: number) => Array.from({ length: 49 }, (_, i) => [c[0] + Math.cos((i / 48) * Math.PI * 2) * rkm * kmU, c[1] + Math.sin((i / 48) * Math.PI * 2) * rkm * kmU, 0.5] as P3);
            // wind from the north-west at Delhi: the upwind sector points that way (north is −y, west is −x)
            const from = (225 + 90) * (Math.PI / 180);
            const sector = (rkm: number): P3[] => {
              const pts: P3[] = [[delhi[0], delhi[1], 0.5]];
              for (let i = 0; i <= 12; i++) {
                const a = from - Math.PI / 4 + (i / 12) * (Math.PI / 2);
                pts.push([delhi[0] + Math.cos(a) * rkm * kmU, delhi[1] + Math.sin(a) * rkm * kmU, 0.5]);
              }
              return pts;
            };
            const mumbai = m(19.08, 72.88);
            return (
              <g>
                <Part n={4} at={up(delhi, 6)} lead={58} side={-44} nameLeft>
                  <Line pts={ring(delhi, 300)} tone="mid" dash="3 3" />
                  <Face pts={sector(500)} tone="hi" className="sector" />
                  {firePts.map(([la, lo], i) => {
                    const [x, y] = iso(m(la, lo, 0.6));
                    return <circle key={i} cx={x} cy={y} r={1.8} className="ln fire pl-blink" style={{ animationDelay: `${(i * 0.29) % 1.9}s` }} />;
                  })}
                </Part>
                <Part n={5} at={up(mumbai, 4)} lead={40} side={-36}>
                  <Line pts={ring(mumbai, 120)} tone="mid" dash="2 2" />
                  {[[0.4, 0.2], [-0.3, 0.5], [0.1, -0.5]].map(([a, b], i) => {
                    const [x, y] = iso(m(19.08 + a, 72.88 + b, 0.6));
                    return <path key={i} d={`M${x} ${y}l0 -7m-2.5 -2.5h5v-4h-5z`} className="ln plate t-edge" />;
                  })}
                </Part>
              </g>
            );
          }}
        </MapPlate>
      </Part>

      <Part n={1} at={up(add(cab, [27, 22, 0]), 86)}>
        <Cabinet o={cab} />
      </Part>
      <Part n={2} at={up(add(align, [55, 16, 0]), 42)}>
        {[0, 1].map((r) => (
          <Box key={r} at={add(align, [0, r * 22, r * 0])} size={[110, 12, 5]} top={(m) => <g>{Array.from({ length: 12 }, (_, i) => <Line key={i} pts={[m(5 + i * 9, 0), m(5 + i * 9, i % 3 ? 4 : 8)]} tone={i % 3 ? "lo" : "mid"} />)}</g>} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <Line key={i} pts={[add(align, [5 + i * 9, 12, 5]), add(align, [5 + i * 9, 22, 5])]} tone="lo" className={i % 3 ? undefined : "pl-flow"} dash={i % 3 ? undefined : "2 3"} />
        ))}
      </Part>
      <Part n={6} at={up(add(wind, [30, 30, 0]), 36)}>
        <Box at={wind} size={[60, 60, 5]} top={(m) => (
          <g>
            <Line pts={[m(8, 52), m(52, 52)]} tone="lo" />
            <Line pts={[m(8, 52), m(8, 8)]} tone="lo" />
            <Line pts={[m(8, 52), m(46, 14)]} tone="hi" />
            <Line pts={[m(40, 14), m(46, 14), m(46, 20)]} tone="hi" />
            <Line pts={[m(46, 52), m(46, 14)]} tone="mid" dash="2 2" />
            <Line pts={[m(8, 14), m(46, 14)]} tone="mid" dash="2 2" />
          </g>
        )} />
      </Part>
      <Part n={7} at={up(hour, 30)}>
        <Disc c={hour} r={30} tone="edge" />
        <Disc c={up(hour, 0.5)} r={22} tone="lo" fill={false} />
        <g className="pl-orbit" style={{ transformOrigin: `${iso(hour)[0]}px ${iso(hour)[1]}px` }}>
          <circle cx={iso(add(hour, [22, 0, 0]))[0]} cy={iso(add(hour, [22, 0, 0]))[1]} r={2.6} className="ln plate t-hi" />
        </g>
        <Line pts={[add(hour, [-26, 0, 0.5]), add(hour, [26, 0, 0.5])]} tone="lo" />
        <Line pts={[add(hour, [0, -26, 0.5]), add(hour, [0, 26, 0.5])]} tone="lo" />
      </Part>
      <Part n={8} at={up(add(slab, [60, 40, 0]), 18)}>
        <Slab o={slab} w={120} d={80} rows={11} cols={10} holes={[13, 27, 44, 58, 71, 76, 92, 105]} />
      </Part>
    </g>
  );
}

const FUSION: Scene = {
  id: "fusion",
  step: "02",
  title: "Fusion",
  lede: "Every feed is put on one clock and onto the same 33 cities, turned into numbers a model can read, and checked for gaps.",
  top: -60,
  height: 640,
  draw: fusion,
  legend: [
    { n: 1, title: "Last good copy", body: "A source whose fetch fails keeps serving its last good data, marked stale, for up to 6 hours, instead of dropping out.", spec: ["≤ 6 h", "marked stale"] },
    { n: 2, title: "One clock", body: "Hourly CAMS and weather series are aligned on CAMS's UTC timestamps; everything is held in UTC.", spec: ["UTC", "hourly"] },
    { n: 3, title: "33 cities", body: "Every value is attached to the same 33 city points (their latitude and longitude), the rows of the frame.", spec: ["33 rows"] },
    { n: 4, title: "Fires near and upwind", body: "For each city: fires and their radiative power within 300 km, and fires within 500 km inside ±45° of where the wind blows from (great-circle distance and bearing).", spec: ["≤ 300 km", "≤ 500 km · ±45°"] },
    { n: 5, title: "CPCB baseline", body: "The mean daily PM2.5 of measured stations within 30 km, for the same month two years back: what this city usually breathes now.", spec: ["≤ 30 km", "same month"] },
    { n: 6, title: "Wind as a vector", body: "Speed and direction become two components: u = −s·sin θ, v = −s·cos θ, so a model can add winds together.", spec: ["u, v"] },
    { n: 7, title: "Hour as a circle", body: "The IST hour becomes sin(2πh/24) and cos(2πh/24), so 23:00 sits next to 00:00.", spec: ["sin", "cos"] },
    { n: 8, title: "Gaps stay gaps", body: "One frame: 33 cities × 20 features. A missing value stays missing (NaN), never filled in; the share of filled cells is the coverage.", spec: ["33 × 20", "NaN, not filled"] },
    { n: 9, title: "Imagery goes round", body: "The GIBS image links skip the tensor and go straight to the dashboard's imagery panels." },
  ],
};

/* ================================================================== 03 · Tensor ================== */

function tensor(k: string) {
  const V = (sx: number, sy: number, z = 0) => W(sx, sy + (-640), z);
  const M = (sx: number, sy: number, z = 0) => W(sx, sy + (-430), z);
  const inSlab = V(-470, 470);
  const stack = V(-250, 440);
  const npz = V(-40, 470);
  const arch = V(90, 400);
  const cron = V(210, 330);
  const z = V(270, 470);
  const api = V(420, 420);
  // the model (below the trunk)
  const xnode = M(-470, 690);
  const grid = M(-500, 880);
  const wav = M(-300, 700);
  const att = M(-190, 780);
  const conv = M(-280, 905);
  const graph = M(170, 640);
  const gate = M(60, 600);
  const ens = M(440, 800);
  const lead = M(320, 925);
  const T = 7;

  return (
    <g>
      <Wire id={`${k}in`} pts={trunkIn(add(inSlab, [0, 40, 3]))} packets={9} dur={9} ember />
      <Wire id={`${k}a`} pts={route(add(inSlab, [120, 40, 0]), add(stack, [0, 40, 0]))} dur={2.4} />
      <Wire id={`${k}b`} pts={route(add(stack, [120, 40, 0]), add(npz, [0, 0, 0]))} dur={2.4} />
      <Wire id={`${k}c`} pts={route(add(npz, [0, 0, 0]), add(arch, [0, 0, 0]), true)} dur={2.8} packets={1} />
      <Wire id={`${k}c2`} pts={route(add(arch, [0, 0, 0]), add(cron, [0, 0, 0]), true)} dashed />
      <Wire id={`${k}d`} pts={route(add(npz, [20, 0, 0]), add(z, [0, 40, 0]))} dur={2.4} />
      <Wire id={`${k}e`} pts={route(add(z, [120, 40, 0]), add(api, [0, 22, 0]), true)} dur={2.4} packets={1} />
      <Wire id={`${k}trunk`} pts={trunkOut(add(z, [120, 40, 3]))} packets={9} dur={9} ember />
      {/* the model's own inputs come from the same sources (dashed: a separate fetch each issue) */}
      <Wire id={`${k}m0`} pts={[[VB_X + 30, TRUNK_Y], iso(add(xnode, [0, 30, 0]))]} dashed />
      <Wire id={`${k}m1`} pts={route(add(xnode, [60, 30, 0]), add(wav, [0, 0, 0]))} dur={2.6} />
      <Wire id={`${k}m2`} pts={route(add(xnode, [30, 60, 0]), add(grid, [40, 0, 0]), true)} dur={2.6} />
      <Wire id={`${k}m3`} pts={route(add(wav, [120, 0, 0]), add(att, [0, 13, 0]), true)} dur={2.6} />
      <Wire id={`${k}m4`} pts={route(add(grid, [90, 40, 0]), add(conv, [0, 40, 0]))} dur={2.6} />
      <Wire id={`${k}m5`} pts={route(add(conv, [140, 0, 0]), add(graph, [0, 210, 0]))} dur={2.8} />
      <Wire id={`${k}m6`} pts={route(add(att, [120, 13, 0]), add(graph, [0, 110, 0]))} dur={2.8} />
      <Wire id={`${k}m7`} pts={route(add(graph, [200, 105, 0]), add(ens, [0, 20, 0]))} dur={2.6} />
      <Wire id={`${k}m8`} pts={route(add(ens, [100, 20, 0]), add(lead, [130, 0, 0]), true)} dur={2.6} />
      <Wire id={`${k}m9`} pts={[iso(add(lead, [130, 14, 0])), [560, iso(add(lead, [130, 14, 0]))[1]], [560, TRUNK_Y]]} dur={3} ember />

      {/* the live tensor */}
      <Part n={1} at={up(add(inSlab, [60, 40, 0]), 20)}>
        <Slab o={inSlab} w={120} d={80} />
      </Part>
      <Part n={2} at={up(add(stack, [60, 40, 0]), T * 14 + 24)}>
        {Array.from({ length: T }, (_, i) => (
          <Slab key={i} o={up(stack, i * 14)} w={120} d={80} tone={i === T - 1 ? "edge" : "mid"} className={i === T - 1 ? "pl-drop" : i === 0 ? "pl-fade" : undefined} />
        ))}
        <Line pts={[add(stack, [-14, 80, 0]), add(stack, [-14, 80, T * 14])]} tone="mid" />
        <Line pts={[add(stack, [-18, 80, T * 14 - 6]), add(stack, [-14, 80, T * 14]), add(stack, [-10, 80, T * 14 - 6])]} tone="mid" />
      </Part>
      <Part n={3} at={up(npz, 50)}>
        <Drum o={npz} />
      </Part>
      <Part n={4} at={up(arch, 76)}>
        <Drum o={arch} r={18} h={28} bands={1} />
        <Sheet o={add(arch, [-30, 22, 30])} w={24} h={30} lines={3} />
        <Sheet o={add(arch, [6, 26, 30])} w={24} h={30} lines={3} />
      </Part>
      <Part n={5} at={up(cron, 40)}>
        <Disc c={cron} r={18} tone="edge" />
        <g className="pl-spin" style={{ transformOrigin: `${iso(cron)[0]}px ${iso(cron)[1]}px` }}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const [x, y] = iso(cron);
            return <path key={i} d={`M${x + Math.cos(a) * 14} ${y + Math.sin(a) * 8}L${x + Math.cos(a) * 20} ${y + Math.sin(a) * 11.5}`} className="ln t-mid" />;
          })}
        </g>
      </Part>
      <Part n={6} at={up(add(z, [60, 40, 0]), 20)}>
        <Slab o={z} w={120} d={80} rows={11} cols={10} h={5} />
        {[3, 14, 22, 35, 41, 57, 63, 78, 86, 99].map((c, i) => {
          const u = (c % 10) * 12 + 6;
          const v = Math.floor(c / 10) * (80 / 11) + 4;
          return <Line key={i} pts={[add(z, [u - 4, v, 5.2]), add(z, [u + 4, v, 5.2])]} tone={i % 2 ? "hi" : "mid"} width={2.4} />;
        })}
      </Part>
      <Part n={7} at={up(add(api, [22, 22, 0]), 64)}>
        <Server o={api} h={56} units={3} />
      </Part>

      {/* the forecast model */}
      <Part n={8} at={up(add(xnode, [30, 30, 0]), 96)} nameLeft>
        <Box at={xnode} size={[60, 60, 80]} right={(m) => <g>{Array.from({ length: 7 }, (_, i) => <Line key={i} pts={[m(4, 8 + i * 10), m(56, 8 + i * 10)]} tone="lo" />)}</g>} left={(m) => <g>{Array.from({ length: 5 }, (_, i) => <Line key={i} pts={[m(8 + i * 11, 4), m(8 + i * 11, 76)]} tone="lo" />)}</g>} />
        <Box at={add(xnode, [64, 0, 0])} size={[12, 60, 80]} tone="mid" />
      </Part>
      <Part n={9} at={up(add(grid, [40, 40, 0]), 70)}>
        {Array.from({ length: 4 }, (_, i) => (
          <Slab key={i} o={up(grid, i * 12)} w={80} d={80} rows={8} cols={8} h={3} tone={i === 3 ? "edge" : "mid"} />
        ))}
      </Part>
      <Part n={10} at={up(add(wav, [60, 0, 0]), 90)}>
        <WaveletBands o={wav} />
      </Part>
      <Part n={11} at={up(add(att, [60, 13, 0]), 112)}>
        <Attention o={att} />
      </Part>
      <Part n={12} at={up(add(conv, [80, 0, 0]), 60)}>
        <ConvGrid o={conv} />
      </Part>
      <Part n={13} at={up(add(gate, [26, 26, 0]), 46)}>
        <Box at={gate} size={[52, 52, 24]} tone="lo" className="off" />
        <Line pts={[add(gate, [8, 52, 12]), add(gate, [44, 52, 12])]} tone="lo" dash="2 3" />
      </Part>
      <Part n={14} at={add(graph, [100, 50, 20])} lead={40}>
        <ModelGraph o={graph} w={200} d={212} />
      </Part>
      <Part n={15} at={up(add(ens, [50, 20, 0]), 48)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Chip key={i} o={add(ens, [i * 20, -i * 2, i * 4])} s={28} tone={i === 4 ? "hi" : "edge"} />
        ))}
      </Part>
      <Part n={16} at={up(add(lead, [65, 7, 0]), 50)}>
        <LeadBars o={lead} />
      </Part>
    </g>
  );
}

const TENSOR: Scene = {
  id: "tensor",
  step: "03",
  title: "Tensor",
  lede: "Frames pile up into one block of numbers, time × cities × features. Beside it, the forecast model builds its own, larger block from the same sources and reads it.",
  top: -380,
  height: 960,
  draw: tensor,
  legend: [
    { n: 1, title: "This refresh's frame", body: "33 cities × 20 features: 6 from CAMS, 8 weather, 3 fire, the CPCB baseline and 2 for the hour.", spec: ["33 × 20"] },
    { n: 2, title: "Rolling tensor", body: "Each refresh stacks a new frame on top and the oldest falls off: up to 72 frames, time × city × feature.", spec: ["T ≤ 72", "[T, 33, 20]"] },
    { n: 3, title: "live_tensor.npz", body: "The block, its timestamps, cities and features, saved compressed with numpy after every refresh.", spec: ["np.savez_compressed"] },
    { n: 4, title: "Archive", body: "Each refresh also writes its own frame and the raw CAMS and weather forecasts (live_<stamp>.npz, forecasts_<stamp>.json.gz) for a prospective test.", spec: ["npz", "json.gz"] },
    { n: 5, title: "Scheduled copy", body: "Render's disk is wiped on restart, so a GitHub Actions cron copies the live snapshot to durable storage.", spec: ["GitHub Actions", "cron"] },
    { n: 6, title: "Z-scored view", body: "Each feature scaled against the other cities (z-score, clipped to ±3) for the dashboard's heatmap; coverage is the share of filled cells.", spec: ["z ∈ [−3, 3]"] },
    { n: 7, title: "/api/tensor", body: "Reports the saved block's shape, timestamps, coverage per feature and file size." },
    { n: 8, title: "The model's input block", body: "Rebuilt at 00 and 12 UTC for the model's 138 station nodes: the past 72 hours × 29 features, z-scored with the training statistics, with a mask of which values are present.", spec: ["[72, 138, 29]", "+ mask", "00 / 12 UTC"] },
    { n: 9, title: "Gridded fields", body: "24 three-hourly maps of 8 channels on a 44 × 43 grid (0.75°): wind, boundary layer, temperature, CAMS, interpolated from the nodes by inverse distance; fire power gridded directly.", spec: ["[24, 8, 44, 43]", "IDW, k = 4"] },
    { n: 10, title: "Causal wavelet", body: "PM2.5 and PM10 split into three detail bands and a trend (stationary db4 wavelet, 3 levels), each band using only the past.", spec: ["db4", "3 levels", "causal"] },
    { n: 11, title: "Transformer encoder", body: "Every input projected to 64 numbers, then causal self-attention over the 72 hours: each hour attends only to itself and earlier ones.", spec: ["2 layers", "4 heads", "d = 64"] },
    { n: 12, title: "ConvLSTM", body: "Reads the 24 gridded maps in order with 3 × 3 convolutions and memory, then samples the final map at each station (bilinear): regional context.", spec: ["3 × 3", "16 channels"] },
    { n: 13, title: "Source-group gating", body: "Learned per-station weights for each input group (learned attribution). Trained and evaluated as rung M6; switched off in the served model, because it did not help.", spec: ["M6", "off when serving"] },
    { n: 14, title: "Graph diffusion", body: "Each station is joined to its 8 nearest within 600 km, weighted by distance and by whether the wind blows from one to the other, plus a learned adjacency; 2 hops, 2 layers.", spec: ["k = 8 · ≤ 600 km", "wind-aligned", "adaptive", "K = 2"] },
    { n: 15, title: "Five-seed ensemble", body: "The model exported to ONNX from five training seeds; onnxruntime runs each on one CPU thread (it fits Render's 512 MB) and the forecasts are averaged.", spec: ["ONNX × 5", "mean", "CPU"] },
    { n: 16, title: "48 hourly leads", body: "A forecast of PM2.5 for each of the next 48 hours at each station, turned back into µg/m³.", spec: ["+1 … +48 h"] },
  ],
};

/* ================================================================== 04 · Explanation ============= */

function explanation(k: string) {
  const V = (sx: number, sy: number, z = 0) => W(sx, sy + (-130), z);
  const snap = V(-470, 470);
  const ctx = V(-345, 430);
  const rank = V(-300, 290);
  const watch = V(-170, 480);
  const bed = V(-40, 235);
  const groq = V(90, 285);
  const oll = V(215, 335);
  const cards = V(80, 480);
  const chat = V(265, 500);
  const sens = V(-40, 610);
  const laptop = V(380, 440);
  const phone = V(505, 470);
  const you = V(470, 600);

  return (
    <g>
      <Wire id={`${k}in`} pts={trunkIn(add(snap, [0, 0, 20]))} packets={9} dur={9} ember />
      <Wire id={`${k}a`} pts={route(add(snap, [46, 0, 0]), add(ctx, [0, 0, 0]))} dur={2.4} />
      <Wire id={`${k}b`} pts={route(add(ctx, [20, 0, 0]), add(rank, [50, 100, 0]), true)} dur={2.6} />
      <Wire id={`${k}c`} pts={route(add(ctx, [46, 0, 0]), add(watch, [0, 0, 0]))} dur={2.6} />
      <Wire id={`${k}d`} pts={route(add(watch, [0, 0, 0]), add(bed, [22, 44, 0]), true)} dur={2.8} />
      <Wire id={`${k}f1`} pts={route(add(bed, [44, 22, 0]), add(groq, [0, 22, 0]))} dashed />
      <Wire id={`${k}f2`} pts={route(add(groq, [44, 22, 0]), add(oll, [0, 22, 0]))} dashed />
      <Wire id={`${k}g`} pts={route(add(groq, [22, 44, 0]), add(cards, [30, 0, 0]), true)} dur={2.6} />
      <Wire id={`${k}h`} pts={route(add(oll, [22, 44, 0]), add(chat, [0, 0, 0]), true)} dur={2.6} />
      <Wire id={`${k}i`} pts={route(add(cards, [60, 20, 0]), add(laptop, [0, 40, 0]))} dur={2.6} />
      <Wire id={`${k}j`} pts={route(add(chat, [0, 0, 0]), add(laptop, [55, 76, 0]))} dur={2.6} reverse />
      <Wire id={`${k}k`} pts={[[VB_X + 30, TRUNK_Y], iso(add(sens, [0, 7, 0]))]} dur={4} packets={2} ember />
      <Wire id={`${k}l`} pts={route(add(sens, [130, 7, 0]), add(laptop, [110, 60, 0]))} dur={2.8} />

      <Part n={1} at={up(add(snap, [23, 0, 0]), 72)}>
        <Sheet o={snap} />
      </Part>
      <Part n={2} at={up(add(ctx, [23, 0, 0]), 76)}>
        <Sheet o={add(ctx, [-8, -10, 0])} tone="mid" />
        <Sheet o={ctx} lines={8} />
      </Part>
      <Part n={3} at={up(add(rank, [50, 50, 0]), 30)}>
        <RankScatter o={rank} />
      </Part>
      <Part n={4} at={up(watch, 46)}>
        <Clock o={watch} r={18} />
      </Part>
      <Part n={5} at={up(add(bed, [22, 22, 0]), 106)}>
        <Server o={bed} h={90} />
      </Part>
      <Part n={6} at={up(add(groq, [22, 22, 0]), 106)}>
        <Server o={groq} h={90} />
      </Part>
      <Part n={7} at={up(add(oll, [22, 22, 0]), 90)}>
        <Server o={oll} h={74} units={4} tone="mid" />
      </Part>
      <Part n={8} at={up(add(cards, [50, 0, 0]), 64)}>
        <Cards o={cards} />
      </Part>
      <Part n={9} at={up(chat, 70)}>
        <Bubbles o={up(chat, 24)} />
        <Shield o={add(chat, [40, 40, 0])} s={0.9} />
      </Part>
      <Part n={10} at={up(add(sens, [65, 7, 0]), 54)}>
        <LeadBars o={sens} />
      </Part>
      <Part n={11} at={up(add(laptop, [55, 0, 0]), 96)}>
        <Laptop o={laptop} />
        <Phone o={phone} />
      </Part>
      <Part n={12} at={up(you, 56)}>
        <Person o={you} />
      </Part>
    </g>
  );
}

const EXPLANATION: Scene = {
  id: "explanation",
  step: "04",
  title: "Explanation",
  lede: "Statistics and a chain of language models read the numbers and say, in words, what is driving the air; the dashboard shows it all.",
  top: -60,
  height: 640,
  draw: explanation,
  legend: [
    { n: 1, title: "The snapshot", body: "Each refresh produces one JSON snapshot: the cities with their values and hourly series, fires, imagery links, source health and the tensor's summary.", spec: ["/api/live/snapshot"] },
    { n: 2, title: "Context", body: "The snapshot condensed for a language model: cities ranked by PM2.5 with their category, the value 24 h ago, the next-24-hour peak and its IST time, and the drivers." },
    { n: 3, title: "Spearman across cities", body: "For each driver, the rank correlation between PM2.5 and that driver across the cities right now (needs at least 5): which drivers move with the pollution today.", spec: ["Spearman ρ", "n ≥ 5"] },
    { n: 4, title: "Watcher", body: "Checks every 20 s; when a new snapshot appears it starts writing fresh insights in the background, served from cache meanwhile.", spec: ["20 s"] },
    { n: 5, title: "Amazon Nova Micro", body: "First in the chain, on Amazon Bedrock (Converse API, us-east-1).", spec: ["Bedrock", "us-east-1"] },
    { n: 6, title: "GPT-OSS on Groq", body: "Answers if Bedrock fails: the 120B model writes the insight cards, the 20B model answers chat.", spec: ["120B cards", "20B chat"] },
    { n: 7, title: "Ollama (optional)", body: "A self-hosted small model (qwen2.5:3b) that can be added to the chain; it streams token by token.", spec: ["qwen2.5:3b", "self-hosted"] },
    { n: 8, title: "Insight cards", body: "Six cards asked for as JSON: headline, finding with numbers, physical reasoning, tone, cities, confidence. The reply is parsed and cleaned before it is shown.", spec: ["JSON", "6 cards"] },
    { n: 9, title: "Ask the data", body: "Chat about today's numbers, streamed with the name of the model that answered. Per-IP limits on what costs money: 6 messages a minute, 80 a day.", spec: ["streamed", "6 / min · 80 / day"] },
    { n: 10, title: "Forecast and sensitivity", body: "From the model (stage 03): 48 hours ahead per city, and how the forecast changes when one input group or one upwind place is left out (occlusion).", spec: ["+48 h", "occlusion"] },
    { n: 11, title: "The dashboard", body: "React, on Vercel: the Overview, the MapLibre map, City Forecast, Insights, Projections, History and this page, on a laptop or a phone." },
    { n: 12, title: "You", body: "Every number you read here came down this one wire." },
  ],
};

export const SCENES: Scene[] = [SOURCES, FUSION, TENSOR, EXPLANATION];
export const SCENE_IDS = SCENES.map((s) => s.id);
