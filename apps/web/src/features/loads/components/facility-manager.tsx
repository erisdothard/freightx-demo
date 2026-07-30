import { useState } from 'react';
import { Building2, Plus, AlertCircle } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { useCreateFacility } from '@/features/loads/hooks/use-dock-scheduling';
import type { Facility } from '@/services/dock-scheduling.service';

interface Props {
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  companyId: string;
}

export function FacilityManager({ facilities, selectedId, onSelect, companyId }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateFacility();

  async function handleCreate() {
    if (!name || !address || !city || !state || !zip) {
      setError('All fields are required');
      return;
    }
    setError(null);
    try {
      const facility = await createMutation.mutateAsync({
        companyId,
        name,
        address,
        city,
        state,
        zip,
      });
      onSelect(facility.id);
      setAddOpen(false);
      setName('');
      setAddress('');
      setCity('');
      setState('');
      setZip('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create facility');
    }
  }

  return (
    <>
      <div className="space-y-2">
        {facilities.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
              selectedId === f.id
                ? 'bg-fx-orange/10 border-fx-orange/40'
                : 'bg-fx-surface border-fx-border hover:bg-fx-surface-2'
            }`}
          >
            <Building2
              size={16}
              className={selectedId === f.id ? 'text-fx-orange' : 'text-fx-text-muted'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fx-text truncate">{f.name}</p>
              <p className="text-xs text-fx-text-muted">
                {f.city}, {f.state}
              </p>
            </div>
          </button>
        ))}

        <button
          onClick={() => setAddOpen(true)}
          className="w-full h-10 rounded-xl border border-dashed border-fx-border text-xs font-semibold text-fx-text-dim flex items-center justify-center gap-1.5 hover:border-fx-orange/40 hover:text-fx-orange transition-colors"
        >
          <Plus size={14} />
          Add Facility
        </button>
      </div>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Facility">
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              Name
            </label>
            <input
              className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Warehouse name"
            />
          </div>
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              Address
            </label>
            <input
              className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                City
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                State
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                ZIP
              </label>
              <input
                className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="mt-4 w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-bold transition-colors"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Facility'}
        </button>
      </BottomSheet>
    </>
  );
}
