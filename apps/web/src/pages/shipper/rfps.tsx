import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { RfpCreateSheet } from '@/features/loads/components/rfp-create-sheet';
import { RfpDetailSheet } from '@/features/loads/components/rfp-detail-sheet';
import { useMyRfps, usePublishRfp } from '@/features/loads/hooks/use-rfps';
import { useAuth } from '@/contexts/AuthContext';
import type { Rfp } from '@/services/rfp.service';

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-zinc-400 bg-zinc-400/10',
  open: 'text-emerald-400 bg-emerald-400/10',
  evaluating: 'text-amber-400 bg-amber-400/10',
  awarded: 'text-blue-400 bg-blue-400/10',
  closed: 'text-red-400 bg-red-400/10',
};

export default function ShipperRfpsPage() {
  const { company } = useAuth();
  const { rfps, loading } = useMyRfps(company?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRfp, setSelectedRfp] = useState<Rfp | null>(null);
  const publishRfp = usePublishRfp();

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        title="RFP Management"
        showBack
        right={
          <button
            onClick={() => setCreateOpen(true)}
            className="w-10 h-10 rounded-xl bg-fx-orange flex items-center justify-center text-white"
          >
            <Plus size={18} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <SkeletonList count={3} />
        ) : rfps.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} className="text-fx-text-dim" />}
            title="No RFPs created yet"
            subtitle="Create one to solicit carrier bids on your lanes"
          />
        ) : (
          <div className="space-y-3">
            {rfps.map((rfp) => (
              <button
                key={rfp.id}
                onClick={() => setSelectedRfp(rfp)}
                className="w-full bg-fx-surface border border-fx-border rounded-xl p-4 text-left hover:bg-fx-surface-2 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-fx-text">{rfp.title}</p>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${STATUS_COLORS[rfp.status] ?? ''}`}
                  >
                    {rfp.status}
                  </span>
                </div>
                <p className="text-xs text-fx-text-muted">
                  Deadline: {rfp.deadline ? new Date(rfp.deadline).toLocaleDateString() : 'None'}
                </p>
                {rfp.status === 'draft' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      publishRfp.mutate(rfp.id);
                    }}
                    className="mt-2 h-7 px-3 rounded-lg bg-fx-orange/10 border border-fx-orange/30 text-fx-orange text-[10px] font-semibold hover:bg-fx-orange/20 transition-colors"
                  >
                    Publish
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav role="shipper" />

      <RfpCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companyId={company?.id ?? ''}
      />

      {selectedRfp && (
        <RfpDetailSheet
          open={!!selectedRfp}
          onClose={() => setSelectedRfp(null)}
          rfp={selectedRfp}
          isOwner
        />
      )}
    </div>
  );
}
