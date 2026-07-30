import { useQuery } from '@tanstack/react-query';
import { getRateFairness } from '@/services/rate-intelligence.service';
import type { RateFairness } from '@/services/rate-intelligence.service';
import { cn } from '@/shared/lib/utils';

const LABEL_STYLES: Record<
  RateFairness['fairness_label'],
  { color: string; bg: string; border: string }
> = {
  Excellent: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  'Above Average': {
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/20',
  },
  Fair: { color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  'Below Market': { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
};

const CONFIDENCE_LABEL: Record<RateFairness['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Limited data',
};

export function FairnessRating({ loadId }: { loadId: string }) {
  const { data: fairness } = useQuery({
    queryKey: ['rate-fairness', loadId],
    queryFn: () => getRateFairness(loadId),
    staleTime: 5 * 60_000,
    enabled: !!loadId,
  });

  if (!fairness) return null;

  const style = LABEL_STYLES[fairness.fairness_label];

  return (
    <div className="rounded-xl bg-fx-surface-2 border border-fx-border p-4 mb-4">
      {/* Header + label */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
          Market Fairness
        </p>
        <span
          className={cn(
            'text-[11px] font-bold px-2.5 py-1 rounded-full border',
            style.color,
            style.bg,
            style.border,
          )}
        >
          {fairness.fairness_label}
        </span>
      </div>

      {/* Percentile bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-fx-text-dim">Percentile</span>
          <span className={cn('text-sm font-bold', style.color)}>{fairness.percentile}th</span>
        </div>
        <div className="h-2 rounded-full bg-fx-surface overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${fairness.percentile}%`,
              background:
                fairness.percentile >= 75
                  ? 'linear-gradient(90deg, #34D399, #10B981)'
                  : fairness.percentile >= 50
                    ? 'linear-gradient(90deg, #4ADE80, #22C55E)'
                    : fairness.percentile >= 25
                      ? 'linear-gradient(90deg, #FBBF24, #F59E0B)'
                      : 'linear-gradient(90deg, #F87171, #EF4444)',
            }}
          />
        </div>
      </div>

      {/* Market comparison row */}
      <div
        className="flex items-center gap-0 rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {[
          { label: 'Min', value: `$${fairness.market_min.toFixed(2)}` },
          { label: 'Avg', value: `$${fairness.market_avg.toFixed(2)}` },
          { label: 'This', value: `$${fairness.rate_per_mile.toFixed(2)}` },
          { label: 'Max', value: `$${fairness.market_max.toFixed(2)}` },
        ].map((item, i) => (
          <div
            key={item.label}
            className={cn('flex-1 text-center py-2', item.label === 'This' && 'bg-fx-surface')}
            style={i < 3 ? { borderRight: '1px solid rgba(255,255,255,0.06)' } : {}}
          >
            <p className="text-[9px] font-semibold text-fx-text-dim uppercase">{item.label}</p>
            <p
              className={cn(
                'text-[12px] font-bold',
                item.label === 'This' ? style.color : 'text-fx-text',
              )}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Confidence + sample count */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] text-fx-text-dim">
          {CONFIDENCE_LABEL[fairness.confidence]} ({fairness.sample_count} samples)
        </span>
        <span className="text-[10px] text-fx-text-dim">90-day window</span>
      </div>
    </div>
  );
}
