import type { Landmark } from "@/lib/cities";

/**
 * Hand-built silhouette glyphs of Indian landmarks. Drawn around (0,0) = ground centre,
 * y negative upwards, filled with `currentColor`. Arches use even-odd holes.
 */

function IndiaGate() {
  return (
    <g>
      <rect x={-64} y={-10} width={128} height={10} />
      <path fillRule="evenodd" d="M-46,-10 V-122 H46 V-10 Z M-17,-10 V-78 A17,17 0 0 1 17,-78 V-10 Z M-38,-10 V-46 A6,6 0 0 1 -26,-46 V-10 Z M26,-10 V-46 A6,6 0 0 1 38,-46 V-10 Z" />
      <rect x={-52} y={-131} width={104} height={9} rx={1} />
      <rect x={-40} y={-152} width={80} height={21} />
      <rect x={-30} y={-160} width={60} height={8} />
      <path d="M-18,-160 Q0,-181 18,-160 Z" />
    </g>
  );
}

function QutubMinar() {
  const ledges = [70, 125, 165, 195];
  return (
    <g>
      <path d="M-13,0 L-6,-210 L6,-210 L13,0 Z" />
      {ledges.map((h) => {
        const w = 26 - 14 * (h / 210);
        return <rect key={h} x={-(w / 2 + 4)} y={-h - 3} width={w + 8} height={4} />;
      })}
      <rect x={-4} y={-222} width={8} height={12} />
      <path d="M-5,-222 Q0,-232 5,-222 Z" />
    </g>
  );
}

function Gateway() {
  const turrets = [-62, -40, 40, 62];
  return (
    <g>
      <path
        fillRule="evenodd"
        d="M-70,0 V-95 H70 V0 Z M-18,0 V-55 A18,18 0 0 1 18,-55 V0 Z M-56,0 V-34 A9,9 0 0 1 -38,-34 V0 Z M38,0 V-34 A9,9 0 0 1 56,-34 V0 Z"
      />
      <rect x={-74} y={-101} width={148} height={6} />
      <rect x={-30} y={-118} width={60} height={17} />
      {turrets.map((x) => (
        <g key={x}>
          <rect x={x - 6} y={-125} width={12} height={24} />
          <path d={`M${x - 7},-125 Q${x},-139 ${x + 7},-125 Z`} />
        </g>
      ))}
    </g>
  );
}

function Taj() {
  const chhatri = [-46, 46];
  const minarets = [-104, 104];
  return (
    <g>
      <rect x={-118} y={-12} width={236} height={12} />
      <path fillRule="evenodd" d="M-56,-12 V-80 H56 V-12 Z M-16,-12 V-56 Q0,-76 16,-56 V-12 Z" />
      <rect x={-31} y={-86} width={62} height={6} />
      <path d="M-34,-86 C-42,-116 -20,-140 0,-152 C20,-140 42,-116 34,-86 Z" />
      <rect x={-1.5} y={-168} width={3} height={16} />
      {chhatri.map((x) => (
        <g key={x}>
          <rect x={x - 8} y={-98} width={16} height={18} />
          <path d={`M${x - 9},-98 Q${x},-113 ${x + 9},-98 Z`} />
        </g>
      ))}
      {minarets.map((x) => (
        <g key={x}>
          <path d={`M${x - 5},-12 L${x - 4},-126 L${x + 4},-126 L${x + 5},-12 Z`} />
          <rect x={x - 7} y={-62} width={14} height={3} />
          <rect x={x - 7} y={-96} width={14} height={3} />
          <path d={`M${x - 7},-126 Q${x},-140 ${x + 7},-126 Z`} />
        </g>
      ))}
    </g>
  );
}

function Charminar() {
  const mins = [-52, 52];
  return (
    <g>
      <path fillRule="evenodd" d="M-48,0 V-92 H48 V0 Z M-24,0 V-54 Q0,-88 24,-54 V0 Z" />
      <rect x={-52} y={-100} width={104} height={8} />
      <path fillRule="evenodd" d="M-42,-100 V-118 H42 V-100 Z M-30,-100 V-108 H-22 V-100 Z M-11,-100 V-108 H-3 V-100 Z M3,-100 V-108 H11 V-100 Z M22,-100 V-108 H30 V-100 Z" />
      {mins.map((x) => (
        <g key={x}>
          <rect x={x - 7} y={-172} width={14} height={172} />
          {[-100, -130, -156].map((y) => (
            <rect key={y} x={x - 9.5} y={y} width={19} height={4} />
          ))}
          <path d={`M${x - 9},-172 C${x - 10},-184 ${x - 3},-192 ${x},-196 C${x + 3},-192 ${x + 10},-184 ${x + 9},-172 Z`} />
          <rect x={x - 1} y={-206} width={2} height={10} />
        </g>
      ))}
    </g>
  );
}

