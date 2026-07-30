import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Receipt as ReceiptIcon } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getReceipts } from '@/services/receipts.service';
import { ReceiptCaptureSheet } from '@/features/driver/components/receipt-capture-sheet';
import type { Receipt, ReceiptCategory } from '@freightx/shared';

const CATEGORY_LABELS: Record<ReceiptCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maint.',
  tolls: 'Tolls',
  meals: 'Meals',
  lodging: 'Lodging',
  parking: 'Parking',
  supplies: 'Supplies',
  other: 'Other',
};

const CATEGORY_ICONS: Record<ReceiptCategory, string> = {
  fuel: '⛽',
  maintenance: '🔧',
  tolls: '🛣️',
  meals: '🍔',
  lodging: '🏨',
  parking: '🅿️',
  supplies: '📦',
  other: '📋',
};

const ALL_CATEGORIES: ReceiptCategory[] = [
  'fuel',
  'maintenance',
  'tolls',
  'meals',
  'lodging',
  'parking',
  'supplies',
  'other',
];

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ReceiptCategory | null>(null);

  const fetchReceipts = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    getReceipts(user.id, filterCategory ? { category: filterCategory } : undefined)
      .then(setReceipts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id, filterCategory]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const totalAmount = receipts.reduce((sum, r) => sum + r.amountUsd, 0);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader greeting={false} name="Receipts" />

      <div className="px-5 pb-3">
        <button
          onClick={() => navigate('/driver')}
          className="flex items-center gap-2 text-sm text-fx-text-dim hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      {/* Category filter chips */}
      <div className="px-5 pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-all ${
              !filterCategory
                ? 'bg-fx-orange text-white'
                : 'bg-fx-surface border border-fx-border text-fx-text-muted'
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-all ${
                filterCategory === cat
                  ? 'bg-fx-orange text-white'
                  : 'bg-fx-surface border border-fx-border text-fx-text-muted'
              }`}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      {receipts.length > 0 && (
        <div className="px-5 pb-3">
          <div className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-fx-text-muted uppercase tracking-widest font-bold">
                {filterCategory ? CATEGORY_LABELS[filterCategory] : 'All'} Total
              </p>
              <p className="text-xl font-bold text-white mt-0.5">${totalAmount.toFixed(2)}</p>
            </div>
            <p className="text-xs text-fx-text-dim">
              {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 space-y-3">
        {loading ? (
          <SkeletonList count={3} />
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon size={28} className="text-fx-orange" />}
            title="No receipts yet"
            subtitle="Tap the + button to scan your first receipt"
          />
        ) : (
          receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-3"
            >
              {/* Thumbnail */}
              <img
                src={receipt.imageUrl}
                alt="Receipt"
                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-fx-border"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="orange" size="sm">
                    {CATEGORY_ICONS[receipt.category]} {CATEGORY_LABELS[receipt.category]}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-white truncate">
                  {receipt.vendorName || 'Unknown vendor'}
                </p>
                <p className="text-xs text-fx-text-dim">
                  {new Date(receipt.receiptDate + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {receipt.loadNumber && (
                    <span className="text-fx-orange ml-2">{receipt.loadNumber}</span>
                  )}
                </p>
              </div>

              <p className="text-sm font-bold text-white shrink-0">
                ${receipt.amountUsd.toFixed(2)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setFormOpen(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-fx-orange flex items-center justify-center shadow-lg active-scale z-40"
        style={{ boxShadow: '0 6px 24px rgba(232,96,48,0.5)' }}
      >
        <Plus size={24} className="text-white" />
      </button>

      <BottomNav role="driver" />

      <ReceiptCaptureSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={fetchReceipts}
      />
    </div>
  );
}
