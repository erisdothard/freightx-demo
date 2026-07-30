import { MapPin, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import type { BackhaulOpportunity } from '@/services/lane-suggestions.service';

interface Props {
  opportunity: BackhaulOpportunity;
  onView?: (loadId: string) => void;
}

export function BackhaulCard({ opportunity: opp, onView }: Props) {
  return (
    <button
      onClick={() => onView?.(opp.load_id)}
      className="w-full bg-fx-surface border border-fx-border rounded-xl p-3 text-left hover:bg-fx-surface-2 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={13} className="text-fx-orange shrink-0" />
        <span className="text-sm font-semibold text-fx-text truncate">
          {opp.origin_city}, {opp.origin_state}
        </span>
        <ArrowRight size={12} className="text-fx-text-dim shrink-0" />
        <span className="text-sm font-semibold text-fx-text truncate">
          {opp.destination_city}, {opp.destination_state}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-fx-text-muted">
        <span className="flex items-center gap-1">
          <DollarSign size={11} />${opp.rate_usd?.toLocaleString()}
        </span>
        <span>{opp.total_miles} mi</span>
        <span className="uppercase text-fx-text-dim">{opp.equipment_type}</span>
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          {new Date(opp.pickup_date).toLocaleDateString()}
        </span>
      </div>

      {opp.deadhead_miles != null && (
        <div className="mt-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-emerald-400 bg-emerald-400/10">
            {opp.deadhead_miles} mi deadhead
          </span>
        </div>
      )}
    </button>
  );
}
