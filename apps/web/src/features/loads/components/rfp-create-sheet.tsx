import { useState } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { useCreateRfp, useAddRfpLane } from '@/features/loads/hooks/use-rfps';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

interface LaneInput {
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  equipmentType: string;
  targetRate: string;
  volumePerWeek: string;
}

const EMPTY_LANE: LaneInput = {
  originCity: '',
  originState: '',
  destinationCity: '',
  destinationState: '',
  equipmentType: 'van',
  targetRate: '',
  volumePerWeek: '',
};

export function RfpCreateSheet({ open, onClose, companyId }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [lanes, setLanes] = useState<LaneInput[]>([{ ...EMPTY_LANE }]);
  const [error, setError] = useState<string | null>(null);

  const createRfp = useCreateRfp();
  const addLane = useAddRfpLane();
  const saving = createRfp.isPending || addLane.isPending;

  function updateLane(idx: number, key: keyof LaneInput, value: string) {
    setLanes((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }

  async function handleCreate() {
    if (!title || !startDate || !endDate || !deadline) {
      setError('Title, dates, and deadline are required');
      return;
    }
    setError(null);
    try {
      const rfp = await createRfp.mutateAsync({
        companyId,
        createdBy: user!.id,
        title,
        description: description || undefined,
        contractStart: startDate,
        contractEnd: endDate,
        deadline: deadline || undefined,
      });

      // Add lanes
      for (const lane of lanes) {
        if (lane.originState && lane.destinationState) {
          await addLane.mutateAsync({
            rfpId: rfp.id,
            originCity: lane.originCity || undefined,
            originState: lane.originState,
            destCity: lane.destinationCity || undefined,
            destState: lane.destinationState,
            equipment: lane.equipmentType || undefined,
            targetRateUsd: lane.targetRate ? parseFloat(lane.targetRate) : undefined,
            loadsPerWeek: lane.volumePerWeek ? parseInt(lane.volumePerWeek) : undefined,
          });
        }
      }

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create RFP');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Create RFP">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
            Title *
          </label>
          <input
            className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Q3 2026 Lane RFP"
          />
        </div>
        <div>
          <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            className="w-full h-16 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-fx-text resize-none focus:outline-none focus:border-fx-orange"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              Start *
            </label>
            <input
              type="date"
              className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              End *
            </label>
            <input
              type="date"
              className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
              Deadline *
            </label>
            <input
              type="date"
              className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        {/* Lanes */}
        <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest pt-2">
          Lanes
        </p>
        {lanes.map((lane, idx) => (
          <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                placeholder="Origin City"
                value={lane.originCity}
                onChange={(e) => updateLane(idx, 'originCity', e.target.value)}
              />
              <input
                className="h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                placeholder="ST"
                maxLength={2}
                value={lane.originState}
                onChange={(e) => updateLane(idx, 'originState', e.target.value)}
              />
              <input
                className="h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                placeholder="Dest City"
                value={lane.destinationCity}
                onChange={(e) => updateLane(idx, 'destinationCity', e.target.value)}
              />
              <input
                className="h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                placeholder="ST"
                maxLength={2}
                value={lane.destinationState}
                onChange={(e) => updateLane(idx, 'destinationState', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                placeholder="Target Rate $"
                value={lane.targetRate}
                onChange={(e) => updateLane(idx, 'targetRate', e.target.value)}
              />
              <input
                className="h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-fx-text focus:outline-none focus:border-fx-orange"
                placeholder="Vol/Week"
                value={lane.volumePerWeek}
                onChange={(e) => updateLane(idx, 'volumePerWeek', e.target.value)}
              />
            </div>
          </div>
        ))}
        <button
          onClick={() => setLanes((prev) => [...prev, { ...EMPTY_LANE }])}
          className="w-full h-9 rounded-lg border border-dashed border-fx-border text-xs font-semibold text-fx-text-dim flex items-center justify-center gap-1 hover:border-fx-orange/40 hover:text-fx-orange transition-colors"
        >
          <Plus size={13} /> Add Lane
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={saving}
        className="mt-4 w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-bold transition-colors"
      >
        {saving ? 'Creating...' : 'Create RFP'}
      </button>
    </BottomSheet>
  );
}
