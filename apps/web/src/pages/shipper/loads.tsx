import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { LoadDetailSheet } from '@/features/loads/components/load-detail-sheet';
import { PostLoadSheet } from '@/features/loads/components/post-load-sheet';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { getLoads } from '@/services/loads.service';
import { realtimeSubscribe } from '@/lib/realtime-manager';
import { useAuth } from '@/contexts/AuthContext';
import type { Load } from '@freightx/shared';

const STATUS_FILTERS = [
  'All',
  'posted',
  'bid_received',
  'awarded',
  'dispatched',
  'in_transit',
  'delivered',
  'completed',
];
const STATUS_LABELS: Record<string, string> = {
  All: 'All',
  posted: 'Posted',
  bid_received: 'Bids Received',
  awarded: 'Carrier Assigned',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  completed: 'Completed',
};
const STATUS_BADGE: Record<string, 'orange' | 'blue' | 'green' | 'gray'> = {
  posted: 'blue',
  bid_received: 'blue',
  awarded: 'blue',
  dispatched: 'orange',
  in_transit: 'orange',
  delivered: 'green',
  completed: 'green',
};

export default function ShipperLoadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);

  const fetchLoads = useCallback(() => {
    setLoading(true);
    getLoads({ postedBy: user?.id, search: search || undefined })
      .then(setLoads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id, search]);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  useEffect(() => {
    if (!user?.id) return;
    const u1 = realtimeSubscribe({ table: 'loads', event: 'UPDATE' }, fetchLoads);
    const u2 = realtimeSubscribe({ table: 'loads', event: 'INSERT' }, fetchLoads);
    return () => {
      u1();
      u2();
    };
  }, [user?.id, fetchLoads]);

  // Keep selectedLoad in sync when loads refresh
  useEffect(() => {
    if (!selectedLoad) return;
    const updated = loads.find((l) => l.id === selectedLoad.id);
    if (updated) setSelectedLoad(updated);
  }, [loads]);

  const filtered = statusFilter === 'All' ? loads : loads.filter((l) => l.status === statusFilter);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="My Shipments" showBack />

      <div className="px-5 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-orange" />
          <input
            type="text"
            placeholder="Search by load #, lane, commodity…"
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

        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'shrink-0 h-8 px-4 rounded-xl text-xs font-semibold border transition-all duration-200',
                statusFilter === s
                  ? 'bg-fx-orange text-white border-fx-orange'
                  : 'bg-fx-surface border-fx-border text-fx-text-muted hover:border-fx-border-2',
              )}
            >
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-5 mb-3">
        <span className="text-xs font-semibold text-fx-text-muted">
          {loading ? 'Loading…' : `${filtered.length} shipment${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Shipment list */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3">
        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package size={28} className="text-fx-text-dim" />}
            title="No shipments yet"
            subtitle="Book your first shipment to get started"
          />
        ) : (
          filtered.map((load) => (
            <div
              key={load.id}
              onClick={() => setSelectedLoad(load)}
              className="bg-fx-surface border border-fx-border rounded-2xl p-4 cursor-pointer active-scale transition-colors hover:border-fx-orange/30"
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
                <Badge variant={STATUS_BADGE[load.status] ?? 'gray'} size="sm">
                  {STATUS_LABELS[load.status] ?? load.status}
                </Badge>
              </div>

              {/* Route */}
              <p className="text-sm font-bold text-fx-text mb-1">
                {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-3 text-xs text-fx-text-muted">
                <span>
                  Pickup{' '}
                  {new Date(load.pickupDate + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {load.totalMiles && <span>· {load.totalMiles} mi</span>}
                <span className="ml-auto font-semibold text-fx-text">
                  ${load.rateUsd.toLocaleString()}
                </span>
              </div>

              {load.commodity && <p className="text-xs text-fx-text-dim mt-1">{load.commodity}</p>}

              {/* Track button for in-transit */}
              {load.status === 'in_transit' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/track/${load.loadNumber}`);
                  }}
                  className="mt-3 w-full h-8 rounded-xl border border-fx-orange/30 text-fx-orange text-xs font-semibold hover:bg-fx-orange/10 transition-colors"
                >
                  Track Shipment →
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="px-5 py-4">
        <Button
          size="lg"
          fullWidth
          className="rounded-2xl font-bold"
          onClick={() => setShowBook(true)}
        >
          <Plus size={18} />
          Book New Shipment
        </Button>
      </div>

      <BottomNav role="shipper" />

      <PostLoadSheet open={showBook} onClose={() => setShowBook(false)} onCreated={fetchLoads} />

      <LoadDetailSheet
        load={selectedLoad}
        onClose={() => {
          setSelectedLoad(null);
          fetchLoads();
        }}
        showBidButton={false}
        role="shipper"
      />
    </div>
  );
}