function Victoria() {
  return (
    <g>
      <rect x={-124} y={-14} width={248} height={14} />
      <rect x={-104} y={-60} width={208} height={46} />
      <rect x={-112} y={-66} width={224} height={6} />
      <rect x={-34} y={-92} width={68} height={26} />
      <path d="M-40,-92 C-40,-142 40,-142 40,-92 Z" />
      <rect x={-6} y={-145} width={12} height={12} />
      <path d="M-8,-145 Q0,-155 8,-145 Z" />
      <rect x={-1.5} y={-170} width={3} height={18} />
      <path d="M-9,-162 L0,-168 L9,-162 L0,-164 Z" />
      {[-90, 90].map((x) => (
        <g key={x}>
          <rect x={x - 12} y={-84} width={24} height={18} />
          <path d={`M${x - 14},-84 Q${x},-104 ${x + 14},-84 Z`} />
        </g>
      ))}
    </g>
  );
}

function Vidhana() {
  return (
    <g>
      <rect x={-142} y={-60} width={284} height={60} />
      <rect x={-148} y={-66} width={296} height={6} />
      <rect x={-24} y={-124} width={48} height={22} />
      <path d="M-30,-122 C-30,-162 30,-162 30,-122 Z" />
      <rect x={-2} y={-176} width={4} height={18} />
      <rect x={-48} y={-94} width={96} height={28} />
      <path d="M-54,-94 L0,-110 L54,-94 Z" />
      {[-112, 112].map((x) => (
        <path key={x} d={`M${x - 15},-66 Q${x},-88 ${x + 15},-66 Z`} />
      ))}
    </g>
  );
}

function Gopuram() {
  const tiers = Array.from({ length: 7 }, (_, i) => i);
  return (
    <g>
      <path fillRule="evenodd" d="M-56,0 V-22 H56 V0 Z M-10,0 V-17 Q0,-24 10,-17 V0 Z" />
      {tiers.map((i) => {
        const w = 104 - i * 12.5;
        return <rect key={i} x={-w / 2} y={-22 - (i + 1) * 15} width={w} height={15.5} />;
      })}
      {tiers.map((i) => {
        const w = 112 - i * 12.5;
        return <rect key={`l${i}`} x={-w / 2} y={-22 - (i + 1) * 15} width={w} height={2.5} />;
      })}
      <rect x={-27} y={-142} width={54} height={15} rx={7} />
      {[-18, -9, 0, 9, 18].map((x) => (
        <g key={x}>
          <rect x={x - 1.2} y={-153} width={2.4} height={12} />
          <circle cx={x} cy={-154} r={2.6} />
        </g>
      ))}
    </g>
  );
}

function DomePalace() {
  return (
    <g>
      <path
        fillRule="evenodd"
        d="M-72,0 V-50 H72 V0 Z M-14,0 V-30 Q0,-44 14,-30 V0 Z M-48,0 V-22 Q-40,-32 -32,-22 V0 Z M32,0 V-22 Q40,-32 48,-22 V0 Z"
      />
      <rect x={-76} y={-56} width={152} height={6} />
      <rect x={-26} y={-64} width={52} height={8} />
      <path d="M-30,-64 C-34,-96 -12,-112 0,-120 C12,-112 34,-96 30,-64 Z" />
      <rect x={-1.5} y={-134} width={3} height={14} />
      {[-64, 64].map((x) => (
        <g key={x}>
          <rect x={x - 5} y={-112} width={10} height={112} />
          <rect x={x - 7} y={-76} width={14} height={3} />
          <path d={`M${x - 7},-112 Q${x},-126 ${x + 7},-112 Z`} />
        </g>
      ))}
    </g>
  );
}

function TvTower() {
  return (
    <g>
      <path d="M-9,0 L-3,-170 L3,-170 L9,0 Z" />
      <ellipse cx={0} cy={-150} rx={14} ry={7} />
      <rect x={-8} y={-162} width={16} height={8} rx={2} />
      <rect x={-1} y={-210} width={2} height={42} />
    </g>
  );
}

export function LandmarkGlyph({ kind }: { kind: Landmark }) {
  switch (kind) {
    case "indiaGate":
      return (
        <g>
          <g transform="translate(-250,0) scale(0.92)">
            <QutubMinar />
          </g>
          <IndiaGate />
        </g>
      );
    case "gateway":
      return <Gateway />;
    case "taj":
      return <Taj />;
    case "charminar":
      return <Charminar />;
    case "victoria":
      return <Victoria />;
    case "vidhana":
      return <Vidhana />;
    case "gopuram":
      return <Gopuram />;
    case "dome":
      return <DomePalace />;
    default:
      return (
        <g>
          <DomePalace />
          <g transform="translate(210,0)">
            <TvTower />
          </g>
        </g>
      );
  }
}
