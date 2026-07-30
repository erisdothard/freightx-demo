import { MapPin, Calendar, DollarSign, Check, X } from 'lucide-react';
import { useRespondToInvitation } from '@/features/loads/hooks/use-invitations';
import type { LoadInvitation } from '@/services/invitations.service';

interface Props {
  invitations: LoadInvitation[];
  onViewLoad?: (loadId: string) => void;
}

export function InvitationsList({ invitations, onViewLoad }: Props) {
  const respondMutation = useRespondToInvitation();

  if (invitations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-fx-text-muted text-sm">No invitations yet</p>
        <p className="text-fx-text-dim text-xs mt-1">
          Brokers can invite you to bid on private loads.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((inv) => {
        const load = inv.load;
        const isPending = inv.status === 'pending';

        return (
          <div
            key={inv.id}
            className="bg-fx-surface border border-fx-border rounded-2xl p-4 space-y-3"
          >
            {/* Route */}
            {load && (
              <button onClick={() => onViewLoad?.(inv.load_id)} className="w-full text-left">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-fx-orange shrink-0" />
                  <span className="font-semibold text-fx-text">
                    {load.origin_city}, {load.origin_state}
                  </span>
                  <span className="text-fx-text-dim">→</span>
                  <span className="font-semibold text-fx-text">
                    {load.destination_city}, {load.destination_state}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-fx-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(load.pickup_date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign size={11} />${load.rate_usd?.toLocaleString()}
                  </span>
                  <span className="uppercase text-fx-text-dim">{load.equipment_type}</span>
                </div>
              </button>
            )}

            {/* Status / Actions */}
            {isPending ? (
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    respondMutation.mutate({ invitationId: inv.id, status: 'accepted' })
                  }
                  disabled={respondMutation.isPending}
                  className="flex-1 h-9 rounded-xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <Check size={13} />
                  Accept
                </button>
                <button
                  onClick={() =>
                    respondMutation.mutate({ invitationId: inv.id, status: 'declined' })
                  }
                  disabled={respondMutation.isPending}
                  className="flex-1 h-9 rounded-xl border border-fx-border text-fx-text-muted text-xs font-semibold flex items-center justify-center gap-1 hover:border-red-500/40 hover:text-red-400 transition-colors"
                >
                  <X size={13} />
                  Decline
                </button>
              </div>
            ) : (
              <div
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg w-fit ${
                  inv.status === 'accepted'
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : inv.status === 'declined'
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-amber-400 bg-amber-400/10'
                }`}
              >
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </div>
            )}

            {/* Expiry */}
            {inv.expires_at && isPending && (
              <p className="text-[10px] text-fx-text-dim">
                Expires {new Date(inv.expires_at).toLocaleString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
