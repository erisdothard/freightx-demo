import { useState } from 'react';
import { MapPin, DollarSign, Check, Award } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { useRfpLanes, useRfpProposals, useAwardLane } from '@/features/loads/hooks/use-rfps';
import type { Rfp } from '@/services/rfp.service';

interface Props {
  open: boolean;
  onClose: () => void;
  rfp: Rfp;
  isOwner: boolean;
}

export function RfpDetailSheet({ open, onClose, rfp, isOwner }: Props) {
  const { lanes } = useRfpLanes(rfp.id);
  const { proposals } = useRfpProposals(rfp.id);
  const awardLane = useAwardLane();
  const [tab, setTab] = useState<'lanes' | 'proposals'>('lanes');

  return (
    <BottomSheet open={open} onClose={onClose} title={rfp.title}>
      {/* Info */}
      <div className="mb-4 space-y-1">
        <p className="text-xs text-fx-text-muted">{rfp.description}</p>
        <div className="flex gap-3 text-[10px] text-fx-text-dim">
          <span>Start: {new Date(rfp.contract_start).toLocaleDateString()}</span>
          <span>End: {new Date(rfp.contract_end).toLocaleDateString()}</span>
          {rfp.deadline && (
            <span className="text-fx-orange font-bold">
              Deadline: {new Date(rfp.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
        <span
          className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
            rfp.status === 'open'
              ? 'text-emerald-400 bg-emerald-400/10'
              : rfp.status === 'evaluating'
                ? 'text-amber-400 bg-amber-400/10'
                : rfp.status === 'awarded'
                  ? 'text-blue-400 bg-blue-400/10'
                  : 'text-zinc-400 bg-zinc-400/10'
          }`}
        >
          {rfp.status}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('lanes')}
          className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${
            tab === 'lanes'
              ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
              : 'bg-fx-surface border-fx-border text-fx-text-dim'
          }`}
        >
          Lanes ({lanes.length})
        </button>
        <button
          onClick={() => setTab('proposals')}
          className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${
            tab === 'proposals'
              ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
              : 'bg-fx-surface border-fx-border text-fx-text-dim'
          }`}
        >
          Proposals ({proposals.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto scrollbar-hide">
        {tab === 'lanes' &&
          lanes.map((lane) => (
            <div key={lane.id} className="bg-fx-surface border border-fx-border rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={13} className="text-fx-orange shrink-0" />
                <span className="font-semibold text-fx-text">
                  {lane.origin_city}, {lane.origin_state} → {lane.dest_city}, {lane.dest_state}
                </span>
              </div>
              <div className="flex gap-3 mt-1.5 text-xs text-fx-text-muted">
                <span className="uppercase">{lane.equipment}</span>
                {lane.target_rate_usd && (
                  <span className="flex items-center gap-0.5">
                    <DollarSign size={10} />${lane.target_rate_usd}
                  </span>
                )}
                {lane.loads_per_week && <span>{lane.loads_per_week}/wk</span>}
              </div>
            </div>
          ))}

        {tab === 'proposals' &&
          proposals.map((p) => (
            <div
              key={p.id}
              className="bg-fx-surface border border-fx-border rounded-xl p-3 flex items-center gap-3"
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-fx-text">{p.carrier_name ?? 'Carrier'}</p>
                <div className="flex gap-3 text-xs text-fx-text-muted mt-0.5">
                  <span className="font-bold text-fx-orange">
                    ${p.proposed_rate_usd.toLocaleString()}
                  </span>
                  {p.transit_days && <span>{p.transit_days} days</span>}
                </div>
                {p.notes && <p className="text-[10px] text-fx-text-dim mt-1">{p.notes}</p>}
              </div>
              {p.status === 'awarded' ? (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <Award size={12} /> Awarded
                </span>
              ) : isOwner && rfp.status === 'evaluating' ? (
                <button
                  onClick={() => awardLane.mutate(p.id)}
                  disabled={awardLane.isPending}
                  className="h-7 px-3 rounded-lg bg-fx-orange/10 border border-fx-orange/30 text-fx-orange text-[10px] font-semibold flex items-center gap-1 hover:bg-fx-orange/20 transition-colors disabled:opacity-40"
                >
                  <Check size={10} /> Award
                </button>
              ) : (
                <span className="text-[10px] font-semibold text-fx-text-dim capitalize">
                  {p.status}
                </span>
              )}
            </div>
          ))}
      </div>
    </BottomSheet>
  );
}
