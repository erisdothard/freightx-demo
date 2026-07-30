import { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload } from 'lucide-react';
import { createReceipt, uploadReceiptImage } from '@/services/receipts.service';
import { getDriverLoads } from '@/services/loads.service';
import { useAuth } from '@/contexts/AuthContext';
import type { ReceiptCategory, Load } from '@freightx/shared';

interface ReceiptCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES: { value: ReceiptCategory; label: string; icon: string }[] = [
  { value: 'fuel', label: 'Fuel', icon: '⛽' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'tolls', label: 'Tolls', icon: '🛣️' },
  { value: 'meals', label: 'Meals', icon: '🍔' },
  { value: 'lodging', label: 'Lodging', icon: '🏨' },
  { value: 'parking', label: 'Parking', icon: '🅿️' },
  { value: 'supplies', label: 'Supplies', icon: '📦' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export function ReceiptCaptureSheet({ open, onClose, onCreated }: ReceiptCaptureSheetProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<ReceiptCategory>('fuel');
  const [amount, setAmount] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loadNumber, setLoadNumber] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLoads, setActiveLoads] = useState<Load[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user?.id) {
      getDriverLoads(user.id)
        .then(setActiveLoads)
        .catch(() => undefined);
    }
  }, [open, user?.id]);

  async function handleImage(file: File | null) {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      // Preview
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);

      const url = await uploadReceiptImage(file, user.id);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!user || !imageUrl || !amount) return;
    setSaving(true);
    setError(null);
    try {
      await createReceipt({
        driverId: user.id,
        loadNumber: loadNumber || undefined,
        category,
        amountUsd: parseFloat(amount),
        vendorName,
        receiptDate,
        notes: notes || undefined,
        imageUrl,
      });
      onCreated();
      onClose();
      // Reset
      setCategory('fuel');
      setAmount('');
      setVendorName('');
      setNotes('');
      setImageUrl('');
      setImagePreview(null);
      setLoadNumber('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        style={{ maxWidth: 430, margin: '0 auto' }}
      >
        <div className="bg-fx-surface rounded-t-[24px] pb-safe overflow-hidden max-h-[85dvh] flex flex-col">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-fx-border" />
          </div>
          <div className="flex items-center justify-between px-5 pb-3 shrink-0">
            <h2 className="text-lg font-bold text-white">Scan Receipt</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
            >
              <X size={16} className="text-fx-text-dim" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            {/* Image capture */}
            <div>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Receipt"
                    className="w-full h-40 object-contain rounded-xl bg-black/40"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageUrl('');
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => cameraRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 h-24 rounded-xl border-2 border-dashed border-fx-orange/40 flex flex-col items-center justify-center gap-2 text-fx-orange disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="w-5 h-5 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
                    ) : (
                      <>
                        <Camera size={24} />
                        <span className="text-xs font-semibold">Take Photo</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 h-24 rounded-xl border-2 border-dashed border-fx-border flex flex-col items-center justify-center gap-2 text-fx-text-dim disabled:opacity-50"
                  >
                    <Upload size={24} />
                    <span className="text-xs font-semibold">Choose File</span>
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Category grid */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Category
              </p>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-all ${
                      category === c.value
                        ? 'bg-fx-orange/15 border border-fx-orange/40 text-fx-orange'
                        : 'bg-fx-surface-2 border border-fx-border text-fx-text-muted'
                    }`}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Amount
              </p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-fx-text-dim text-sm">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl pl-8 pr-4 text-sm text-white placeholder:text-fx-text-dim"
                />
              </div>
            </div>

            {/* Vendor */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Vendor Name
              </p>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Pilot, Love's..."
                className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl px-4 text-sm text-white placeholder:text-fx-text-dim"
              />
            </div>

            {/* Date */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Date
              </p>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl px-4 text-sm text-white"
              />
            </div>

            {/* Load # */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Load # (Optional)
              </p>
              <select
                value={loadNumber}
                onChange={(e) => setLoadNumber(e.target.value)}
                className="w-full h-12 bg-fx-surface-2 border border-fx-border rounded-xl px-4 text-sm text-white"
              >
                <option value="">None</option>
                {activeLoads.map((l) => (
                  <option key={l.loadNumber} value={l.loadNumber}>
                    {l.loadNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2">
                Notes (Optional)
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add notes..."
                className="w-full bg-fx-surface-2 border border-fx-border rounded-xl p-3 text-sm text-white placeholder:text-fx-text-dim resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!imageUrl || !amount || saving}
              className="w-full h-12 rounded-2xl bg-fx-orange text-white font-semibold text-sm active-scale disabled:opacity-50"
              style={{ boxShadow: '0 4px 16px rgba(232,96,48,0.4)' }}
            >
              {saving ? 'Saving...' : 'Save Receipt'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
