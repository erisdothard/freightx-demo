import type { LaneTrendPoint } from '@/services/rate-intelligence.service';

interface LaneTrendChartProps {
  data: LaneTrendPoint[];
  height?: number;
  className?: string;
}

/**
 * Lightweight SVG sparkline for 90-day lane rate trend.
 * No chart library dependency — pure SVG path.
 */
export function LaneTrendChart({ data, height = 40, className }: LaneTrendChartProps) {
  if (data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-fx-text-dim text-[11px] ${className ?? ''}`}
        style={{ height }}
      >
        Insufficient data
      </div>
    );
  }

  const width = 200;
  const padding = 4;
  const rates = data.map((d) => d.avg_rate_per_mile);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const range = maxRate - minRate || 0.01;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + ((maxRate - d.avg_rate_per_mile) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const lastRate = rates[rates.length - 1];
  const firstRate = rates[0];
  const trend = lastRate - firstRate;
  const color = trend >= 0 ? '#34d399' : '#f87171'; // green / red

  return (
    <div className={className}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-fx-text-dim mt-0.5">
        <span>${minRate.toFixed(2)}/mi</span>
        <span>${maxRate.toFixed(2)}/mi</span>
      </div>
    </div>
  );
}
