import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface RateForecastCardProps {
  origin?: string;
  destination?: string;
  originState?: string;
  destState?: string;
  equipment?: string;
  className?: string;
}

// Placeholder forecast data until live feed is wired up
const PLACEHOLDER = {
  currentRate: 2.45,
  forecastRate: 2.62,
  weeklyChange: 3.2,
  trend: 'up' as const,
  confidence: 'Medium',
};

export function RateForecastCard({
  origin,
  destination,
  originState,
  destState,
  equipment: _equipment,
  className,
}: RateForecastCardProps) {
  const displayOrigin = origin ?? originState;
  const displayDest = destination ?? destState;
  const { currentRate, forecastRate, weeklyChange, trend, confidence } = PLACEHOLDER;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-fx-text-muted';

  return (
    <div
      className={cn('rounded-2xl border border-fx-border bg-fx-surface p-4 space-y-3', className)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-fx-orange" />
          <span className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
            Rate Forecast
          </span>
        </div>
        <span className="text-[10px] font-semibold text-fx-text-dim px-2 py-0.5 rounded-md bg-fx-surface-2">
          {confidence}
        </span>
      </div>

      {(displayOrigin || displayDest) && (
        <p className="text-sm text-fx-text-muted truncate">
          {displayOrigin ?? '---'} &rarr; {displayDest ?? '---'}
        </p>
      )}

      <div className="flex items-end gap-4">
        <div>
          <p className="text-[10px] text-fx-text-dim mb-0.5">Current</p>
          <p className="text-xl font-black text-fx-text">${currentRate.toFixed(2)}/mi</p>
        </div>
        <div>
          <p className="text-[10px] text-fx-text-dim mb-0.5">7-Day Forecast</p>
          <p className="text-xl font-black text-fx-text">${forecastRate.toFixed(2)}/mi</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <TrendIcon size={13} className={trendColor} />
        <span className={cn('text-xs font-semibold', trendColor)}>
          {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
          {weeklyChange}% this week
        </span>
      </div>
    </div>
  );
}

export default RateForecastCard;
