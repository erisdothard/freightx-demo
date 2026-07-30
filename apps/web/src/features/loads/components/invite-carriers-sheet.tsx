import { useState } from 'react';
import { Search, Check, AlertCircle, Building2 } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { searchCarriersForInvite } from '@/services/invitations.service';
import { useInviteCarriers } from '@/features/loads/hooks/use-invitations';

interface Props {
  open: boolean;
  onClose: () => void;
  loadId: string;
}

interface CarrierResult {
  id: string;
  name: string;
  mc_number: string | null;
  city: string | null;
  state: string | null;
}

export function InviteCarriersSheet({ open, onClose, loadId }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CarrierResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const inviteMutation = useInviteCarriers();

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await searchCarriersForInvite(query.trim());
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  function toggleCarrier(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleInvite() {
    if (selected.size === 0) return;
    setError(null);
    try {
      await inviteMutation.mutateAsync({
        loadId,
        carrierCompanyIds: Array.from(selected),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invitations');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Invite Carriers">
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fx-text-dim" />
          <input
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            placeholder="Search by name or MC#..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="h-10 px-4 bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-hide">
        {results.map((carrier) => (
          <button
            key={carrier.id}
            onClick={() => toggleCarrier(carrier.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
              selected.has(carrier.id)
                ? 'bg-fx-orange/10 border-fx-orange/40'
                : 'bg-fx-surface border-fx-border hover:bg-fx-surface-2'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-fx-surface-2 border border-fx-border flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-fx-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fx-text truncate">{carrier.name}</p>
              <p className="text-xs text-fx-text-muted">
                {carrier.mc_number && `MC# ${carrier.mc_number}`}
                {carrier.city && carrier.state && ` · ${carrier.city}, ${carrier.state}`}
              </p>
            </div>
            {selected.has(carrier.id) && <Check size={18} className="text-fx-orange shrink-0" />}
          </button>
        ))}
        {results.length === 0 && !searching && query && (
          <p className="text-center text-fx-text-dim text-sm py-6">No carriers found</p>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <button
          onClick={handleInvite}
          disabled={inviteMutation.isPending}
          className="mt-4 w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-bold transition-colors"
        >
          {inviteMutation.isPending
            ? 'Sending...'
            : `Invite ${selected.size} Carrier${selected.size > 1 ? 's' : ''}`}
        </button>
      )}
    </BottomSheet>
  );
}
