import { useState } from 'react';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { FacilityManager } from '@/features/loads/components/facility-manager';
import { DockSchedulerSheet } from '@/features/loads/components/dock-scheduler-sheet';
import {
  useFacilities,
  useAppointments,
  useDockActions,
} from '@/features/loads/hooks/use-dock-scheduling';
import { useAuth } from '@/contexts/AuthContext';

export default function ShipperDockSchedulingPage() {
  const { company } = useAuth();
  const { facilities, loading: facilitiesLoading } = useFacilities(company?.id);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [date] = useState(() => new Date().toISOString().slice(0, 10));

  const { appointments, loading: apptLoading } = useAppointments(
    selectedFacility ?? undefined,
    date,
  );
  const { checkIn, checkOut } = useDockActions();

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Dock Scheduling" showBack />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Facilities */}
        <div>
          <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 px-1">
            Facilities
          </p>
          {facilitiesLoading ? (
            <SkeletonList count={2} />
          ) : (
            <FacilityManager
              facilities={facilities}
              selectedId={selectedFacility}
              onSelect={setSelectedFacility}
              companyId={company?.id ?? ''}
            />
          )}
        </div>

        {/* Book button */}
        {selectedFacility && (
          <button
            onClick={() => setScheduleOpen(true)}
            className="w-full h-12 rounded-2xl bg-fx-orange hover:bg-fx-orange/90 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Clock size={16} />
            Book Appointment
          </button>
        )}

        {/* Today's appointments */}
        {selectedFacility && (
          <div>
            <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-2 px-1">
              Today's Schedule
            </p>
            {apptLoading ? (
              <SkeletonList count={2} />
            ) : appointments.length === 0 ? (
              <p className="text-center py-6 text-fx-text-dim text-xs">No appointments today</p>
            ) : (
              <div className="space-y-2">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="bg-fx-surface border border-fx-border rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-fx-text">
                        {new Date(appt.scheduled_start).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' - '}
                        {new Date(appt.scheduled_end).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-fx-text-muted capitalize">
                        {appt.status.replace('_', ' ')}
                      </p>
                      {appt.dwell_minutes != null && (
                        <p className="text-[10px] text-fx-text-dim">
                          Dwell: {appt.dwell_minutes} min
                        </p>
                      )}
                    </div>
                    {appt.status === 'scheduled' && (
                      <button
                        onClick={() => checkIn.mutate(appt.id)}
                        disabled={checkIn.isPending}
                        className="h-8 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                      >
                        <LogIn size={12} /> Check In
                      </button>
                    )}
                    {(appt.status === 'checked_in' || appt.status === 'loading') && (
                      <button
                        onClick={() => checkOut.mutate(appt.id)}
                        disabled={checkOut.isPending}
                        className="h-8 px-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold flex items-center gap-1 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                      >
                        <LogOut size={12} /> Check Out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav role="shipper" />

      {selectedFacility && (
        <DockSchedulerSheet
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          facilityId={selectedFacility}
          companyId={company?.id ?? ''}
        />
      )}
    </div>
  );
}
