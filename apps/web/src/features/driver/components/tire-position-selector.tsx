import type { TirePosition } from '@freightx/shared';

interface TirePositionSelectorProps {
  selected: TirePosition | null;
  onSelect: (pos: TirePosition) => void;
}

const POSITIONS: { id: TirePosition; label: string; x: number; y: number }[] = [
  // Tractor
  { id: 'front_left', label: 'FL', x: 30, y: 42 },
  { id: 'front_right', label: 'FR', x: 170, y: 42 },
  { id: 'rear_inner_left', label: 'RIL', x: 30, y: 102 },
  { id: 'rear_inner_right', label: 'RIR', x: 170, y: 102 },
  { id: 'rear_outer_left', label: 'ROL', x: 30, y: 132 },
  { id: 'rear_outer_right', label: 'ROR', x: 170, y: 132 },
  // Trailer
  { id: 'trailer_left_1', label: 'TL1', x: 30, y: 202 },
  { id: 'trailer_right_1', label: 'TR1', x: 170, y: 202 },
  { id: 'trailer_left_2', label: 'TL2', x: 30, y: 232 },
  { id: 'trailer_right_2', label: 'TR2', x: 170, y: 232 },
];

export function TirePositionSelector({ selected, onSelect }: TirePositionSelectorProps) {
  return (
    <div className="relative" style={{ width: 220, height: 270 }}>
      <svg width="220" height="270" viewBox="0 0 220 270" fill="none">
        {/* Tractor body */}
        <rect
          x="55"
          y="20"
          width="110"
          height="140"
          rx="12"
          fill="#1a1a2e"
          stroke="#333"
          strokeWidth="1.5"
        />
        {/* Cab */}
        <rect
          x="65"
          y="25"
          width="90"
          height="40"
          rx="8"
          fill="#222240"
          stroke="#444"
          strokeWidth="1"
        />
        {/* Hitch */}
        <line
          x1="110"
          y1="160"
          x2="110"
          y2="180"
          stroke="#555"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Trailer body */}
        <rect
          x="55"
          y="180"
          width="110"
          height="75"
          rx="8"
          fill="#1a1a2e"
          stroke="#333"
          strokeWidth="1.5"
        />

        {/* Tire slots */}
        {POSITIONS.map((pos) => {
          const isSelected = selected === pos.id;
          return (
            <g key={pos.id} onClick={() => onSelect(pos.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={pos.x}
                y={pos.y}
                width="22"
                height="18"
                rx="4"
                fill={isSelected ? '#e86030' : '#2a2a40'}
                stroke={isSelected ? '#ff8050' : '#444'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <text
                x={pos.x + 11}
                y={pos.y + 12}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill={isSelected ? '#fff' : '#888'}
              >
                {pos.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
