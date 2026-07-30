import { useEffect, useState } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { getPopularLanes } from '@/services/rate-intelligence.service';
import type { PopularLane } from '@/services/rate-intelligence.service';
import { EQUIPMENT_LABELS } from '@freightx/shared';
import { cn } from '@/shared/lib/utils';

interface PopularLanesCardProps {
  onSelect?: (lane: PopularLane) => void;
  className?: string;
}

export function PopularLanesCard({ onSelect, className }: PopularLanesCardProps) {
  const [lanes, setLanes] = useState<PopularLane[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPopularLanes(10)
      .then(setLanes)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn('bg-fx-surface rounded-ios p-5', className)}>
        <div className="h-4 w-32 bg-fx-surface-2 rounded animate-pulse mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-fx-surface-2 rounded-ios-xs mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (lanes.length === 0) {
    return (
      <div className={cn('bg-fx-surface rounded-ios p-5', className)}>
        <p className="text-fx-text-dim text-sm text-center py-4">No lane data yet</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-fx-surface rounded-ios p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-fx-orange" />
        <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">Popular Lanes</h3>
      </div>

      <div className="space-y-2">
        {lanes.map((lane, i) => (
          <button
            key={i}
            onClick={() => onSelect?.(lane)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-fx-surface-2 rounded-ios-xs hover:bg-fx-surface-3 transition-colors active-scale"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-white">{lane.origin_state}</span>
              <ArrowRight size={11} className="text-fx-text-dim shrink-0" />
              <span className="text-[13px] font-semibold text-white">{lane.dest_state}</span>
              <span className="ml-2 text-[11px] text-fx-text-dim truncate">
                {EQUIPMENT_LABELS[lane.equipment as keyof typeof EQUIPMENT_LABELS] ??
                  lane.equipment}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              {lane.avg_rate_per_mile != null && (
                <span className="text-[12px] font-bold text-fx-orange">
                  ${lane.avg_rate_per_mile.toFixed(2)}/mi
                </span>
              )}
              <span className="text-[11px] text-fx-text-dim">{lane.load_count} loads</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
