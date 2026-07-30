import { useState } from 'react';
import { ChevronDown, ChevronUp, Building2, Shield, TrendingUp, Star } from 'lucide-react';
import { useCarrierRankings } from '@/features/loads/hooks/use-carrier-rankings';
import { InviteCarriersSheet } from './invite-carriers-sheet';

interface Props {
  loadId: string;
}

function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-fx-text-dim w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-fx-orange" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-fx-text-muted font-bold w-6 text-right">{value}</span>
    </div>
  );
}

export function RecommendedCarriersPanel({ loadId }: Props) {
  const { carriers, loading } = useCarrierRankings(loadId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="w-5 h-5 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (carriers.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-fx-text-dim text-xs">No eligible carriers found for this load.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {carriers.slice(0, 10).map((c, i) => {
          const isExpanded = expandedId === c.company_id;
          return (
            <div
              key={c.company_id}
              className="bg-fx-surface border border-fx-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : c.company_id)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-fx-surface-2 transition-colors"
              >
                {/* Rank */}
                <span className="w-6 h-6 rounded-lg bg-fx-orange/10 text-fx-orange text-xs font-extrabold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fx-text truncate">{c.company_name}</p>
                  <p className="text-[10px] text-fx-text-dim">
                    {c.mc_number && `MC# ${c.mc_number}`}
                  </p>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-extrabold text-fx-orange">{c.total_score}</span>
                  <span className="text-[10px] text-fx-text-dim">pts</span>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-fx-text-dim" />
                  ) : (
                    <ChevronDown size={14} className="text-fx-text-dim" />
                  )}
                </div>
              </button>

              {/* Expanded score breakdown */}
              {isExpanded && (
                <div
                  className="px-3 pb-3 space-y-1.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="pt-2" />
                  <ScoreBar label="Equipment" value={c.equipment_score} max={25} />
                  <ScoreBar label="Lane Pref" value={c.lane_preference_score} max={20} />
                  <ScoreBar label="Availability" value={c.availability_score} max={15} />
                  <ScoreBar label="History" value={c.history_score} max={15} />
                  <ScoreBar label="Saved Search" value={c.saved_search_score} max={10} />
                  <ScoreBar label="Rating" value={c.rating_score} max={10} />
                  <ScoreBar label="Preferred" value={c.preferred_score} max={5} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setInviteOpen(true)}
        className="mt-3 w-full h-10 rounded-xl border border-fx-orange/40 text-fx-orange text-xs font-semibold hover:bg-fx-orange/10 transition-colors"
      >
        Invite Carriers to Bid
      </button>

      <InviteCarriersSheet open={inviteOpen} onClose={() => setInviteOpen(false)} loadId={loadId} />
    </>
  );
}
