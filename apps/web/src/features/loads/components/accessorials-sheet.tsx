import { useState, useEffect } from 'react';
import { Plus, Check, X, Loader2 } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import {
  getAccessorials,
  addAccessorial,
  approveAccessorial,
  denyAccessorial,
  getApprovedAccessorialTotal,
  ACCESSORIAL_LABELS,
  type AccessorialCharge,
  type AccessorialType,
} from '@/services/accessorials.service';
import { useAuth } from '@/contexts/AuthContext';

const TYPES: AccessorialType[] = [
  'detention',
  'lumper',
  'layover',
  'tonu',
  'fuel_surcharge',
  'other',
];

const STATUS_COLORS = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  approved: 'text-green-400 bg-green-400/10',
  denied: 'text-red-400 bg-red-400/10',
};

interface AccessorialsSheetProps {
  open: boolean;
  onClose: () => void;
  loadId: string;
  bookingId?: string | null;
  baseRate: number;
  role: 'carrier' | 'broker' | 'shipper' | 'admin' | 'driver';
}

export function AccessorialsSheet({
  open,
  onClose,
  loadId,
  bookingId,
  baseRate,
  role,
}: AccessorialsSheetProps) {
  const { user } = useAuth();
  const [charges, setCharges] = useState<AccessorialCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<AccessorialType>('detention');
  const [addAmount, setAddAmount] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canApprove = role === 'broker' || role === 'admin';
  const canAdd = role === 'carrier' || role === 'admin';

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([getAccessorials(loadId), getApprovedAccessorialTotal(loadId)]).then(
      ([data, total]) => {
        setCharges(data);
        setApprovedTotal(total);
        setLoading(false);
      },
    );
  }, [open, loadId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const charge = await addAccessorial({
        loadId,
        bookingId: bookingId ?? null,
        type: addType,
        amountUsd: parseFloat(addAmount),
        notes: addNotes.trim() || undefined,
      });
      setCharges((prev) => [charge, ...prev]);
      setAddAmount('');
      setAddNotes('');
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add charge');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    await approveAccessorial(id);
    setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c)));
    const total = await getApprovedAccessorialTotal(loadId);
    setApprovedTotal(total);
  }

  async function handleDeny(id: string) {
    await denyAccessorial(id);
    setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'denied' } : c)));
  }

  const invoiceTotal = baseRate + approvedTotal;

  return (
    <BottomSheet open={open} onClose={onClose} title="Accessorial Charges">
      <div className="space-y-4">
        {/* Invoice summary */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(232,96,48,0.06)', border: '1px solid rgba(232,96,48,0.15)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-fx-text-muted uppercase tracking-wider">
              Base Rate
            </span>
            <span className="text-sm font-bold text-fx-text">${baseRate.toLocaleString()}</span>
          </div>
          {approvedTotal > 0 && (
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-xs font-bold text-fx-text-muted uppercase tracking-wider">
                Accessorials
              </span>
              <span className="text-sm font-bold text-green-400">
                +${approvedTotal.toLocaleString()}
              </span>
            </div>
          )}
          <div className="border-t border-fx-border mt-2.5 pt-2.5 flex justify-between items-center">
            <span className="text-xs font-bold text-fx-orange uppercase tracking-wider">
              Invoice Total
            </span>
            <span className="text-lg font-black text-fx-orange">
              ${invoiceTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Add charge button */}
        {canAdd && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-fx-orange"
          >
            <Plus size={14} />
            Add Accessorial Charge
          </button>
        )}

        {/* Add form */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="bg-fx-surface border border-fx-border rounded-xl p-4 space-y-3"
          >
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as AccessorialType)}
              className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 outline-none"
              style={{ colorScheme: 'dark' }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t} style={{ background: '#141414' }}>
                  {ACCESSORIAL_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount (USD)"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              required
              min="1"
              className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              className="w-full h-10 bg-fx-surface-2 border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-9 rounded-lg bg-fx-orange text-white text-sm font-bold flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Submit
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="h-9 px-4 rounded-lg bg-fx-surface-2 text-fx-text-dim text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Charges list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-fx-orange animate-spin" />
          </div>
        ) : charges.length === 0 ? (
          <p className="text-center text-sm text-fx-text-dim py-6">No accessorial charges yet</p>
        ) : (
          <div className="space-y-2">
            {charges.map((charge) => (
              <div key={charge.id} className="bg-fx-surface border border-fx-border rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-fx-text">
                        {ACCESSORIAL_LABELS[charge.type]}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[charge.status]}`}
                      >
                        {charge.status}
                      </span>
                    </div>
                    <p className="text-base font-black text-fx-orange mt-0.5">
                      ${Number(charge.amount_usd).toLocaleString()}
                    </p>
                    {charge.notes && (
                      <p className="text-[11px] text-fx-text-dim mt-1">{charge.notes}</p>
                    )}
                  </div>
                  {canApprove && charge.status === 'pending' && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleApprove(charge.id)}
                        className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleDeny(charge.id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
