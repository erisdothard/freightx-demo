import { AlertTriangle, Check } from 'lucide-react';
import { acknowledgeViolation, type HosViolation } from '@/services/hos.service';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  violations: HosViolation[];
  driverId: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export function HosViolationsList({ violations, driverId }: Props) {
  const queryClient = useQueryClient();
  const [acking, setAcking] = useState<string | null>(null);

  async function handleAck(violationId: string) {
    setAcking(violationId);
    try {
      await acknowledgeViolation(violationId);
      void queryClient.invalidateQueries({ queryKey: ['hos-violations', driverId] });
    } finally {
      setAcking(null);
    }
  }

  if (violations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-3">
          <Check size={20} className="text-emerald-400" />
        </div>
        <p className="text-fx-text-muted text-sm">No violations</p>
        <p className="text-fx-text-dim text-xs mt-1">You're in compliance!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {violations.map((v) => {
        const severityColor = SEVERITY_COLORS[v.severity] ?? SEVERITY_COLORS.warning;
        const isAcked = v.resolved;

        return (
          <div
            key={v.id}
            className={`bg-fx-surface border rounded-xl p-4 space-y-2 ${
              isAcked ? 'border-fx-border opacity-60' : 'border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  size={14}
                  className={isAcked ? 'text-fx-text-dim' : 'text-red-400'}
                />
                <span className="text-sm font-semibold text-fx-text">
                  {v.violation_type.replace(/_/g, ' ')}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${severityColor}`}
              >
                {v.severity}
              </span>
            </div>

            <p className="text-xs text-fx-text-muted">{v.description}</p>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-fx-text-dim">
                {new Date(v.violation_date).toLocaleDateString()}
              </span>

              {isAcked ? (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Check size={10} /> Acknowledged
                </span>
              ) : (
                <button
                  onClick={() => handleAck(v.id)}
                  disabled={acking === v.id}
                  className="text-xs font-semibold text-fx-orange hover:text-fx-orange/80 disabled:opacity-40 transition-colors"
                >
                  {acking === v.id ? '...' : 'Acknowledge'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
