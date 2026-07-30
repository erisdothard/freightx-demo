import { useState, useEffect, useCallback } from 'react';
import { Search, Package, Clock, TrendingDown, CheckCircle, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { StatCard } from '@/shared/components/stat-card';
import { Badge } from '@/shared/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getDriverLoads, getLoadById } from '@/services/loads.service';
import { realtimeSubscribe } from '@/lib/realtime-manager';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { NotificationSheet } from '@/features/notifications/components/notification-sheet';
import { LoadDetailSheet } from '@/features/loads/components/load-detail-sheet';
import { useDriverLocation } from '@/features/loads/hooks/use-driver-location';
import { useGpsConsent } from '@/features/loads/hooks/use-gps-consent';
import { GpsConsentModal } from '@/features/loads/components/gps-consent-modal';
import { canSendGps } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { Load } from '@freightx/shared';

/** Renders nothing — just activates GPS pinging for a single load */
function GpsPinger({ loadNumber }: { loadNumber: string }) {
  useDriverLocation({ loadNumber, active: true });
  return null;
}

/** Renders nothing — activates GPS pinging without a specific load (manual share / idle) */
function IdleGpsPinger() {
  useDriverLocation({ loadNumber: '__idle__', active: true });
  return null;
}

const statusBadge: Record<string, 'orange' | 'blue' | 'green' | 'gray'> = {
  in_transit: 'orange',
  dispatched: 'blue',
  awarded: 'blue',
  delivered: 'green',
  completed: 'green',
};

const statusLabel: Record<string, string> = {
  in_transit: 'In Transit',
  dispatched: 'Dispatched',
  awarded: 'Awarded',
  delivered: 'Delivered',
  completed: 'Completed',
};

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [allLoads, setAllLoads] = useState<Load[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [activeLoads, setActiveLoads] = useState<Load[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [canSendGpsPermission, setCanSendGpsPermission] = useState(false);
  const [manualGpsToggle, setManualGpsToggle] = useState(() => {
    try {
      return localStorage.getItem('fx-gps-sharing') === 'true';
    } catch {
      return false;
    }
  });

  // GPS is on if: manual toggle is on OR any load is in_transit
  const hasInTransitLoads = activeLoads.some((l) => l.status === 'in_transit');
  const sharingLocation = manualGpsToggle || hasInTransitLoads;
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const { hasConsented, grantConsent } = useGpsConsent();
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [gpsRequestModalOpen, setGpsRequestModalOpen] = useState(false);

  // Watch for GPS request notifications from carrier
  useEffect(() => {
    const gpsReq = notifications.find((n) => n.type === 'gps_request' && !n.read);
    if (gpsReq && !manualGpsToggle) {
      if (hasConsented) {
        // Already consented — auto-enable GPS and mark read
        setManualGpsToggle(true);
        supabase.from('notifications').update({ read: true }).eq('id', gpsReq.id).then();
      } else {
        // Need consent first
        setGpsRequestModalOpen(true);
      }
    }
  }, [notifications, manualGpsToggle, hasConsented]);

  // Check GPS send permission on mount
  useEffect(() => {
    if (user?.id && profile?.role) {
      canSendGps(profile.role as any, user.id)
        .then(setCanSendGpsPermission)
        .catch(() => setCanSendGpsPermission(false));
    }
  }, [user?.id, profile?.role]);

  // Persist GPS sharing toggle across sessions
  useEffect(() => {
    try {
      localStorage.setItem('fx-gps-sharing', String(manualGpsToggle));
    } catch {
      /* ignored */
    }
  }, [manualGpsToggle]);

  const fetchLoads = useCallback(() => {
    if (!user?.id) return;
    const terminal = new Set([
      'delivered',
      'cancelled',
      'tonu',
      'rejected',
      'draft',
      'pending_approval',
    ]);
    const priority: Record<string, number> = {
      in_transit: 0,
      dispatched: 1,
      awarded: 2,
      delivered: 3,
      completed: 4,
    };
    // Fetch driver loads (pre-dispatch statuses always excluded at service layer)
    getDriverLoads(user.id)
      .then((all) => {
        setAllLoads(all);
        const sorted = [...all].sort(
          (a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5),
        );
        setLoads(sorted.slice(0, 5));
        setActiveLoads(all.filter((l) => !terminal.has(l.status)));
      })
      .catch(console.error);
  }, [user?.id]);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  useEffect(() => {
    if (!user?.id) return;
    return realtimeSubscribe({ table: 'loads', event: 'UPDATE' }, fetchLoads);
  }, [user?.id, fetchLoads]);

  // Keep selectedLoad in sync with realtime updates
  useEffect(() => {
    if (!selectedLoad) return;
    const updated = loads.find((l) => l.id === selectedLoad.id);
    if (updated) setSelectedLoad(updated);
  }, [loads]);

  const inTransitCount = allLoads.filter((l) => l.status === 'in_transit').length;
  const deliveredCount = allLoads.filter((l) => l.status === 'delivered').length;
  const completedCount = allLoads.filter((l) => l.status === 'completed').length;
  const deliveredLoads = allLoads.filter((l) => l.status === 'delivered');

  const name = profile?.full_name ?? 'Driver';

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
          <span className="text-sm text-fx-text-dim font-medium">Track by load # or PRO...</span>
        </button>
      </div>

      {/* GPS pingers — auto-enabled for in_transit, manual toggle for others */}
      {activeLoads
        .filter((l) => l.status === 'in_transit' || sharingLocation)
        .map((l) => (
          <GpsPinger key={l.loadNumber} loadNumber={l.loadNumber} />
        ))}
      {/* Idle GPS pinger — when sharing location but no active loads to attach to */}
      {sharingLocation && activeLoads.length === 0 && <IdleGpsPinger />}

      <div className="flex-1 overflow-y-auto px-5 space-y-6">
        {/* Share Location banner */}
        <button
          onClick={() => {
            if (hasInTransitLoads) {
              // GPS is auto-locked when loads are in_transit
              return;
            }
            if (!manualGpsToggle && !hasConsented) {
              setConsentModalOpen(true);
              return;
            }
            setManualGpsToggle((v) => !v);
          }}
          className="w-full flex items-center justify-between rounded-2xl p-4 active-scale"
          style={{
            background: sharingLocation
              ? 'linear-gradient(135deg,rgba(34,197,94,0.18),rgba(34,197,94,0.08))'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${sharingLocation ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
            opacity: hasInTransitLoads ? 0.9 : 1,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: sharingLocation ? 'rgba(34,197,94,0.2)' : 'rgba(232,96,48,0.12)',
              }}
            >
              <Radio size={18} className={sharingLocation ? 'text-green-400' : 'text-fx-orange'} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-white">
                Share Location {hasInTransitLoads && '🔒'}
              </p>
              <p className="text-[11px] text-fx-text-dim mt-0.5">
                {hasInTransitLoads
                  ? 'GPS auto-enabled for in-transit loads'
                  : sharingLocation
                    ? activeLoads.length > 0
                      ? `Sharing GPS for ${activeLoads.length} load${activeLoads.length > 1 ? 's' : ''}`
                      : 'Sharing live GPS'
                    : 'Tap to share your GPS with carrier'}
              </p>
            </div>
          </div>
          <div
            className="w-12 h-7 rounded-full relative transition-colors"
            style={{ background: sharingLocation ? '#22c55e' : 'rgba(255,255,255,0.12)' }}
          >
            <div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
              style={{ transform: sharingLocation ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </div>
        </button>

        {/* Next Step — highest priority active load */}
        {(() => {
          const priorityLoad =
            activeLoads.find((l) => l.status === 'in_transit') ||
            activeLoads.find((l) => l.status === 'dispatched') ||
            activeLoads.find((l) => l.status === 'awarded');
          if (!priorityLoad) return null;

          const config = {
            awarded: {
              label: 'Awaiting Dispatch',
              sub: 'Your carrier is finalizing paperwork. Stand by.',
              color: 'bg-fx-surface border-white/[0.08]',
              textColor: 'text-fx-text-muted',
              btnClass: 'bg-fx-surface-2 text-fx-text-dim border border-white/[0.08]',
            },
            dispatched: {
              label: 'Navigate to Pickup',
              sub: `${priorityLoad.originCity}, ${priorityLoad.originState}`,
              color: 'bg-blue-500/10 border-blue-500/30',
              textColor: 'text-blue-400',
              btnClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
            },
            in_transit: {
              label: 'Deliver & Sign BOL',
              sub: `${priorityLoad.destCity}, ${priorityLoad.destState}`,
              color: 'bg-fx-orange/10 border-fx-orange/30',
              textColor: 'text-fx-orange',
              btnClass: 'bg-fx-orange text-white',
            },
          }[priorityLoad.status as 'awarded' | 'dispatched' | 'in_transit'];

          if (!config) return null;

          return (
            <button
              onClick={() => setSelectedLoad(priorityLoad)}
              className={`w-full text-left p-4 rounded-2xl border mb-1 ${config.color}`}
            >
              <p className="text-[10px] font-bold text-fx-text-dim uppercase tracking-widest mb-1">
                Your Next Step · {priorityLoad.loadNumber}
              </p>
              <p className={`text-[15px] font-bold mb-0.5 ${config.textColor}`}>{config.label}</p>
              <p className="text-[12px] text-fx-text-muted mb-3">{config.sub}</p>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${config.btnClass}`}
              >
                Open Load →
              </span>
            </button>
          );
        })()}

        {/* Waiting on Broker — Delivered loads pending completion */}
        {deliveredLoads.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
                Waiting on Broker
              </h2>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
                {deliveredLoads.length}
              </span>
            </div>
            <div className="space-y-3">
              {deliveredLoads.map((load) => (
                <button
                  key={load.id}
                  onClick={() => setSelectedLoad(load)}
                  className="w-full text-left p-4 rounded-2xl border bg-green-500/[0.06] border-green-500/20"
                  style={{ boxShadow: 'inset 3px 0 0 rgba(34, 197, 94, 0.65)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      DELIVERED
                    </span>
                  </div>
                  <p className="text-sm font-bold text-fx-text">
                    {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                  </p>
                  <p className="text-xs text-fx-text-muted mt-1">
                    Delivered — waiting on broker to mark complete
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div>
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-3">
            My Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Active Loads"
              value={String(
                loads.filter((l) => ['in_transit', 'dispatched', 'awarded'].includes(l.status))
                  .length,
              )}
              trend="flat"
              trendValue="assigned to me"
              icon={<Package size={16} />}
            />
            <StatCard
              label="In Transit"
              value={String(inTransitCount)}
              trend="flat"
              trendValue="currently moving"
              icon={<Clock size={16} />}
              highlight
            />
            <StatCard
              label="Delivered"
              value={String(deliveredCount)}
              trend="up"
              trendValue="completed deliveries"
              icon={<CheckCircle size={16} />}
            />
            <StatCard
              label="Completed"
              value={String(completedCount)}
              trend="up"
              trendValue="fully closed"
              icon={<TrendingDown size={16} />}
            />
          </div>
        </div>

        {/* My Loads */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
              My Loads
            </h2>
            <button
              onClick={() => navigate('/driver/loads')}
              className="text-xs font-semibold text-fx-orange hover:underline"
            >
              View All →
            </button>
          </div>
          <div className="bg-fx-surface border border-fx-border rounded-2xl divide-y divide-fx-border">
            {loads.length === 0 ? (
              <div className="p-6 text-center text-sm text-fx-text-muted">
                No loads assigned yet
              </div>
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
                    {(load.originAddress || load.destAddress) && (
                      <p className="text-[11px] text-fx-text-dim mt-0.5">
                        {load.originAddress && (
                          <span>
                            {load.originAddress}
                            {load.originZip ? ` ${load.originZip}` : ''}
                          </span>
                        )}
                        {load.originAddress && load.destAddress && ' → '}
                        {load.destAddress && (
                          <span>
                            {load.destAddress}
                            {load.destZip ? ` ${load.destZip}` : ''}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-fx-text-muted mt-0.5">
                      {new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {load.status === 'in_transit' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/track/${load.loadNumber}`);
                        }}
                        className="text-[11px] font-semibold text-fx-orange"
                      >
                        Track →
                      </button>
                    )}
                    <span className="text-fx-text-dim">›</span>
                  </div>
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
              // Only show "Send GPS" if user has permission (driver or owner-operator)
              ...(canSendGpsPermission
                ? [
                    {
                      label: 'Send GPS',
                      icon: '📍',
                      action: () => {
                        if (!hasConsented) {
                          setConsentModalOpen(true);
                          return;
                        }
                        setManualGpsToggle(true);
                      },
                    },
                  ]
                : []),
              { label: 'Scan Receipt', icon: '🧾', action: () => navigate('/driver/receipts') },
              { label: 'Tire Log', icon: '🛞', action: () => navigate('/driver/tire-log') },
              { label: 'Messages', icon: '💬', action: () => navigate('/messages') },
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
      </div>

      <BottomNav role="driver" />

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
        role="driver"
      />

      <GpsConsentModal
        open={consentModalOpen}
        onAllow={() => {
          grantConsent();
          setConsentModalOpen(false);
          setManualGpsToggle(true);
        }}
        onDismiss={() => setConsentModalOpen(false)}
      />

      {/* GPS Request from Carrier — prompt driver to share */}
      <GpsConsentModal
        open={gpsRequestModalOpen}
        onAllow={() => {
          grantConsent();
          setGpsRequestModalOpen(false);
          setManualGpsToggle(true);
          // Mark the gps_request notification as read
          const gpsReq = notifications.find((n) => n.type === 'gps_request' && !n.read);
          if (gpsReq) {
            supabase.from('notifications').update({ read: true }).eq('id', gpsReq.id).then();
          }
        }}
        onDismiss={() => {
          setGpsRequestModalOpen(false);
          // Mark as read so we don't keep prompting
          const gpsReq = notifications.find((n) => n.type === 'gps_request' && !n.read);
          if (gpsReq) {
            supabase.from('notifications').update({ read: true }).eq('id', gpsReq.id).then();
          }
        }}
      />
    </div>
  );
}
