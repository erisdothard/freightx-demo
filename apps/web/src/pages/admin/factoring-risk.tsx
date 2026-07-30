import { useState } from 'react';
import { Shield, AlertTriangle, DollarSign } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import {
  getFactoringRiskDashboard,
  updateExposureLimit,
  type FactoringRiskProfile,
} from '@/services/factoring-risk.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
};

export default function AdminFactoringRiskPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState('');

  const { data: profiles = [], isLoading } = useQuery<FactoringRiskProfile[]>({
    queryKey: ['factoring-risk'],
    queryFn: getFactoringRiskDashboard,
  });

  const updateMutation = useMutation({
    mutationFn: ({ companyId, limit }: { companyId: string; limit: number }) =>
      updateExposureLimit(companyId, limit),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['factoring-risk'] });
      setEditingId(null);
      setNewLimit('');
    },
  });

  const totalExposure = profiles.reduce((sum, p) => sum + p.outstanding_amount, 0);
  const highRiskCount = profiles.filter(
    (p) => p.risk_level === 'high' || p.risk_level === 'critical',
  ).length;

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Factoring Risk" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3">
            <p className="text-[10px] font-bold text-fx-text-dim uppercase">Total Exposure</p>
            <p className="text-xl font-extrabold text-fx-orange mt-1">
              ${(totalExposure / 1000).toFixed(0)}K
            </p>
          </div>
          <div className="bg-fx-surface border border-fx-border rounded-xl p-3">
            <p className="text-[10px] font-bold text-fx-text-dim uppercase">High Risk</p>
            <p
              className={`text-xl font-extrabold mt-1 ${highRiskCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {highRiskCount}
            </p>
          </div>
        </div>

        {/* Risk profiles */}
        {isLoading ? (
          <SkeletonList count={3} />
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={<Shield size={28} className="text-fx-text-dim" />}
            title="No factoring data available"
            subtitle="Factoring requests will appear here once submitted"
          />
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => {
              const riskColor = RISK_COLORS[p.risk_level] ?? RISK_COLORS.medium;
              const isEditing = editingId === p.company_id;

              return (
                <div
                  key={p.company_id}
                  className="bg-fx-surface border border-fx-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-fx-text">{p.company_name}</p>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${riskColor}`}
                    >
                      {p.risk_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-bold text-fx-text">
                        ${(p.outstanding_amount / 1000).toFixed(1)}K
                      </p>
                      <p className="text-[9px] text-fx-text-dim">Outstanding</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-fx-text">
                        {p.avg_days_to_pay.toFixed(0)}d
                      </p>
                      <p className="text-[9px] text-fx-text-dim">Avg Pay</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-fx-text">{p.default_count}</p>
                      <p className="text-[9px] text-fx-text-dim">Defaults</p>
                    </div>
                  </div>

                  {/* Exposure bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-fx-text-dim mb-1">
                      <span>Exposure</span>
                      <span>
                        ${(p.outstanding_amount / 1000).toFixed(0)}K / $
                        {(p.exposure_limit / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.outstanding_amount / p.exposure_limit > 0.8
                            ? 'bg-red-400'
                            : 'bg-fx-orange'
                        }`}
                        style={{
                          width: `${Math.min((p.outstanding_amount / p.exposure_limit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Edit exposure */}
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="flex-1 h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                        placeholder="New limit"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                      />
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            companyId: p.company_id,
                            limit: parseInt(newLimit),
                          })
                        }
                        disabled={!newLimit || updateMutation.isPending}
                        className="h-8 px-3 rounded-lg bg-fx-orange text-white text-xs font-semibold disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-8 px-3 rounded-lg border border-fx-border text-fx-text-dim text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(p.company_id);
                        setNewLimit(String(p.exposure_limit));
                      }}
                      className="text-[10px] font-semibold text-fx-orange hover:text-fx-orange/80 transition-colors"
                    >
                      Adjust Exposure Limit
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav role="carrier" />
    </div>
  );
}
