import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { StatCard } from '@/shared/components/stat-card';
import { useAuth } from '@/contexts/AuthContext';
import { getExpenseSummary, getReceipts } from '@/services/receipts.service';
import { getTireIncidents } from '@/services/tire-incidents.service';
import type { ExpenseSummary } from '@/services/receipts.service';
import type { ReceiptCategory, Receipt } from '@freightx/shared';

const CATEGORY_LABELS: Record<ReceiptCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  tolls: 'Tolls',
  meals: 'Meals',
  lodging: 'Lodging',
  parking: 'Parking',
  supplies: 'Supplies',
  other: 'Other',
};

const CATEGORY_COLORS: Record<ReceiptCategory, string> = {
  fuel: '#e86030',
  maintenance: '#3b82f6',
  tolls: '#8b5cf6',
  meals: '#22c55e',
  lodging: '#f59e0b',
  parking: '#06b6d4',
  supplies: '#ec4899',
  other: '#6b7280',
};

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
  return { start, end };
}

export default function ExpensesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [tireCount, setTireCount] = useState(0);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const { start, end } = useMemo(() => getMonthRange(year, month), [year, month]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  }

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      getExpenseSummary(user.id, start, end),
      getTireIncidents(user.id),
      getReceipts(user.id, { startDate: start, endDate: end }),
    ])
      .then(([s, tires, r]) => {
        setSummary(s);
        setTireCount(tires.length);
        setReceipts(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id, start, end]);

  const maxCategoryAmount = summary
    ? Math.max(...Object.values(summary.byCategory).map(Number), 1)
    : 1;

  function exportCsv() {
    if (receipts.length === 0) return;
    const header = 'Date,Category,Vendor,Amount,Load #,Notes';
    const rows = receipts.map(
      (r) =>
        `${r.receiptDate},${r.category},"${r.vendorName}",${r.amountUsd},${r.loadNumber ?? ''},${r.notes ?? ''}`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${start}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader greeting={false} name="Expenses" />

      <div className="px-5 pb-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/driver')}
          className="flex items-center gap-2 text-sm text-fx-text-dim hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
        <button
          onClick={exportCsv}
          disabled={receipts.length === 0}
          className="flex items-center gap-1 text-xs text-fx-orange font-semibold disabled:opacity-40"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Month selector */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between bg-fx-surface border border-fx-border rounded-2xl p-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
          >
            <ChevronLeft size={16} className="text-fx-text-dim" />
          </button>
          <p className="text-sm font-semibold text-white">{monthLabel}</p>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
          >
            <ChevronRight size={16} className="text-fx-text-dim" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-4">
        {loading ? (
          <SkeletonList count={3} />
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Spent"
                value={`$${(summary?.totalUsd ?? 0).toFixed(0)}`}
                trend="flat"
                trendValue="this month"
                icon={<span className="text-sm">💰</span>}
                highlight
              />
              <StatCard
                label="Fuel"
                value={`$${(summary?.fuelUsd ?? 0).toFixed(0)}`}
                trend="flat"
                trendValue="fuel expenses"
                icon={<span className="text-sm">⛽</span>}
              />
              <StatCard
                label="Receipts"
                value={String(summary?.receiptCount ?? 0)}
                trend="flat"
                trendValue="scanned"
                icon={<span className="text-sm">🧾</span>}
              />
              <StatCard
                label="Tire Incidents"
                value={String(tireCount)}
                trend="flat"
                trendValue="all time"
                icon={<span className="text-sm">🛞</span>}
              />
            </div>

            {/* Category breakdown */}
            {summary && Object.keys(summary.byCategory).length > 0 && (
              <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
                <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
                  By Category
                </p>
                <div className="space-y-3">
                  {Object.entries(summary.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-fx-text-dim">
                            {CATEGORY_LABELS[cat as ReceiptCategory] ?? cat}
                          </span>
                          <span className="text-xs font-bold text-white">${amt.toFixed(2)}</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(amt / maxCategoryAmount) * 100}%`,
                              background: CATEGORY_COLORS[cat as ReceiptCategory] ?? '#6b7280',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/driver/receipts')}
                className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-fx-orange/50 transition-all"
              >
                <span className="text-2xl">🧾</span>
                <span className="text-xs font-semibold text-fx-text-muted">All Receipts</span>
              </button>
              <button
                onClick={() => navigate('/driver/tire-log')}
                className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-fx-orange/50 transition-all"
              >
                <span className="text-2xl">🛞</span>
                <span className="text-xs font-semibold text-fx-text-muted">Tire Log</span>
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
