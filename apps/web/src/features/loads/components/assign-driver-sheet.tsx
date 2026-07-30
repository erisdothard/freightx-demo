import { useState, useEffect } from 'react';
import { UserCheck, Users, Loader2, X } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { assignDriver, assignCoDriver, getCompanyDrivers } from '@/services/loads.service';
import { useAuth } from '@/contexts/AuthContext';
import type { Load } from '@freightx/shared';

interface AssignDriverSheetProps {
  open: boolean;
  onClose: () => void;
  load: Load;
  onAssigned?: () => void;
}

export function AssignDriverSheet({ open, onClose, load, onAssigned }: AssignDriverSheetProps) {
  const { company } = useAuth();
  const [drivers, setDrivers] = useState<Array<{ id: string; fullName: string; email: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'primary' | 'co-driver'>('primary');

  useEffect(() => {
    if (!open || !company?.id) return;
    setLoading(true);
    setMode('primary');
    getCompanyDrivers(company.id)
      .then(setDrivers)
      .catch(() => setError('Failed to load drivers'))
      .finally(() => setLoading(false));
  }, [open, company?.id]);

  async function handleAssign(driverId: string) {
    setAssigning(driverId);
    setError(null);
    try {
      if (mode === 'co-driver') {
        await assignCoDriver(load.id, driverId);
      } else {
        await assignDriver(load.id, driverId);
      }
      onAssigned?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setAssigning(null);
    }
  }

  async function handleRemoveCoDriver() {
    setAssigning('removing');
    setError(null);
    try {
      await assignCoDriver(load.id, null);
      onAssigned?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove co-driver');
    } finally {
      setAssigning(null);
    }
  }

  // Filter out already-assigned driver from the co-driver list
  const availableDrivers =
    mode === 'co-driver' ? drivers.filter((d) => d.id !== load.assignedDriverId) : drivers;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={mode === 'co-driver' ? 'Assign Co-Driver' : 'Assign Driver'}
    >
      <div className="space-y-3">
        <div className="bg-fx-surface-2 rounded-2xl p-3 mb-4">
          <p className="text-xs text-fx-text-muted font-semibold uppercase tracking-widest mb-1">
            Load
          </p>
          <p className="text-sm font-bold text-fx-orange">{load.loadNumber}</p>
          <p className="text-xs text-fx-text-muted mt-0.5">
            {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
          </p>
        </div>

        {/* Tab toggle between primary and co-driver */}
        {load.assignedDriverId && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode('primary')}
              className={`flex-1 h-9 rounded-xl text-xs font-bold transition-colors ${
                mode === 'primary'
                  ? 'bg-fx-orange text-white'
                  : 'bg-fx-surface border border-fx-border text-fx-text-muted'
              }`}
            >
              Primary Driver
            </button>
            <button
              onClick={() => setMode('co-driver')}
              className={`flex-1 h-9 rounded-xl text-xs font-bold transition-colors ${
                mode === 'co-driver'
                  ? 'bg-fx-orange text-white'
                  : 'bg-fx-surface border border-fx-border text-fx-text-muted'
              }`}
            >
              Co-Driver (Optional)
            </button>
          </div>
        )}

        {/* Current co-driver — removable */}
        {mode === 'co-driver' && load.secondDriverId && (
          <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl">
            <Users size={16} className="text-green-400 shrink-0" />
            <p className="text-xs font-semibold text-green-400 flex-1">Co-driver assigned</p>
            <button
              onClick={handleRemoveCoDriver}
              disabled={assigning !== null}
              className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {error && (
          <p className="text-[13px] text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-fx-border border-t-fx-orange rounded-full animate-spin" />
          </div>
        ) : availableDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserCheck size={36} className="text-fx-text-dim mb-3" />
            <p className="font-bold text-fx-text">No drivers found</p>
            <p className="text-sm text-fx-text-muted mt-1">
              Add drivers to your team first via the Team page
            </p>
          </div>
        ) : (
          availableDrivers.map((driver) => {
            const isPrimary = load.assignedDriverId === driver.id;
            const isCoDriver = load.secondDriverId === driver.id;
            return (
              <button
                key={driver.id}
                onClick={() => handleAssign(driver.id)}
                disabled={assigning !== null}
                className="w-full flex items-center gap-3 p-4 bg-fx-surface border border-fx-border rounded-2xl hover:border-fx-orange/40 transition-colors active-scale disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-fx-orange/15 flex items-center justify-center shrink-0">
                  <UserCheck size={18} className="text-fx-orange" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white">{driver.fullName}</p>
                  <p className="text-xs text-fx-text-muted">{driver.email}</p>
                </div>
                {assigning === driver.id && (
                  <Loader2 size={18} className="text-fx-orange animate-spin" />
                )}
                {isPrimary && <span className="text-xs font-bold text-green-400">Primary</span>}
                {isCoDriver && <span className="text-xs font-bold text-blue-400">Co-Driver</span>}
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}
