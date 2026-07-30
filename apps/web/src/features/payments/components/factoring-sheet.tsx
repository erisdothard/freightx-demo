import { useState } from 'react';
import { DollarSign, Zap, Info, X } from 'lucide-react';
import { requestFactoring } from '@/services/factoring.service';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/shared/lib/utils';

interface FactoringSheetProps {
  loadId: string;
  loadNumber: string;
  invoiceAmount: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const FEE_OPTIONS = [
  { label: '3%', value: 3, funding: '24-48 hrs' },
  { label: '4%', value: 4, funding: 'Same day' },
  { label: '5%', value: 5, funding: '4-6 hrs' },
];

export function FactoringSheet({
  loadId,
  loadNumber,
  invoiceAmount,
  open,
  onClose,
  onSuccess,
}: FactoringSheetProps) {
  const { user, company } = useAuth();
  const [selectedFee, setSelectedFee] = useState(3);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const netPayout = invoiceAmount - invoiceAmount * (selectedFee / 100);
  const feeAmount = invoiceAmount * (selectedFee / 100);
  const feeOption = FEE_OPTIONS.find((f) => f.value === selectedFee)!;

  async function handleSubmit() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await requestFactoring({
        carrierId: user.id,
        companyId: company?.id ?? null,
        loadId,
        loadNumber,
        invoiceAmount,
        feePercent: selectedFee,
        notes: notes.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-fx-surface rounded-t-ios-sm pb-safe-area-inset-bottom max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-fx-border rounded-full" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-fx-orange" />
              <h2 className="text-[17px] font-bold text-white">QuickPay / Factoring</h2>
            </div>
            <button onClick={onClose} className="p-1 text-fx-text-dim hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Load info */}
          <div className="bg-fx-surface-2 rounded-ios-xs p-4 mb-5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] text-fx-text-dim uppercase tracking-wider">Load</span>
              <span className="text-[13px] font-bold text-white">{loadNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-fx-text-dim uppercase tracking-wider">Invoice</span>
              <span className="text-[20px] font-extrabold text-white">
                ${invoiceAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Fee selector */}
          <div className="mb-5">
            <label className="text-[11px] font-bold text-fx-text-dim uppercase tracking-wider block mb-3">
              Funding Speed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FEE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedFee(opt.value)}
                  className={cn(
                    'p-3 rounded-ios-xs border text-center transition-colors',
                    selectedFee === opt.value
                      ? 'border-fx-orange bg-fx-orange/10'
                      : 'border-fx-border bg-fx-surface-2 hover:border-fx-orange/40',
                  )}
                >
                  <div
                    className={cn(
                      'text-[18px] font-extrabold',
                      selectedFee === opt.value ? 'text-fx-orange' : 'text-white',
                    )}
                  >
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-fx-text-dim mt-0.5">{opt.funding}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Payout breakdown */}
          <div className="bg-fx-surface-2 rounded-ios-xs p-4 mb-5 space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-fx-text-dim">Invoice amount</span>
              <span className="text-white">${invoiceAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-fx-text-dim">Factor fee ({selectedFee}%)</span>
              <span className="text-red-400">
                −${feeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="border-t border-fx-border pt-2 flex justify-between">
              <span className="text-[14px] font-bold text-white">You receive</span>
              <span className="text-[18px] font-extrabold text-emerald-400">
                ${netPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Info size={11} className="text-fx-text-dim shrink-0" />
              <span className="text-[11px] text-fx-text-dim">
                Funds deposited within {feeOption.funding} of approval.
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-5">
            <label className="text-[11px] font-bold text-fx-text-dim uppercase tracking-wider block mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={2}
              className="w-full bg-fx-surface-2 border border-fx-border rounded-ios-xs px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-fx-orange"
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="w-full h-12 bg-fx-orange rounded-ios-xs font-bold text-white text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active-scale"
          >
            <DollarSign size={16} />
            {loading ? 'Submitting...' : `Request ${feeOption.funding} Payout`}
          </button>
        </div>
      </div>
    </div>
  );
}
