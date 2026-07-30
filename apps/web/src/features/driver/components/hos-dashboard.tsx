import { useState } from 'react';
import { Clock, Truck, Coffee, Moon, AlertTriangle } from 'lucide-react';
import type { HosStatus, DutyStatus } from '@/services/hos.service';
import { useDutyTransition } from '@/features/driver/hooks/use-hos-status';

interface Props {
  status: HosStatus;
  driverId: string;
}

const STATUS_CONFIG: Record<DutyStatus, { label: string; icon: React.ElementType; color: string }> =
  {
    driving: {
      label: 'Driving',
      icon: Truck,
      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    },
    on_duty_not_driving: {
      label: 'On Duty',
      icon: Clock,
      color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    },
    sleeper_berth: {
      label: 'Sleeper',
      icon: Moon,
      color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    },
    off_duty: {
      label: 'Off Duty',
      icon: Coffee,
      color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30',
    },
  };

function Gauge({
  label,
  current,
  max,
  unit,
}: {
  label: string;
  current: number;
  max: number;
  unit: string;
}) {
  const pct = Math.min((current / max) * 100, 100);
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div className="bg-fx-surface border border-fx-border rounded-xl p-3">
      <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-end gap-1 mb-2">
        <span
          className={`text-xl font-extrabold ${isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-fx-text'}`}
        >
          {current.toFixed(1)}
        </span>
        <span className="text-xs text-fx-text-dim mb-0.5">
          / {max} {unit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isDanger ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-fx-orange'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function HosDashboard({ status, driverId }: Props) {
  const transition = useDutyTransition();
  const [notes, setNotes] = useState('');
  const currentConfig = STATUS_CONFIG[status.current_status];
  const CurrentIcon = currentConfig.icon;

  async function handleStatusChange(newStatus: DutyStatus) {
    if (newStatus === status.current_status) return;

    let lat: number | undefined;
    let lng: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Proceed without location
      }
    }

    await transition.mutateAsync({
      driverId,
      newStatus,
      locationLat: lat,
      locationLng: lng,
      notes: notes || undefined,
    });
    setNotes('');
  }

  return (
    <div className="space-y-4">
      {/* Current status badge */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${currentConfig.color}`}>
        <CurrentIcon size={24} />
        <div>
          <p className="text-lg font-extrabold">{currentConfig.label}</p>
          <p className="text-xs opacity-60">
            Since {new Date(status.status_since).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Gauges grid */}
      <div className="grid grid-cols-2 gap-3">
        <Gauge label="Driving Today" current={status.drive_hours_today} max={11} unit="hrs" />
        <Gauge label="On-Duty Today" current={status.on_duty_hours_today} max={14} unit="hrs" />
        <Gauge label="Until Break" current={status.hours_until_break} max={8} unit="hrs" />
        <Gauge label="Weekly" current={status.weekly_hours} max={status.weekly_limit} unit="hrs" />
      </div>

      {/* Break warning */}
      {status.hours_until_break <= 1 && status.current_status === 'driving' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-400">
          <AlertTriangle size={14} />
          <span className="font-semibold">
            30-minute break required within {status.hours_until_break.toFixed(1)} hours
          </span>
        </div>
      )}

      {/* Status change buttons */}
      <div>
        <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-wider mb-2">
          Change Status
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(STATUS_CONFIG) as [DutyStatus, typeof currentConfig][]).map(
            ([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = key === status.current_status;
              return (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  disabled={isActive || transition.isPending}
                  className={`h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
                    isActive
                      ? cfg.color
                      : 'bg-fx-surface border-fx-border text-fx-text-muted hover:bg-fx-surface-2'
                  }`}
                >
                  <Icon size={15} />
                  {cfg.label}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Notes */}
      <input
        className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-fx-text focus:outline-none focus:border-fx-orange"
        placeholder="Add notes (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}
