import { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { StarRating } from './StarRating';
import { submitRating } from '@/services/ratings.service';

interface Props {
  loadId: string;
  loadNumber: string;
  raterId: string;
  ratedCompanyId: string;
  ratedCompanyName: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

interface SubRatings {
  communication: number;
  reliability: number;
  professionalism: number;
}

export function RatingModal({
  loadId,
  loadNumber,
  raterId,
  ratedCompanyId,
  ratedCompanyName,
  onClose,
  onSubmitted,
}: Props) {
  const [overall, setOverall] = useState(0);
  const [sub, setSub] = useState<SubRatings>({
    communication: 0,
    reliability: 0,
    professionalism: 0,
  });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!overall) return;
    setLoading(true);
    setError(null);
    try {
      await submitRating({
        loadId,
        raterId,
        ratedCompanyId,
        overall,
        communication: sub.communication || undefined,
        reliability: sub.reliability || undefined,
        professionalism: sub.professionalism || undefined,
        comment: comment.trim() || undefined,
      });
      onSubmitted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 mx-4 mb-0 sm:mb-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-fx-text-main">Rate Your Experience</h3>
            <p className="text-xs text-fx-text-dim mt-0.5">
              {loadNumber} · {ratedCompanyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-fx-text-dim hover:text-fx-text-main transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Overall */}
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-xs text-fx-text-dim uppercase tracking-wider">Overall Rating</p>
          <StarRating value={overall} onChange={setOverall} size={32} />
          <p className="text-xs text-fx-text-dim h-4">
            {overall === 1 && 'Poor'}
            {overall === 2 && 'Below Average'}
            {overall === 3 && 'Average'}
            {overall === 4 && 'Good'}
            {overall === 5 && 'Excellent'}
          </p>
        </div>

        {/* Sub-ratings */}
        <div className="space-y-2 border-t border-zinc-800 pt-3">
          {(['communication', 'reliability', 'professionalism'] as const).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-fx-text-dim capitalize">{key}</span>
              <StarRating
                value={sub[key]}
                onChange={(v) => setSub((s) => ({ ...s, [key]: v }))}
                size={16}
              />
            </div>
          ))}
        </div>

        {/* Comment */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] text-fx-text-dim uppercase tracking-wider mb-1.5">
            <MessageSquare size={11} />
            Comment (optional)
          </label>
          <textarea
            className="w-full h-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-fx-text-main resize-none focus:outline-none focus:border-fx-orange"
            placeholder="Share your experience…"
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <p className="text-[10px] text-fx-text-dim text-right mt-0.5">{comment.length}/500</p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !overall}
          className="h-11 w-full bg-fx-orange hover:bg-fx-orange/90 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? 'Submitting…' : 'Submit Rating'}
        </button>
      </div>
    </div>
  );
}
