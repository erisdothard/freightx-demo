import { useState, useEffect, useCallback } from 'react';
import { Search, Package, Clock, TrendingDown, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { StatCard } from '@/shared/components/stat-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getLoads, getLoadById } from '@/services/loads.service';
import { realtimeSubscribe } from '@/lib/realtime-manager';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { NotificationSheet } from '@/features/notifications/components/notification-sheet';
import { LoadDetailSheet } from '@/features/loads/components/load-detail-sheet';
import type { Load } from '@freightx/shared';

const statusBadge: Record<string, 'orange' | 'blue' | 'green' | 'gray'> = {
  in_transit: 'orange',
  dispatched: 'orange',
  posted: 'blue',
  bid_received: 'blue',
  awarded: 'blue',
  delivered: 'green',
  completed: 'green',
};

const statusLabel: Record<string, string> = {
  posted: 'Posted',
  bid_received: 'Bids Received',
  awarded: 'Carrier Assigned',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  completed: 'Completed',
};

export default function ShipperDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
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

  const name = profile?.full_name ?? 'Shipper';
  const inTransitLoads = loads.filter((l) => l.status === 'in_transit');
  const deliveredUnconfirmed = loads.filter((l) => l.status === 'delivered');
  const needsAttention = [...deliveredUnconfirmed, ...inTransitLoads];

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        greeting
        name={name}
        notificationCount={unreadCount}
        onNotificationClick={() => setNotifsOpen(true)}
      />

      {/* Search */}
      <div className="px-5 py-3">
        <button
          onClick={() => navigate('/track')}
          className="w-full h-12 bg-fx-surface border border-fx-border rounded-2xl flex items-center gap-3 px-4 hover:border-fx-orange/50 transition-all duration-200"
        >
          <Search size={16} className="text-fx-orange" />
          <span className="text-sm text-fx-text-dim font-medium">Track by load # or PRO…</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-6">
        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
                Needs Attention
              </h2>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-fx-orange text-white text-[10px] font-bold flex items-center justify-center">
                {needsAttention.length}
              </span>
            </div>
            <div className="space-y-3">
              {needsAttention.map((load) => {
                const isDelivered = load.status === 'delivered';
                return (
                  <button
                    key={load.id}
                    onClick={() => setSelectedLoad(load)}
                    className={`w-full text-left p-4 rounded-2xl border ${
                      isDelivered
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-fx-orange/10 border-fx-orange/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDelivered
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-fx-orange/20 text-fx-orange'
                        }`}
                      >
                        {isDelivered ? 'CONFIRM RECEIPT' : 'IN TRANSIT'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-fx-text">
                      {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                    </p>
                    <p className="text-xs text-fx-text-muted mt-0.5">
                      {isDelivered ? 'Tap to confirm delivery receipt' : 'Tap to track shipment'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div>
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            Shipping Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Active"
              value={String(
                loads.filter((l) => ['awarded', 'dispatched', 'in_transit'].includes(l.status))
                  .length,
              )}
              trend="flat"
              trendValue="In progress"
              icon={<Package size={16} />}
            />
            <StatCard
              label="Pending"
              value={String(
                loads.filter((l) => ['posted', 'bid_received'].includes(l.status)).length,
              )}
              trend="flat"
              trendValue="Awaiting carrier"
              icon={<Clock size={16} />}
            />
            <StatCard
              label="Delivered"
              value={String(
                loads.filter((l) => ['delivered', 'completed'].includes(l.status)).length,
              )}
              trend="flat"
              trendValue="All time"
              icon={<CheckCircle size={16} />}
            />
            <StatCard
              label="Total Loads"
              value={String(loads.length)}
              trend="flat"
              trendValue="Lifetime"
              icon={<TrendingDown size={16} />}
            />
          </div>
        </div>

        {/* My Shipments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
              My Shipments
            </h2>
            <button
              onClick={() => navigate('/shipper/loads')}
              className="text-xs font-semibold text-fx-orange hover:underline"
            >
              View All →
            </button>
          </div>
          <div className="bg-fx-surface border border-fx-border rounded-2xl divide-y divide-fx-border">
            {loads.length === 0 ? (
              <div className="p-6 text-center text-sm text-fx-text-muted">No shipments yet</div>
            ) : (
              loads.map((load) => (
                <div
                  key={load.id}
                  className="p-4 flex items-center gap-3 hover:bg-fx-surface-2 transition-colors cursor-pointer"
                  onClick={() => setSelectedLoad(load)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
                      <Badge variant={statusBadge[load.status] ?? 'gray'} size="sm">
                        {statusLabel[load.status] ?? load.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-fx-text">
                      {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                    </p>
                    <p className="text-xs text-fx-text-muted mt-0.5">
                      {new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="text-fx-text-dim">›</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Book Shipment', icon: '📦', action: () => navigate('/shipper/loads') },
              {
                label: 'Dock Schedule',
                icon: '🚪',
                action: () => navigate('/shipper/dock-scheduling'),
              },
              { label: 'RFPs', icon: '📑', action: () => navigate('/shipper/rfps') },
              { label: 'Track Load', icon: '🔍', action: () => navigate('/track') },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="bg-fx-surface border border-fx-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-fx-orange/50 hover:bg-fx-surface-2 transition-all duration-200"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-semibold text-fx-text-muted">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          fullWidth
          className="rounded-2xl font-bold"
          onClick={() => navigate('/shipper/loads')}
        >
          <Package size={18} />
          Book New Shipment
        </Button>
      </div>

      <BottomNav role="shipper" />

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
