import { useState } from 'react';
import { Clock } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { BottomNav } from '@/shared/components/bottom-nav';
import { HosDashboard } from '@/features/driver/components/hos-dashboard';
import { HosLogList } from '@/features/driver/components/hos-log-list';
import { HosViolationsList } from '@/features/driver/components/hos-violations-list';
import { useHosStatus, useDutyLog, useViolations } from '@/features/driver/hooks/use-hos-status';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'dashboard' | 'log' | 'violations';

export default function DriverHosPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  const { status, loading: statusLoading } = useHosStatus(user?.id);
  const { log, loading: logLoading } = useDutyLog(user?.id);
  const { violations, loading: violationsLoading } = useViolations(user?.id);

  const loading =
    tab === 'dashboard' ? statusLoading : tab === 'log' ? logLoading : violationsLoading;

  const unackedCount = violations.filter((v) => !v.resolved).length;

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Hours of Service" showBack />

      {/* Tabs */}
      <div className="px-5 pt-2 pb-3 flex gap-2">
        {[
          { key: 'dashboard' as Tab, label: 'Dashboard' },
          { key: 'log' as Tab, label: 'Duty Log' },
          {
            key: 'violations' as Tab,
            label: `Violations${unackedCount > 0 ? ` (${unackedCount})` : ''}`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors ${
              tab === t.key
                ? 'bg-fx-orange/10 border-fx-orange/40 text-fx-orange'
                : 'bg-fx-surface border-fx-border text-fx-text-dim hover:border-zinc-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading && <SkeletonList count={3} />}

        {!loading &&
          tab === 'dashboard' &&
          (status ? (
            <HosDashboard status={status} driverId={user!.id} />
          ) : (
            <EmptyState
              icon={<Clock size={28} className="text-fx-text-dim" />}
              title="No HOS data available"
              subtitle="Start logging duty transitions to see your dashboard"
            />
          ))}

        {!loading && tab === 'log' && <HosLogList log={log} />}

        {!loading && tab === 'violations' && user && (
          <HosViolationsList violations={violations} driverId={user.id} />
        )}
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
