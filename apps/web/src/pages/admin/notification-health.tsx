import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, RefreshCw, CheckCircle, SkipForward } from 'lucide-react';
import {
  getNotificationQueueStats,
  getFailedNotifications,
  retryAllFailed,
} from '@/services/notification-admin.service';
import type {
  NotificationQueueStats,
  FailedNotification,
} from '@/services/notification-admin.service';
import { cn } from '@/shared/lib/utils';

export default function NotificationHealthPage() {
  const [stats, setStats] = useState<NotificationQueueStats | null>(null);
  const [failed, setFailed] = useState<FailedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, f] = await Promise.all([getNotificationQueueStats(), getFailedNotifications(50)]);
      setStats(s);
      setFailed(f);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRetryAll() {
    setRetrying(true);
    try {
      const count = await retryAllFailed();
      setRetryResult(count);
      void load();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="min-h-screen bg-fx-bg p-4 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-fx-orange" />
            <h1 className="text-xl font-bold text-white">Notification Health</h1>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 text-fx-text-dim hover:text-white disabled:opacity-40"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-fx-text-dim text-sm">Admin view of the notification delivery queue.</p>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
          {[
            { label: 'Sent Today', value: stats.sentToday, color: 'text-emerald-400' },
            { label: 'Failed Today', value: stats.failedToday, color: 'text-red-400' },
            { label: 'Dead Letters', value: stats.deadLetterCount, color: 'text-amber-400' },
            { label: 'Avg Retries', value: stats.avgRetryCount, color: 'text-fx-text-dim' },
          ].map((item) => (
            <div key={item.label} className="bg-fx-surface rounded-ios p-4 text-center">
              <p className="text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                {item.label}
              </p>
              <p className={cn('text-[22px] font-extrabold', item.color)}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Retry all button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold text-fx-text-dim uppercase tracking-wider">
          Failed / Dead-Letter ({failed.length})
        </h2>
        <button
          onClick={() => void handleRetryAll()}
          disabled={retrying || failed.filter((f) => f.status === 'failed').length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-fx-surface rounded-ios-xs text-[12px] font-semibold text-white border border-fx-border hover:border-fx-orange/50 disabled:opacity-40 active-scale"
        >
          <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
          Retry All Failed
        </button>
      </div>

      {retryResult !== null && (
        <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-ios-xs px-4 py-2.5 mb-4">
          <CheckCircle size={14} className="text-emerald-400" />
          <span className="text-[13px] text-emerald-400 font-semibold">
            {retryResult} notifications re-queued for delivery.
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-fx-surface rounded-ios animate-pulse" />
          ))}
        </div>
      ) : failed.length === 0 ? (
        <div className="bg-fx-surface rounded-ios p-8 text-center">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-fx-text-dim text-sm">No failed notifications. All clear.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {failed.map((n) => (
            <div key={n.id} className="bg-fx-surface rounded-ios p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  {n.status === 'dead' ? (
                    <SkipForward size={13} className="text-amber-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  )}
                  <span className="text-[13px] font-semibold text-white">{n.type}</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    n.status === 'dead'
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-red-400 bg-red-400/10',
                  )}
                >
                  {n.status}
                </span>
              </div>
              {n.recipient && (
                <p className="text-[12px] text-fx-text-dim truncate mb-0.5">To: {n.recipient}</p>
              )}
              {n.error_message && (
                <p className="text-[11px] text-red-400/80 truncate">{n.error_message}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-fx-text-dim">
                <span>
                  {n.attempts} attempt{n.attempts !== 1 ? 's' : ''}
                </span>
                <span>{new Date(n.created_at).toLocaleString()}</span>
                {n.next_retry_at && (
                  <span>Next: {new Date(n.next_retry_at).toLocaleTimeString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
