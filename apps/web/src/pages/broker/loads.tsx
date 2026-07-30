import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, X, SlidersHorizontal, WifiOff, LayoutList, LayoutGrid } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { LoadCard } from '@/features/loads/components/load-card';
import { PostLoadSheet } from '@/features/loads/components/post-load-sheet';
import { LoadDetailSheet } from '@/features/loads/components/load-detail-sheet';
import { useLoads } from '@/features/loads/hooks/use-loads';
import { useLoadActionCounts } from '@/features/loads/hooks/use-load-action-counts';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/shared/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import type { Load } from '@freightx/shared';
import type { LoadStatus } from '@/lib/database.types';

type PageTab = 'active' | 'history';

const ACTIVE_STATUSES = new Set([
  'posted',
  'bid_received',
  'awarded',
  'dispatched',
  'in_transit',
  'delivered',
]);
const HISTORY_STATUSES = new Set(['completed', 'cancelled', 'expired']);

const STATUS_FILTERS = [
  'All',
  'posted',
  'bid_received',
  'awarded',
  'dispatched',
  'in_transit',
  'delivered',
];
const STATUS_LABELS: Record<string, string> = {
  All: 'All Loads',
  posted: 'Posted',
  bid_received: 'Bids Received',
  awarded: 'Awarded',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'rate_high', label: 'Highest Rate' },
  { key: 'rate_low', label: 'Lowest Rate' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];

