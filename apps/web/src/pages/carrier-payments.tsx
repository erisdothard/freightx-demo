import { useEffect, useState } from 'react';
import { DollarSign, Zap, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyFactoringRequests } from '@/services/factoring.service';
import type { FactoringRequest } from '@/services/factoring.service';
import { FactoringSheet } from '@/features/payments/components/factoring-sheet';
import { cn } from '@/shared/lib/utils';

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  requested: { label: 'Pending Review', color: 'text-amber-400', icon: <Clock size={13} /> },
  approved: { label: 'Approved', color: 'text-blue-400', icon: <CheckCircle size={13} /> },
  funded: { label: 'Funded', color: 'text-emerald-400', icon: <CheckCircle size={13} /> },
  denied: { label: 'Denied', color: 'text-red-400', icon: <XCircle size={13} /> },
  cancelled: { label: 'Cancelled', color: 'text-fx-text-dim', icon: <XCircle size={13} /> },
};

export default function CarrierPaymentsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FactoringRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMyFactoringRequests(user.id)
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [user]);

  const totalFunded = requests
    .filter((r) => r.status === 'funded')
    .reduce((sum, r) => sum + (r.netPayout ?? 0), 0);

  const pendingCount = requests.filter((r) => r.status === 'requested').length;

  return (
    <div className="min-h-screen bg-fx-bg p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign size={20} className="text-fx-orange" />
          <h1 className="text-xl font-bold text-white">Payments</h1>
        </div>
        <p className="text-fx-text-dim text-sm">Invoice management, QuickPay, and factoring.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-fx-surface rounded-ios p-4">
          <p className="text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">Total Funded</p>
          <p className="text-[22px] font-extrabold text-emerald-400">
            ${totalFunded.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-fx-surface rounded-ios p-4">
          <p className="text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">Pending</p>
          <p className="text-[22px] font-extrabold text-amber-400">{pendingCount}</p>
        </div>
      </div>

      {/* Request QuickPay CTA */}
      <button
        onClick={() => setSheetOpen(true)}
        className="w-full bg-fx-surface rounded-ios p-4 flex items-center justify-between mb-6 card-highlight active-scale"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-fx-orange/10 rounded-ios-xs flex items-center justify-center">
            <Zap size={18} className="text-fx-orange" />
          </div>
          <div className="text-left">
            <p className="text-[14px] font-bold text-white">Request QuickPay</p>
            <p className="text-[12px] text-fx-text-dim">Get paid in hours, not weeks</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-fx-text-dim" />
      </button>

      {/* Factoring requests list */}
      <h2 className="text-[13px] font-bold text-fx-text-dim uppercase tracking-wider mb-3">
        Factoring History
      </h2>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-fx-surface rounded-ios animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-fx-surface rounded-ios p-8 text-center">
          <p className="text-fx-text-dim text-sm">No factoring requests yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const meta = STATUS_META[req.status] ?? STATUS_META.requested;
            return (
              <div key={req.id} className="bg-fx-surface rounded-ios p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-bold text-white">
                    Load #{req.loadNumber ?? '—'}
                  </span>
                  <div
                    className={cn('flex items-center gap-1 text-[11px] font-semibold', meta.color)}
                  >
                    {meta.icon}
                    {meta.label}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-fx-text-dim">
                    Invoice: ${req.invoiceAmount.toLocaleString()}
                  </span>
                  <span className="text-emerald-400 font-bold">
                    Net: $
                    {(req.netPayout ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {req.notes && (
                  <p className="text-[11px] text-fx-text-dim mt-1 truncate">{req.notes}</p>
                )}
                <p className="text-[10px] text-fx-text-dim mt-1">
                  {new Date(req.requestedAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Factoring sheet — demo mode (no load pre-selected) */}
      <FactoringSheet
        open={sheetOpen}
        loadId="demo"
        loadNumber="—"
        invoiceAmount={0}
        onClose={() => setSheetOpen(false)}
        onSuccess={() => {
          if (user) {
            getMyFactoringRequests(user.id).then(setRequests);
          }
        }}
      />
    </div>
  );
}
