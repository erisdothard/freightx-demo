import { useState } from 'react';
import { DollarSign, FileText, Zap } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { submitBid } from '@/services/bids.service';
import { useAuth } from '@/contexts/AuthContext';
import type { Load } from '@freightx/shared';

interface BidSheetProps {
  open: boolean;
  onClose: () => void;
  load: Load | null;
  onBidSubmitted?: () => void;
}

export function BidSheet({ open, onClose, load, onBidSubmitted }: BidSheetProps) {
  const { user, company } = useAuth();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const askingRate = load?.rateUsd ?? 0;
  const bidNum = parseFloat(amount);
  const diff = bidNum && askingRate ? ((bidNum - askingRate) / askingRate) * 100 : 0;

  function handleClose() {
    setAmount('');
    setNotes('');
    setError(null);
    setSuccess(false);
    onClose();
  }

  async function handleSubmit() {
    if (!user || !load || !bidNum || bidNum <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitBid({
        loadId: load.id,
        carrierId: user.id,
        companyId: company?.id ?? null,
        companyName: company?.name ?? 'Independent Carrier',
        amountUsd: bidNum,
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
        onBidSubmitted?.();
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  }

  if (!load) return null;

  const inputClass =
    'w-full h-12 bg-fx-surface border border-fx-border rounded-2xl px-4 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all';

  return (
    <BottomSheet open={open} onClose={handleClose} title="Submit Bid">
      {success ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mb-4">
            <Zap size={28} className="text-green-400" />
          </div>
          <p className="text-lg font-bold text-fx-text">Bid Submitted!</p>
          <p className="text-sm text-fx-text-muted mt-1">The broker will be notified</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Load summary */}
          <div className="bg-fx-surface-2 border border-fx-border rounded-2xl p-4">
            <p className="text-xs text-fx-text-dim font-semibold uppercase tracking-widest mb-1">
              {load.loadNumber}
            </p>
            <p className="text-sm font-bold text-fx-text">
              {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-fx-text-muted">{load.equipment}</span>
              <span className="text-xs text-fx-text-dim">·</span>
              <span className="text-xs font-semibold text-fx-orange">
                Asking ${load.rateUsd.toLocaleString()}
              </span>
              {load.totalMiles && (
                <>
                  <span className="text-xs text-fx-text-dim">·</span>
                  <span className="text-xs text-fx-text-muted">
                    {load.totalMiles.toLocaleString()} mi
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Bid amount */}
          <div>
            <label className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 block">
              Your Bid Amount
            </label>
            <div className="relative">
              <DollarSign
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
              />
              <input
                type="number"
                min="1"
                step="50"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
            {/* Delta indicator */}
            {bidNum > 0 && (
              <p
                className={`text-xs mt-1.5 font-semibold ${
                  diff > 5 ? 'text-red-400' : diff < -5 ? 'text-green-400' : 'text-fx-text-muted'
                }`}
              >
                {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`} vs asking rate
                {load.totalMiles ? ` · $${(bidNum / load.totalMiles).toFixed(2)}/mi` : ''}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 block">
              Notes{' '}
              <span className="text-fx-text-dim font-normal normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <div className="relative">
              <FileText size={15} className="absolute left-3.5 top-3.5 text-fx-text-dim" />
              <textarea
                rows={3}
                placeholder="Available immediately, experienced with this lane…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-fx-surface border border-fx-border rounded-2xl pl-9 pr-4 py-3 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !amount || bidNum <= 0}
            className="w-full h-12 bg-fx-orange rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white disabled:opacity-50 transition-opacity"
          >
            {submitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Zap size={16} />
                Submit Bid · ${bidNum > 0 ? bidNum.toLocaleString() : '—'}
              </>
            )}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
