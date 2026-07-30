import { Clock } from 'lucide-react';
import type { DwellRecord } from '@freightx/shared';

interface DwellTimeCardProps {
  records: DwellRecord[];
}

function getDwellColor(minutes: number | undefined): string {
  if (!minutes) return 'text-fx-text-dim';
  if (minutes > 120) return 'text-red-400';
  if (minutes > 60) return 'text-yellow-400';
  return 'text-green-400';
}

function getDwellBg(minutes: number | undefined): string {
  if (!minutes) return 'bg-white/5';
  if (minutes > 120) return 'bg-red-500/10';
  if (minutes > 60) return 'bg-yellow-500/10';
  return 'bg-green-500/10';
}

function formatDwell(minutes: number | undefined): string {
  if (!minutes) return 'Active';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function DwellTimeCard({ records }: DwellTimeCardProps) {
  if (records.length === 0) return null;

  return (
    <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-fx-orange" />
        <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
          Facility Dwell Time
        </p>
      </div>

      <div className="space-y-2">
        {records.map((record) => (
          <div
            key={record.id}
            className={`flex items-center justify-between p-3 rounded-xl ${getDwellBg(record.dwellMinutes)}`}
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {record.label || `${record.stopType === 'pickup' ? 'Pickup' : 'Delivery'}`}
              </p>
              <p className="text-xs text-fx-text-dim mt-0.5">
                {record.stopType === 'pickup' ? 'Pickup' : 'Delivery'}
                {record.detentionFlagged && (
                  <span className="text-red-400 ml-2 font-semibold">DETENTION</span>
                )}
              </p>
            </div>
            <p className={`text-sm font-bold ${getDwellColor(record.dwellMinutes)}`}>
              {formatDwell(record.dwellMinutes)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
