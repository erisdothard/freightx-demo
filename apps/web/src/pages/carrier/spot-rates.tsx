import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, MapPin } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';
import { getSpotRateIndex, type SpotRateIndex } from '@/services/spot-rate-index.service';
import { useQuery } from '@tanstack/react-query';

const TREND_CONFIG = {
  up: { icon: TrendingUp, color: 'text-emerald-400' },
  down: { icon: TrendingDown, color: 'text-red-400' },
  stable: { icon: Minus, color: 'text-zinc-400' },
};

export default function CarrierSpotRatesPage() {
  const { profile } = useAuth();
  const role = getNavRole(profile?.role);
  const [originState, setOriginState] = useState('');
  const [destState, setDestState] = useState('');

  const { data: rates = [], isLoading } = useQuery<SpotRateIndex[]>({
    queryKey: ['spot-rates', originState, destState],
    queryFn: () =>
      getSpotRateIndex({
        originState: originState || undefined,
        destinationState: destState || undefined,
      }),
    staleTime: 60_000,
  });

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Spot Rate Index" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <input
            className="flex-1 h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            placeholder="Origin State"
            value={originState}
            onChange={(e) => setOriginState(e.target.value.toUpperCase())}
            maxLength={2}
          />
          <input
            className="flex-1 h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            placeholder="Dest State"
            value={destState}
            onChange={(e) => setDestState(e.target.value.toUpperCase())}
            maxLength={2}
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <SkeletonList count={4} />
        ) : rates.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={28} className="text-fx-text-dim" />}
            title="No rate data available"
            subtitle="Try adjusting your filters or check back later"
          />
        ) : (
          <div className="space-y-2">
            {rates.map((rate, i) => {
              const trend = TREND_CONFIG[rate.trend_direction];
              const TrendIcon = trend.icon;
              return (
                <div key={i} className="bg-fx-surface border border-fx-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-fx-orange shrink-0" />
                      <span className="text-sm font-semibold text-fx-text">
                        {rate.origin_state} → {rate.destination_state}
                      </span>
                      <span className="text-[10px] text-fx-text-dim uppercase">
                        {rate.equipment_type}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 ${trend.color}`}>
                      <TrendIcon size={14} />
                      <span className="text-xs font-bold">
                        {rate.trend_pct > 0 ? '+' : ''}
                        {rate.trend_pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-extrabold text-fx-orange">
                        ${rate.avg_rate.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-fx-text-dim">Avg Rate</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-fx-text-muted">
                        ${rate.min_rate.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-fx-text-dim">Low</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-fx-text-muted">
                        ${rate.max_rate.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-fx-text-dim">High</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-fx-text-dim mt-2 text-right">
                    {rate.load_count} loads · {rate.period}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav role={role} />
    </div>
  );
}
