import { Clock, Truck, Coffee, Moon, MapPin } from 'lucide-react';
import type { DutyLogEntry, DutyStatus } from '@/services/hos.service';

interface Props {
  log: DutyLogEntry[];
}

const STATUS_ICONS: Record<DutyStatus, { icon: React.ElementType; color: string }> = {
  driving: { icon: Truck, color: 'text-emerald-400 bg-emerald-400/10' },
  on_duty_not_driving: { icon: Clock, color: 'text-blue-400 bg-blue-400/10' },
  sleeper_berth: { icon: Moon, color: 'text-purple-400 bg-purple-400/10' },
  off_duty: { icon: Coffee, color: 'text-zinc-400 bg-zinc-400/10' },
};

const STATUS_LABELS: Record<DutyStatus, string> = {
  driving: 'Driving',
  on_duty_not_driving: 'On Duty',
  sleeper_berth: 'Sleeper Berth',
  off_duty: 'Off Duty',
};

function formatDuration(minutes: number | null): string {
  if (minutes == null) return 'Active';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function HosLogList({ log }: Props) {
  if (log.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-fx-text-muted text-sm">No duty log entries</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {log.map((entry, i) => {
        const config = STATUS_ICONS[entry.status] ?? STATUS_ICONS.off_duty;
        const Icon = config.icon;
        const isLast = i === log.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}
              >
                <Icon size={14} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-fx-border my-1" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-fx-text">{STATUS_LABELS[entry.status]}</p>
                <span className="text-xs font-bold text-fx-text-muted">
                  {formatDuration(entry.duration_minutes)}
                </span>
              </div>
              <p className="text-xs text-fx-text-dim mt-0.5">
                {new Date(entry.started_at).toLocaleTimeString()}
                {entry.ended_at && ` - ${new Date(entry.ended_at).toLocaleTimeString()}`}
              </p>
              {entry.location_description && (
                <p className="text-xs text-fx-text-dim mt-1 flex items-center gap-1">
                  <MapPin size={10} /> {entry.location_description}
                </p>
              )}
              {entry.notes && (
                <p className="text-xs text-fx-text-muted mt-1 italic">{entry.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
