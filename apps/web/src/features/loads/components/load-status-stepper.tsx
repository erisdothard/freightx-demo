import { useState } from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { updateLoad } from '@/services/loads.service';
import { createDocument } from '@/services/documents.service';
import { BolSignatureSheet } from '@/features/documents/components/bol-signature-sheet';
import type { LoadStatus } from '@/lib/database.types';
import type { UserRole } from '@/lib/database.types';

const STEPS: { status: LoadStatus; label: string }[] = [
  { status: 'posted', label: 'Posted' },
  { status: 'bid_received', label: 'Bid Received' },
  { status: 'awarded', label: 'Awarded' },
  { status: 'dispatched', label: 'Dispatched' },
  { status: 'in_transit', label: 'In Transit' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'completed', label: 'Completed' },
];

// Which role can advance to which statuses
const ROLE_CAN_ADVANCE: Record<string, LoadStatus[]> = {
  carrier: ['dispatched'],
  broker: ['completed'],
  admin: ['dispatched', 'in_transit', 'delivered', 'completed'],
  driver: ['in_transit', 'delivered'],
};

const NEXT_STATUS: Partial<Record<LoadStatus, LoadStatus>> = {
  awarded: 'dispatched',
  dispatched: 'in_transit',
  in_transit: 'delivered',
  delivered: 'completed',
};

const REQUIRES_DRIVER: LoadStatus[] = ['dispatched', 'in_transit'];

interface LoadStatusStepperProps {
  loadId: string;
  currentStatus: LoadStatus;
  role: UserRole;
  hasDriverAssigned?: boolean;
  rateConSigned?: boolean;
  onStatusAdvanced?: (newStatus: LoadStatus) => void;
  onDispatched?: () => void;
  onRateConRequired?: () => void;
  loadNumber?: string;
  origin?: string;
  dest?: string;
}

export function LoadStatusStepper({
  loadId,
  currentStatus,
  role,
  hasDriverAssigned = false,
  rateConSigned = true,
  onStatusAdvanced,
  onDispatched,
  onRateConRequired,
  loadNumber = '',
  origin = '',
  dest = '',
}: LoadStatusStepperProps) {
  const queryClient = useQueryClient();
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bolSignOpen, setBolSignOpen] = useState(false);
  const [bolDocId, setBolDocId] = useState<string | null>(null);

  const currentIdx = STEPS.findIndex((s) => s.status === currentStatus);
  const nextStatus = NEXT_STATUS[currentStatus];
  const gatedByRateCon = nextStatus === 'dispatched' && !rateConSigned && role === 'carrier';
  const canAdvance =
    nextStatus !== undefined &&
    (ROLE_CAN_ADVANCE[role] ?? []).includes(nextStatus) &&
    !gatedByRateCon;
  const needsDriver =
    role !== 'driver' &&
    nextStatus !== undefined &&
    REQUIRES_DRIVER.includes(nextStatus) &&
    !hasDriverAssigned;

  async function handleAdvance() {
    if (!nextStatus) return;
    if (needsDriver) {
      setError(
        'Assign a driver before advancing to ' +
          (STEPS.find((s) => s.status === nextStatus)?.label ?? nextStatus),
      );
      return;
    }

    // If advancing to "delivered", capture BOL signature first
    if (nextStatus === 'delivered') {
      setAdvancing(true);
      setError(null);
      try {
        // Create a BOL document record first
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const doc = await createDocument({
          loadId,
          type: 'bill_of_lading',
          fileName: `BOL-${loadNumber || loadId}.pdf`,
          uploadedBy: user?.id,
        });
        setBolDocId(doc.id);
        setBolSignOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create BOL document');
      } finally {
        setAdvancing(false);
      }
      return;
    }

    // For all other status advances, proceed normally
    setAdvancing(true);
    setError(null);
    try {
      await updateLoad(loadId, { status: nextStatus });
      void queryClient.invalidateQueries({ queryKey: ['loads'] });
      onStatusAdvanced?.(nextStatus);
      if (nextStatus === 'dispatched') onDispatched?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleBolSigned() {
    // After BOL is signed, update load status to delivered
    setAdvancing(true);
    try {
      await updateLoad(loadId, { status: 'delivered' });
      void queryClient.invalidateQueries({ queryKey: ['loads'] });
      onStatusAdvanced?.('delivered');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as delivered');
    } finally {
      setAdvancing(false);
      setBolSignOpen(false);
    }
  }

  const terminalStatuses: LoadStatus[] = ['cancelled', 'expired'];
  if (terminalStatuses.includes(currentStatus)) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-red-400 capitalize">{currentStatus}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Step track */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            const future = i > currentIdx;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={step.status} className="flex items-center flex-1 min-w-0">
                {/* Node */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      done
                        ? 'bg-green-500'
                        : current
                          ? 'bg-fx-orange ring-4 ring-fx-orange/20'
                          : 'bg-fx-surface border-2 border-fx-border'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 size={14} className="text-white" />
                    ) : current ? (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    ) : (
                      <Circle size={10} className="text-fx-border" />
                    )}
                  </div>
                  <p
                    className={`text-[9px] font-semibold mt-1 text-center leading-tight ${
                      done ? 'text-green-400' : current ? 'text-fx-orange' : 'text-fx-text-dim'
                    } ${future ? 'opacity-50' : ''}`}
                    style={{ maxWidth: 48 }}
                  >
                    {step.label}
                  </p>
                </div>

                {/* Connector */}
                {!isLast && (
                  <div
                    className={`flex-1 h-[2px] mx-0.5 rounded-full ${
                      i < currentIdx ? 'bg-green-500' : 'bg-fx-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Advance button */}
        {canAdvance &&
          !(role === 'carrier' && (nextStatus === 'in_transit' || nextStatus === 'delivered')) && (
            <div className="pt-1">
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2 mb-3">
                  {error}
                </p>
              )}
              <button
                onClick={handleAdvance}
                disabled={advancing}
                className="w-full h-11 bg-fx-orange rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white disabled:opacity-50 transition-opacity"
              >
                {advancing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ArrowRight size={15} />
                    Mark as {STEPS.find((s) => s.status === nextStatus)?.label}
                  </>
                )}
              </button>
            </div>
          )}
      </div>

      {/* BOL Signature Sheet */}
      {bolSignOpen && bolDocId && (
        <BolSignatureSheet
          open={bolSignOpen}
          onClose={() => setBolSignOpen(false)}
          documentId={bolDocId}
          loadId={loadId}
          loadNumber={loadNumber}
          origin={origin}
          dest={dest}
          onSigned={handleBolSigned}
        />
      )}
    </>
  );
}
