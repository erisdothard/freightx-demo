import { Map } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface RateHeatmapProps {
  equipment?: string;
  className?: string;
}

// Placeholder lane data for the heatmap grid
const SAMPLE_LANES = [
  { origin: 'ATL', destination: 'DFW', rate: 2.85, intensity: 'high' },
  { origin: 'CHI', destination: 'LAX', rate: 2.4, intensity: 'medium' },
  { origin: 'ATL', destination: 'CHI', rate: 2.15, intensity: 'medium' },
  { origin: 'DFW', destination: 'MIA', rate: 3.1, intensity: 'high' },
  { origin: 'LAX', destination: 'SEA', rate: 1.95, intensity: 'low' },
  { origin: 'CHI', destination: 'ATL', rate: 2.55, intensity: 'medium' },
  { origin: 'MIA', destination: 'ATL', rate: 1.8, intensity: 'low' },
  { origin: 'SEA', destination: 'DFW', rate: 2.7, intensity: 'high' },
] as const;

const intensityStyles = {
  high: 'bg-fx-orange/25 text-fx-orange border-fx-orange/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-400 border-green-500/25',
} as const;

export function RateHeatmap({ equipment: _equipment, className }: RateHeatmapProps) {
  return (
    <div
      className={cn('rounded-2xl border border-fx-border bg-fx-surface p-4 space-y-3', className)}
    >
      <div className="flex items-center gap-2 mb-1">
        <Map size={15} className="text-fx-orange" />
        <span className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
          Rate Heatmap
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SAMPLE_LANES.map((lane) => (
          <div
            key={`${lane.origin}-${lane.destination}`}
            className={cn('rounded-xl p-2.5 border text-center', intensityStyles[lane.intensity])}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {lane.origin} &rarr; {lane.destination}
            </p>
            <p className="text-base font-black mt-0.5">${lane.rate.toFixed(2)}/mi</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pt-1">
        <span className="flex items-center gap-1.5 text-[10px] text-fx-text-dim">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/40" /> Low
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-fx-text-dim">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" /> Medium
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-fx-text-dim">
          <span className="w-2.5 h-2.5 rounded-full bg-fx-orange/40" /> High
        </span>
      </div>
    </div>
  );
}
