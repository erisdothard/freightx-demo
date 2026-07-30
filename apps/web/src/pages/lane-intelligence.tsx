import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, TrendingUp, BarChart2 } from 'lucide-react';
import { getLaneStats, getLaneTrend, suggestRate } from '@/services/rate-intelligence.service';
import type { RateSuggestion, PopularLane } from '@/services/rate-intelligence.service';
import { LaneTrendChart } from '@/features/loads/components/lane-trend-chart';
import { PopularLanesCard } from '@/features/loads/components/popular-lanes-card';
import { RateForecastCard } from '@/features/loads/components/rate-forecast-card';
import { RateHeatmap } from '@/features/loads/components/rate-heatmap';
import { FeatureGate } from '@/shared/components/feature-gate';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { cn } from '@/shared/lib/utils';

const US_STATES = [
  'AL',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];

const EQUIPMENT_OPTIONS = [
  { value: 'van', label: 'Dry Van' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'step_deck', label: 'Step Deck' },
];

interface SearchParams {
  originState: string;
  destState: string;
  equipment: string;
}

export default function LaneIntelligencePage() {
  const [params, setParams] = useState<SearchParams>({
    originState: '',
    destState: '',
    equipment: 'van',
  });
  const [searched, setSearched] = useState<SearchParams | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<RateSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const canSearch = params.originState && params.destState && params.equipment;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['lane-stats', searched?.originState, searched?.destState, searched?.equipment],
    queryFn: () =>
      getLaneStats({
        originState: searched!.originState,
        destState: searched!.destState,
        equipment: searched!.equipment,
        days: 90,
      }),
    enabled: !!searched,
  });

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['lane-trend', searched?.originState, searched?.destState, searched?.equipment],
    queryFn: () =>
      getLaneTrend({
        originState: searched!.originState,
        destState: searched!.destState,
        equipment: searched!.equipment,
      }),
    enabled: !!searched,
  });

  function handleSearch() {
    if (!canSearch) return;
    setSearched({ ...params });
    setAiSuggestion(null);
  }

  function handlePopularLaneSelect(lane: PopularLane) {
    const next = {
      originState: lane.origin_state,
      destState: lane.dest_state,
      equipment: lane.equipment,
    };
    setParams(next);
    setSearched(next);
    setAiSuggestion(null);
  }

  async function handleAiEstimate() {
    if (!searched || !stats) return;
    setAiLoading(true);
    try {
      const suggestion = await suggestRate({
        originState: searched.originState,
        destState: searched.destState,
        equipment: searched.equipment,
        totalMiles: 500, // placeholder — actual miles not always known
        laneStats: stats,
      });
      setAiSuggestion(suggestion);
    } finally {
      setAiLoading(false);
    }
  }

  const confidenceColor = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-red-400',
  };

  return (
    <div className="min-h-screen bg-fx-bg p-4 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={20} className="text-fx-orange" />
          <h1 className="text-xl font-bold text-white">Lane Intelligence</h1>
        </div>
        <p className="text-fx-text-dim text-sm">
          Market rates for any lane, powered by real booking data.
        </p>
      </div>

      {/* Search form */}
      <div className="bg-fx-surface rounded-ios p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-bold text-fx-text-dim uppercase tracking-wider block mb-1.5">
              Origin State
            </label>
            <select
              value={params.originState}
              onChange={(e) => setParams((p) => ({ ...p, originState: e.target.value }))}
              className="w-full bg-fx-surface-2 border border-fx-border rounded-ios-xs px-3 h-10 text-white text-sm focus:outline-none focus:border-fx-orange"
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-fx-text-dim uppercase tracking-wider block mb-1.5">
              Dest State
            </label>
            <select
              value={params.destState}
              onChange={(e) => setParams((p) => ({ ...p, destState: e.target.value }))}
              className="w-full bg-fx-surface-2 border border-fx-border rounded-ios-xs px-3 h-10 text-white text-sm focus:outline-none focus:border-fx-orange"
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-[11px] font-bold text-fx-text-dim uppercase tracking-wider block mb-1.5">
            Equipment
          </label>
          <div className="grid grid-cols-4 gap-2">
            {EQUIPMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setParams((p) => ({ ...p, equipment: opt.value }))}
                className={cn(
                  'h-9 rounded-ios-xs text-[12px] font-semibold border transition-colors',
                  params.equipment === opt.value
                    ? 'bg-fx-orange border-fx-orange text-white'
                    : 'bg-fx-surface-2 border-fx-border text-fx-text-dim hover:border-fx-orange/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={!canSearch}
          className="w-full h-11 bg-fx-orange rounded-ios-xs font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-40 active-scale"
        >
          <Search size={16} />
          Search Lane
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-fx-surface rounded-ios p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-white">
              {searched.originState} → {searched.destState}
            </h2>
            <span className="text-[11px] text-fx-text-dim bg-fx-surface-2 px-2 py-1 rounded-full">
              {EQUIPMENT_OPTIONS.find((e) => e.value === searched.equipment)?.label}
            </span>
          </div>

          {statsLoading ? (
            <SkeletonList count={3} />
          ) : stats ? (
            <>
              {stats.sample_count === 0 ? (
                <EmptyState
                  icon={<BarChart2 size={28} className="text-fx-text-dim" />}
                  title="No data for this lane"
                  subtitle="Be the first to book it!"
                />
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Avg $/mi', value: stats.avg_rate_per_mile },
                    { label: 'Min $/mi', value: stats.min_rate_per_mile },
                    { label: 'Max $/mi', value: stats.max_rate_per_mile },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-fx-surface-2 rounded-ios-xs p-3 text-center"
                    >
                      <div className="text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                        {item.label}
                      </div>
                      <div className="text-[18px] font-bold text-white">
                        {item.value != null ? `$${item.value.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-fx-text-dim mb-4">
                <span>{stats.sample_count} bookings (90 days)</span>
                {stats.last_recorded_at && (
                  <span>Last: {new Date(stats.last_recorded_at).toLocaleDateString()}</span>
                )}
              </div>
            </>
          ) : null}

          {/* Sparkline */}
          {!trendLoading && trend && trend.length > 1 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} className="text-fx-text-dim" />
                <span className="text-[11px] text-fx-text-dim uppercase tracking-wider">
                  90-Day Trend
                </span>
              </div>
              <LaneTrendChart data={trend} height={48} />
            </div>
          )}

          {/* AI Rate Estimate */}
          {!aiSuggestion ? (
            <button
              onClick={() => void handleAiEstimate()}
              disabled={aiLoading || !stats || stats.sample_count === 0}
              className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-ios-xs font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 hover:border-fx-orange/50 transition-colors active-scale"
            >
              <Sparkles size={14} className="text-fx-orange" />
              {aiLoading ? 'Analyzing...' : 'AI Rate Estimate'}
            </button>
          ) : (
            <div className="bg-fx-surface-2 rounded-ios-xs p-4 border border-fx-orange/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-fx-orange" />
                <span className="text-[13px] font-bold text-white">AI Rate Estimate</span>
                <span
                  className={cn(
                    'ml-auto text-[11px] font-semibold',
                    confidenceColor[aiSuggestion.confidence],
                  )}
                >
                  {aiSuggestion.confidence} confidence
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Low', value: aiSuggestion.suggested_low },
                  { label: 'Mid', value: aiSuggestion.suggested_mid },
                  { label: 'High', value: aiSuggestion.suggested_high },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-[10px] text-fx-text-dim uppercase mb-0.5">
                      {item.label}
                    </div>
                    <div className="text-[16px] font-bold text-fx-orange">
                      ${item.value.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-fx-text-dim leading-relaxed">
                {aiSuggestion.reasoning}
              </p>
              <button
                onClick={() => setAiSuggestion(null)}
                className="mt-2 text-[11px] text-fx-text-dim hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rate Forecast — shows when a lane is searched */}
      {searched && (
        <FeatureGate feature="rate_analytics">
          <div className="mb-4">
            <RateForecastCard
              originState={searched.originState}
              destState={searched.destState}
              equipment={searched.equipment}
            />
          </div>
        </FeatureGate>
      )}

      {/* Rate Heatmap — always visible for current equipment */}
      <FeatureGate feature="rate_analytics">
        <div className="mb-4">
          <RateHeatmap equipment={params.equipment} />
        </div>
      </FeatureGate>

      {/* Popular lanes widget */}
      <PopularLanesCard onSelect={handlePopularLaneSelect} />
    </div>
  );
}
