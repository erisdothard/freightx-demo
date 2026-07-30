import { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, RefreshCw } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { supabase } from '@/lib/supabase';

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  diff: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const ACTION_COLORS: Record<string, string> = {
  created: 'text-green-400  bg-green-400/10',
  updated: 'text-blue-400   bg-blue-400/10',
  deleted: 'text-red-400    bg-red-400/10',
  status_changed: 'text-yellow-400 bg-yellow-400/10',
  bid_accepted: 'text-green-400  bg-green-400/10',
  bid_declined: 'text-red-400    bg-red-400/10',
  booking_confirmed: 'text-fx-orange  bg-orange-500/10',
  payment_recorded: 'text-purple-400 bg-purple-400/10',
};

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchEntries = useCallback(
    async (p: number, append: boolean) => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('audit_log')
        .select('*, profiles!audit_log_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

      if (filter) {
        query = query.or(`entity_type.eq.${filter},action.eq.${filter}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (query as any);
      const rows = (data ?? []) as AuditEntry[];
      setEntries((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    },
    [filter],
  );

  useEffect(() => {
    setPage(0);
    fetchEntries(0, false);
  }, [fetchEntries]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchEntries(next, true);
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Audit Log" showBack backAction={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-fx-orange" />
            <h1 className="text-lg font-bold text-fx-text">System Audit Trail</h1>
          </div>
          <button
            onClick={() => fetchEntries(0, false)}
            className="w-8 h-8 rounded-lg bg-fx-surface-2 flex items-center justify-center"
          >
            <RefreshCw size={14} className="text-fx-text-dim" />
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 bg-fx-surface border border-fx-border rounded-xl text-fx-text text-sm px-3 focus:border-fx-orange outline-none"
            style={{ colorScheme: 'dark' }}
          >
            <option value="" style={{ background: '#141414' }}>
              All Events
            </option>
            <option value="load" style={{ background: '#141414' }}>
              Loads
            </option>
            <option value="bid" style={{ background: '#141414' }}>
              Bids
            </option>
            <option value="booking_confirmed" style={{ background: '#141414' }}>
              Bookings
            </option>
            <option value="payment_recorded" style={{ background: '#141414' }}>
              Payments
            </option>
          </select>
        </div>

        {loading && entries.length === 0 ? (
          <SkeletonList count={4} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Shield size={28} className="text-fx-text-dim" />}
            title="No audit entries found"
            subtitle="Actions will appear here as users interact with the system"
          />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const colorClass =
                ACTION_COLORS[entry.action] ?? 'text-fx-text-muted bg-fx-surface-2';
              const actor = entry.profiles;
              return (
                <div
                  key={entry.id}
                  className="bg-fx-surface border border-fx-border rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${colorClass}`}
                        >
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-fx-text-dim">
                          {entry.entity_type} · {entry.entity_id.slice(0, 8)}…
                        </span>
                      </div>
                      <p className="text-xs text-fx-text mt-1">
                        {actor?.full_name ?? actor?.email ?? entry.user_id?.slice(0, 8) ?? 'System'}
                      </p>
                      {entry.diff && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-fx-text-dim cursor-pointer">
                            View diff
                          </summary>
                          <pre className="text-[9px] text-fx-text-dim mt-1 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(entry.diff, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-fx-text-dim">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[9px] text-fx-text-dim">
                        {new Date(entry.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full h-10 rounded-xl bg-fx-surface border border-fx-border text-sm text-fx-text-muted font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav role={'carrier' as never} />
    </div>
  );
}
