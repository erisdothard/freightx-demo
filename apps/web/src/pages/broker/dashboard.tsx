import { useState, useEffect, useCallback } from 'react';
import { Search, TrendingUp, Package, DollarSign, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { ViewSwitcher } from '@/shared/components/view-switcher';
import { StatCard } from '@/shared/components/stat-card';
import { LoadCard } from '@/features/loads/components/load-card';
import { useAuth } from '@/contexts/AuthContext';
import { getLoads, getLoadById } from '@/services/loads.service';
import { realtimeSubscribe } from '@/lib/realtime-manager';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { NotificationSheet } from '@/features/notifications/components/notification-sheet';
import { CarrierRelationshipsSheet } from '@/features/carriers/components/carrier-relationships-sheet';
import { LoadDetailSheet } from '@/features/loads/components/load-detail-sheet';
import type { Load } from '@freightx/shared';

export default function BrokerDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [carrierNetworkOpen, setCarrierNetworkOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const { notifications, unreadCount, markAllRead } = useNotifications();

  const fetchLoads = useCallback(() => {
    if (!user?.id) return;
    getLoads({ postedBy: user.id }).then(setLoads).catch(console.error);
  }, [user?.id]);

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

  const name = profile?.full_name ?? 'Broker';

  // Real stats derived from loaded data
  const activeLoads = loads.filter(
    (l) => l.status !== 'delivered' && l.status !== 'cancelled' && l.status !== 'expired',
  ).length;
  const totalRevenue = loads.reduce((sum, l) => sum + l.rateUsd, 0);
  const revenueLabel =
    totalRevenue >= 1000 ? `$${(totalRevenue / 1000).toFixed(1)}k` : `$${totalRevenue}`;
  const deliveredLoads = loads.filter((l) => ['delivered', 'completed'].includes(l.status)).length;
  const inProgressLoads = loads.filter((l) =>
    ['awarded', 'dispatched', 'in_transit'].includes(l.status),
  ).length;
  const deliveredAwaitingCompletion = loads.filter((l) => l.status === 'delivered');
  const bidsToReview = loads.filter((l) => l.status === 'bid_received');
  // Exclude canceled loads from recent loads
  const recentLoads = loads
    .filter((l) => ['posted', 'awarded', 'dispatched', 'in_transit'].includes(l.status))
    .sort((a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime())
    .slice(0, 3);

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        greeting
        name={name}
        notificationCount={unreadCount}
        onNotificationClick={() => setNotifsOpen(true)}
      />

      {/* View Switcher */}
      <div className="px-5 pb-3 flex justify-center">
        <ViewSwitcher />
      </div>

      {/* Search */}
      <div className="px-5 py-3">
        <button
          onClick={() => navigate('/broker/loads')}
          className="w-full h-12 bg-fx-surface border border-fx-border rounded-2xl flex items-center gap-3 px-4 hover:border-fx-orange/50 transition-all duration-200"
        >
          <Search size={16} className="text-fx-orange" />
          <span className="text-sm text-fx-text-dim font-medium">
            Search loads, carriers, lanes…
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-6">
        {/* Action Required — Delivered loads needing completion */}
        {deliveredAwaitingCompletion.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold text-fx-text-dim tracking-[0.12em] uppercase mb-1">
                  Pending
                </p>
                <p className="text-[17px] font-bold text-white tracking-[-0.02em]">
                  Action Required
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-900 bg-amber-400 px-2.5 py-1 rounded-full">
                {deliveredAwaitingCompletion.length}
              </span>
            </div>
            <div className="space-y-3">
              {deliveredAwaitingCompletion.map((load) => (
                <button
                  key={load.id}
                  onClick={() => setSelectedLoad(load)}
                  className="w-full text-left bg-green-500/[0.06] border border-green-500/20 rounded-ios-sm p-4 active-scale transition-colors"
                  style={{ boxShadow: 'inset 3px 0 0 rgba(34, 197, 94, 0.65)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[11px] text-fx-text-dim">Load {load.loadNumber}</p>
                      <p className="text-[15px] font-bold text-white mt-0.5">
                        {load.originCity} → {load.destCity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-bold text-fx-orange">
                        ${load.rateUsd.toLocaleString()}
                      </p>
                      <span className="text-[10px] font-semibold text-green-400 tracking-[0.06em] uppercase">
                        Delivered
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-fx-text-dim">
                      <span className="text-green-400 font-semibold">Ready to close out</span>
                    </p>
                    <p className="text-[11px] font-bold text-green-400">Mark Complete →</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bids to Review */}
        {bidsToReview.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold text-fx-text-dim tracking-[0.12em] uppercase mb-1">
                  Action Required
                </p>
                <p className="text-[17px] font-bold text-white tracking-[-0.02em]">
                  Bids to Review
                </p>
              </div>
              <span className="text-[11px] font-bold text-white bg-fx-orange px-2.5 py-1 rounded-full">
                {bidsToReview.length}
              </span>
            </div>
            <div className="space-y-3">
              {bidsToReview.map((load) => (
                <button
                  key={load.id}
                  onClick={() => setSelectedLoad(load)}
                  className="w-full text-left bg-fx-orange/[0.06] border border-fx-orange/25 rounded-ios-sm p-4 active-scale transition-colors"
                  style={{ boxShadow: 'inset 3px 0 0 rgba(232,96,48,0.65)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[11px] text-fx-text-dim">Load {load.loadNumber}</p>
                      <p className="text-[15px] font-bold text-white mt-0.5">
                        {load.originCity} → {load.destCity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-bold text-fx-orange">
                        ${load.rateUsd.toLocaleString()}
                      </p>
                      <span className="text-[10px] font-semibold text-fx-orange tracking-[0.06em] uppercase">
                        {load.bidCount ?? 1} Bid{(load.bidCount ?? 1) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-fx-text-dim">
                      <span className="text-fx-orange font-semibold">Carriers are waiting</span>
                    </p>
                    <p className="text-[11px] font-bold text-fx-orange">Review &amp; Award →</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div>
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Active Loads"
              value={String(activeLoads || '—')}
              trend="up"
              trendValue="from load board"
              icon={<Package size={16} />}
            />
            <StatCard
              label="Total Revenue"
              value={revenueLabel || '—'}
              trend="up"
              trendValue="all loaded loads"
              icon={<DollarSign size={16} />}
              highlight
            />
            <StatCard
              label="Delivered"
              value={String(deliveredLoads || '—')}
              trend="up"
              trendValue="completed loads"
              icon={<CheckCircle size={16} />}
            />
            <StatCard
              label="In Progress"
              value={String(inProgressLoads || '—')}
              trend="flat"
              trendValue="active loads"
              icon={<TrendingUp size={16} />}
            />
          </div>
        </div>

        {/* My loads */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
              Recent Loads
            </h2>
            <button
              onClick={() => navigate('/broker/loads')}
              className="text-xs font-semibold text-fx-orange hover:underline"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {recentLoads.length === 0 ? (
              <div className="bg-fx-surface border border-fx-border rounded-2xl p-6 text-center text-sm text-fx-text-muted">
                No active loads in pipeline
              </div>
            ) : (
              recentLoads.map((load) => (
                <LoadCard
                  key={load.id}
                  load={load}
                  showBidButton={false}
                  onPress={setSelectedLoad}
                />
              ))
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCarrierNetworkOpen(true)}
            className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-fx-orange/50 hover:bg-fx-surface-2 transition-all duration-200"
          >
            <span className="text-2xl">🤝</span>
            <span className="text-xs font-semibold text-fx-text-muted">Carrier Network</span>
          </button>
          <button
            onClick={() => navigate('/broker/api-keys')}
            className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-fx-orange/50 hover:bg-fx-surface-2 transition-all duration-200"
          >
            <span className="text-2xl">🔑</span>
            <span className="text-xs font-semibold text-fx-text-muted">API Keys</span>
          </button>
        </div>
      </div>

      <BottomNav role="broker" />

      <NotificationSheet
        open={notifsOpen}
        onClose={() => setNotifsOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={markAllRead}
        onNotificationClick={async (n) => {
          if (n.load_id) {
            setNotifsOpen(false);
            const found = loads.find((l) => l.id === n.load_id) ?? (await getLoadById(n.load_id));
            if (found) setSelectedLoad(found);
          }
        }}
      />

      <CarrierRelationshipsSheet
        open={carrierNetworkOpen}
        onClose={() => setCarrierNetworkOpen(false)}
      />

      <LoadDetailSheet
        load={selectedLoad}
        onClose={() => {
          setSelectedLoad(null);
          fetchLoads();
        }}
        showBidButton={false}
        role={profile?.role as 'broker' | 'carrier' | 'driver' | undefined}
      />
    </div>
  );
}
