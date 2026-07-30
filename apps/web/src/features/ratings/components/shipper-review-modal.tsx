import { useState } from 'react';
import { Star, AlertCircle } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { useSubmitShipperReview } from '@/features/ratings/hooks/use-trust-profile';

interface Props {
  open: boolean;
  onClose: () => void;
  loadId: string;
  reviewerCompanyId: string;
  reviewedCompanyId: string;
  reviewedCompanyName: string;
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span className="text-sm text-fx-text-muted">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n)} className="p-0.5">
            <Star
              size={20}
              className={n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShipperReviewModal({
  open,
  onClose,
  loadId,
  reviewerCompanyId,
  reviewedCompanyId,
  reviewedCompanyName,
}: Props) {
  const [overall, setOverall] = useState(0);
  const [loadingEfficiency, setLoadingEfficiency] = useState(0);
  const [dockWaitTime, setDockWaitTime] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [facilityQuality, setFacilityQuality] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [detentionMinutes, setDetentionMinutes] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useSubmitShipperReview();

  async function handleSubmit() {
    if (overall === 0) {
      setError('Overall rating is required');
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({
        loadId,
        reviewerCompanyId,
        reviewedCompanyId,
        overallRating: overall,
        loadingEfficiency: loadingEfficiency || undefined,
        dockWaitTime: dockWaitTime || undefined,
        communication: communication || undefined,
        facilityQuality: facilityQuality || undefined,
        accuracy: accuracy || undefined,
        detentionMinutes: detentionMinutes ? parseInt(detentionMinutes, 10) : undefined,
        comment: comment || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit review');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Review ${reviewedCompanyName}`}>
      <div className="space-y-1">
        <StarRow label="Overall *" value={overall} onChange={setOverall} />
        <StarRow
          label="Loading Efficiency"
          value={loadingEfficiency}
          onChange={setLoadingEfficiency}
        />
        <StarRow label="Dock Wait Time" value={dockWaitTime} onChange={setDockWaitTime} />
        <StarRow label="Communication" value={communication} onChange={setCommunication} />
        <StarRow label="Facility Quality" value={facilityQuality} onChange={setFacilityQuality} />
        <StarRow label="Accuracy" value={accuracy} onChange={setAccuracy} />
      </div>

      <div className="mt-4">
        <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
          Detention (minutes)
        </label>
        <input
          type="number"
          className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
          placeholder="0"
          value={detentionMinutes}
          onChange={(e) => setDetentionMinutes(e.target.value)}
        />
      </div>

      <div className="mt-3">
        <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
          Comment
        </label>
        <textarea
          className="w-full h-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-fx-text resize-none focus:outline-none focus:border-fx-orange"
          placeholder="Share your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={mutation.isPending || overall === 0}
        className="mt-4 w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-bold transition-colors"
      >
        {mutation.isPending ? 'Submitting...' : 'Submit Review'}
      </button>
    </BottomSheet>
  );
}