export default function BrokerLoadsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showPost, setShowPost] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [tab, setTab] = useState<PageTab>('active');
  const [viewMode, setViewMode] = useState<'full' | 'compact'>(() =>
    (localStorage.getItem('fx_broker_load_view') as 'full' | 'compact') || 'full',
  );

  // Open post sheet when navigated here via "Post Load" nav tab
  useEffect(() => {
    if (searchParams.get('post') === '1') {
      setShowPost(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { loads, loading, error, refresh } = useLoads({
    status: 'all',
    search: search || undefined,
    postedBy: user?.id,
  });

  const activeLoads = loads.filter((l) => ACTIVE_STATUSES.has(l.status));
  const historyLoads = loads.filter((l) => HISTORY_STATUSES.has(l.status));

  // Badge count for bid_received chip (uses the same lightweight query as the nav badge)
  const bidReceivedCount = useLoadActionCounts();

  // Keep selectedLoad in sync when loads refresh
  useEffect(() => {
    if (!selectedLoad) return;
    const updated = loads.find((l) => l.id === selectedLoad.id);
    if (updated) setSelectedLoad(updated);
  }, [loads]);

  const filteredActive =
    statusFilter === 'All' ? activeLoads : activeLoads.filter((l) => l.status === statusFilter);

  const sortedLoads = [...(tab === 'history' ? historyLoads : filteredActive)].sort((a, b) => {
    const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    if (sortBy === 'oldest') return aTime - bTime;
    if (sortBy === 'rate_high') return b.rateUsd - a.rateUsd;
    if (sortBy === 'rate_low') return a.rateUsd - b.rateUsd;
    return bTime - aTime;
  });

  // Grouped view for "All" tab
  const STATUS_GROUPS = [
    {
      key: 'bid_received',
      label: 'Bids to Review',
      accent: 'text-fx-orange',
      badge: 'bg-fx-orange text-white',
    },
    {
      key: 'delivered',
      label: 'Awaiting Close-Out',
      accent: 'text-green-400',
      badge: 'bg-green-500 text-white',
    },
    {
      key: 'awarded',
      label: 'Awarded',
      accent: 'text-amber-400',
      badge: 'bg-amber-400 text-amber-900',
    },
    {
      key: 'dispatched',
      label: 'Dispatched',
      accent: 'text-blue-400',
      badge: 'bg-blue-500 text-white',
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      accent: 'text-fx-orange',
      badge: 'bg-fx-orange text-white',
    },
    {
      key: 'posted',
      label: 'Posted',
      accent: 'text-fx-text-muted',
      badge: 'bg-fx-surface border border-fx-border text-fx-text-muted',
    },
    {
      key: 'completed',
      label: 'Completed',
      accent: 'text-fx-text-dim',
      badge: 'bg-fx-surface border border-fx-border text-fx-text-dim',
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      accent: 'text-red-400',
      badge: 'bg-red-500/20 text-red-400',
    },
    {
      key: 'expired',
      label: 'Expired',
      accent: 'text-fx-text-dim',
      badge: 'bg-fx-surface border border-fx-border text-fx-text-dim',
    },
  ] as const;

  const grouped = STATUS_GROUPS.map((g) => ({
    ...g,
    loads: filteredActive.filter((l) => l.status === g.key),
  })).filter((g) => g.loads.length > 0);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        title="My Loads"
        showBack
        right={
          <button
            onClick={() => {
              const next = viewMode === 'full' ? 'compact' : 'full';
              setViewMode(next);
              localStorage.setItem('fx_broker_load_view', next);
            }}
            className="w-9 h-9 rounded-full bg-fx-surface border border-fx-border flex items-center justify-center hover:border-fx-orange/50 transition-colors"
          >
            {viewMode === 'full' ? (
              <LayoutList size={15} className="text-fx-text-muted" />
            ) : (
              <LayoutGrid size={15} className="text-fx-text-muted" />
            )}
          </button>
        }
      />

      {/* Tab bar */}
      <div className="px-5 pt-3 pb-1 border-b border-fx-divider">
        <Tabs value={tab} onValueChange={(v) => setTab(v as PageTab)}>
          <TabsList className="w-full bg-fx-surface-2">
            <TabsTrigger
              value="active"
              className={cn('flex-1', tab === 'active' && 'bg-fx-orange text-white data-[state=active]:bg-fx-orange data-[state=active]:text-white')}
            >
              Active
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className={cn('flex-1', tab === 'history' && 'bg-fx-orange text-white data-[state=active]:bg-fx-orange data-[state=active]:text-white')}
            >
              History
              {historyLoads.length > 0 && (
                <span className={cn(
                  'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  tab === 'history' ? 'bg-white/20 text-white' : 'bg-fx-surface-3 text-fx-text-muted',
                )}>
                  {historyLoads.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-5 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-orange" />
          <input
            type="text"
            placeholder="Search loads by lane, ID, commodity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 bg-fx-surface border border-fx-border rounded-2xl pl-10 pr-10 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fx-text-dim"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter chips — active tab only */}
        {tab === 'active' && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'shrink-0 h-8 px-4 rounded-xl text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5',
                  statusFilter === s
                    ? 'bg-fx-orange text-white border-fx-orange'
                    : 'bg-fx-surface border-fx-border text-fx-text-muted hover:border-fx-border-2',
                )}
              >
                {STATUS_LABELS[s] ?? s}
                {s === 'bid_received' && bidReceivedCount > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none',
                      statusFilter === 'bid_received'
                        ? 'bg-white/20 text-white'
                        : 'bg-fx-orange text-white',
                    )}
                  >
                    {bidReceivedCount > 9 ? '9+' : bidReceivedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Post Load CTA — active tab only */}
      {tab === 'active' && (
        <button
          onClick={() => setShowPost(true)}
          className="mx-5 mb-1 w-[calc(100%-40px)] h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(145deg, #F07040, #C03A12)',
            boxShadow: '0 4px 16px rgba(232,96,48,0.35)',
          }}
        >
          <Plus size={17} />
          Post New Load
        </button>
      )}

      {/* Results count + sort */}
      <div className="px-5 mb-3 flex items-center justify-between relative">
        <span className="text-xs font-semibold text-fx-text-muted">
          {loading
            ? 'Loading…'
            : tab === 'history'
              ? `${sortedLoads.length} past load${sortedLoads.length !== 1 ? 's' : ''}`
              : `${filteredActive.length} load${filteredActive.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => setShowSortMenu((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold transition-colors',
            showSortMenu ? 'text-fx-orange' : 'text-fx-text-muted',
          )}
        >
          <SlidersHorizontal size={13} />
          {SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Sort'}
        </button>
        {showSortMenu && (
          <div className="absolute right-5 top-7 z-50 bg-fx-surface border border-fx-border rounded-xl shadow-lg py-1 min-w-[160px]">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setSortBy(opt.key);
                  setShowSortMenu(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors',
                  sortBy === opt.key
                    ? 'text-fx-orange bg-fx-orange/10'
                    : 'text-fx-text-muted hover:bg-fx-surface-2',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss sort menu on scroll */}
      <div
        className="flex-1 overflow-y-auto px-5 space-y-3"
        onScroll={() => showSortMenu && setShowSortMenu(false)}
      >
        {loading ? (
          <SkeletonList count={4} />
        ) : error ? (
          <EmptyState
            icon={<WifiOff size={36} className="text-fx-text-dim" />}
            title="Couldn't load your loads"
            subtitle={error}
            action={
              <button
                onClick={refresh}
                className="text-sm font-semibold text-fx-orange border border-fx-orange/30 px-5 py-2 rounded-xl hover:bg-fx-orange/10 transition-colors"
              >
                Try Again
              </button>
            }
          />
        ) : sortedLoads.length === 0 ? (
          <EmptyState
            icon={<span className="text-5xl">{tab === 'history' ? '\ud83d\uddc2\ufe0f' : '\ud83d\udce6'}</span>}
            title={tab === 'history' ? 'No past loads yet' : 'No loads found'}
            subtitle={
              tab === 'history'
                ? 'Completed, cancelled, and expired loads will appear here'
                : 'Try adjusting your filters'
            }
            action={
              tab === 'active' ? (
                <button
                  onClick={() => setShowPost(true)}
                  className="text-sm font-semibold text-fx-orange border border-fx-orange/30 px-5 py-2 rounded-xl hover:bg-fx-orange/10 transition-colors"
                >
                  Post a Load
                </button>
              ) : undefined
            }
          />
        ) : tab === 'history' ? (
          <div className="space-y-3">
            {sortedLoads.map((load) => (
              <LoadCard key={load.id} load={load} showBidButton={false} onPress={setSelectedLoad} variant={viewMode} />
            ))}
          </div>
        ) : statusFilter === 'All' ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-3">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${group.accent}`}>
                    {group.label}
                  </p>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${group.badge}`}
                  >
                    {group.loads.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.loads.map((load) => (
                    <LoadCard
                      key={load.id}
                      load={load}
                      showBidButton={false}
                      onPress={setSelectedLoad}
                      variant={viewMode}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          sortedLoads.map((load) => (
            <LoadCard key={load.id} load={load} showBidButton={false} onPress={setSelectedLoad} variant={viewMode} />
          ))
        )}
      </div>

      <BottomNav role="broker" />

      <PostLoadSheet open={showPost} onClose={() => setShowPost(false)} onCreated={refresh} />

      <LoadDetailSheet
        load={selectedLoad}
        onClose={() => setSelectedLoad(null)}
        showBidButton={false}
        role="broker"
      />
    </div>
  );
}
