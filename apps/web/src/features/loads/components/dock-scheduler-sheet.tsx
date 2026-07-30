import { useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { useAvailableSlots, useBookAppointment } from '@/features/loads/hooks/use-dock-scheduling';

interface Props {
  open: boolean;
  onClose: () => void;
  facilityId: string;
  companyId: string;
  loadId?: string;
}

export function DockSchedulerSheet({ open, onClose, facilityId, companyId, loadId }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { available, loading } = useAvailableSlots(facilityId, date);
  const bookMutation = useBookAppointment();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  async function handleBook(slot: (typeof available)[0]) {
    setError(null);
    try {
      await bookMutation.mutateAsync({
        dockSlotId: slot.dock_slot_id,
        carrierCompanyId: companyId,
        scheduledStart: slot.start_time,
        scheduledEnd: slot.end_time,
        loadId,
        notes: notes || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to book appointment');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Book Dock Appointment">
      {/* Date picker */}
      <div className="mb-4">
        <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
          Date
        </label>
        <input
          type="date"
          className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
          Notes
        </label>
        <input
          className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
          placeholder="Optional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Available slots */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="w-5 h-5 border-2 border-fx-orange/30 border-t-fx-orange rounded-full animate-spin" />
        </div>
      ) : available.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-fx-text-muted text-sm">No available slots for this date</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-hide">
          {available.map((slot, i) => (
            <button
              key={`${slot.dock_slot_id}-${i}`}
              onClick={() => handleBook(slot)}
              disabled={bookMutation.isPending}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-fx-surface border border-fx-border hover:bg-fx-surface-2 transition-colors text-left disabled:opacity-40"
            >
              <div className="w-9 h-9 rounded-lg bg-fx-orange/10 border border-fx-orange/30 flex items-center justify-center shrink-0">
                <Clock size={15} className="text-fx-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-fx-text">{slot.dock_name}</p>
                <p className="text-xs text-fx-text-muted">
                  {new Date(slot.start_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {new Date(slot.end_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className="text-[10px] font-semibold text-fx-text-dim uppercase">
                {slot.slot_type}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
    </BottomSheet>
  );
}
