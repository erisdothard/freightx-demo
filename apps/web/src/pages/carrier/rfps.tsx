import { useState } from 'react';
import { FileText, DollarSign, AlertCircle } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { RfpDetailSheet } from '@/features/loads/components/rfp-detail-sheet';
import { useOpenRfps, useRfpLanes, useSubmitProposal } from '@/features/loads/hooks/use-rfps';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';
import type { Rfp, RfpLane } from '@/services/rfp.service';

export default function CarrierRfpsPage() {
  const { profile, company } = useAuth();
  const role = getNavRole(profile?.role);
  const { rfps, loading } = useOpenRfps();
  const [selectedRfp, setSelectedRfp] = useState<Rfp | null>(null);
  const [proposeLane, setProposeLane] = useState<{ rfp: Rfp; lane: RfpLane } | null>(null);
  const [rate, setRate] = useState('');
  const [transitDays, setTransitDays] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitProposal = useSubmitProposal();

  async function handleSubmit() {
    if (!proposeLane || !rate || !company?.id) return;
    setError(null);
    try {
      await submitProposal.mutateAsync({
        rfpId: proposeLane.rfp.id,
        rfpLaneId: proposeLane.lane.id,
        carrierCompanyId: company.id,
        submittedBy: profile?.id ?? '',
        proposedRateUsd: parseFloat(rate),
        transitDays: transitDays ? parseInt(transitDays) : undefined,
        notes: notes || undefined,
      });
      setProposeLane(null);
      setRate('');
      setTransitDays('');
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit proposal');
    }
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Open RFPs" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <SkeletonList count={3} />
        ) : rfps.length === 0 ? (
          <EmptyState icon={<FileText size={24} />} title="No open RFPs" />
        ) : (
          <div className="space-y-3">
            {rfps.map((rfp) => (
              <RfpCard
                key={rfp.id}
                rfp={rfp}
                onView={() => setSelectedRfp(rfp)}
                onPropose={(lane) => setProposeLane({ rfp, lane })}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav role={role} />

      {selectedRfp && (
        <RfpDetailSheet
          open={!!selectedRfp}
          onClose={() => setSelectedRfp(null)}
          rfp={selectedRfp}
          isOwner={false}
        />
      )}

      {/* Propose sheet */}
      <BottomSheet
        open={!!proposeLane}
        onClose={() => setProposeLane(null)}
        title="Submit Proposal"
      >
        {proposeLane && (
          <div className="space-y-3">
            <p className="text-xs text-fx-text-muted">
              {proposeLane.lane.origin_city}, {proposeLane.lane.origin_state} →{' '}
              {proposeLane.lane.dest_city}, {proposeLane.lane.dest_state}
            </p>
            {proposeLane.lane.target_rate_usd && (
              <p className="text-xs text-fx-text-dim">
                Target: ${proposeLane.lane.target_rate_usd}
              </p>
            )}

            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Proposed Rate *
              </label>
              <input
                type="number"
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="$0.00"
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Transit Days
              </label>
              <input
                type="number"
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
                value={transitDays}
                onChange={(e) => setTransitDays(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                className="w-full h-16 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-fx-text resize-none focus:outline-none focus:border-fx-orange"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitProposal.isPending || !rate}
              className="w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-bold transition-colors"
            >
              {submitProposal.isPending ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function RfpCard({
  rfp,
  onView,
  onPropose,
}: {
  rfp: Rfp;
  onView: () => void;
  onPropose: (lane: RfpLane) => void;
}) {
  const { lanes } = useRfpLanes(rfp.id);

  return (
    <div className="bg-fx-surface border border-fx-border rounded-xl p-4">
      <button onClick={onView} className="w-full text-left mb-2">
        <p className="text-sm font-bold text-fx-text">{rfp.title}</p>
        <p className="text-xs text-fx-text-muted mt-0.5">
          Deadline: {rfp.deadline ? new Date(rfp.deadline).toLocaleDateString() : 'None'}
        </p>
      </button>

      {lanes.length > 0 && (
        <div className="space-y-1.5">
          {lanes.slice(0, 3).map((lane) => (
            <button
              key={lane.id}
              onClick={() => onPropose(lane)}
              className="w-full flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-left hover:border-fx-orange/30 transition-colors"
            >
              <span className="text-xs text-fx-text flex-1">
                {lane.origin_city}, {lane.origin_state} → {lane.dest_city}, {lane.dest_state}
              </span>
              {lane.target_rate_usd && (
                <span className="text-[10px] text-fx-text-dim flex items-center gap-0.5">
                  <DollarSign size={9} />${lane.target_rate_usd}
                </span>
              )}
            </button>
          ))}
          {lanes.length > 3 && (
            <p className="text-[10px] text-fx-text-dim text-center">
              +{lanes.length - 3} more lanes
            </p>
          )}
        </div>
      )}
    </div>
  );
}
