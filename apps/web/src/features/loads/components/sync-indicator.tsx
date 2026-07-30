import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { getSyncStatus, processQueue } from '@/services/offline-sync.service';

export function SyncIndicator() {
  const [status, setStatus] = useState({ pending: 0, failed: 0, total: 0 });
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // Poll sync status
  useEffect(() => {
    const check = () => setStatus(getSyncStatus());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      handleSync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function handleSync() {
    if (syncing || status.pending === 0) return;
    setSyncing(true);
    try {
      await processQueue();
      setStatus(getSyncStatus());
    } finally {
      setSyncing(false);
    }
  }

  // Nothing to show if online and no pending items
  if (online && status.total === 0) return null;

  return (
    <button
      onClick={handleSync}
      disabled={syncing || !online || status.pending === 0}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
        !online
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : status.failed > 0
            ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
            : syncing
              ? 'bg-blue-400/10 border-blue-400/30 text-blue-400'
              : 'bg-fx-surface border-fx-border text-fx-text-muted'
      }`}
    >
      {!online ? (
        <>
          <CloudOff size={10} />
          Offline ({status.pending})
        </>
      ) : syncing ? (
        <>
          <Loader2 size={10} className="animate-spin" />
          Syncing...
        </>
      ) : status.failed > 0 ? (
        <>
          <CloudOff size={10} />
          {status.failed} failed
        </>
      ) : status.pending > 0 ? (
        <>
          <Cloud size={10} />
          {status.pending} pending
        </>
      ) : null}
    </button>
  );
}
