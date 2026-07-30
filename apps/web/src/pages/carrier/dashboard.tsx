import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, MapPin, Navigation, UserCheck, TrendingUp, Package } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { ViewSwitcher } from '@/shared/components/view-switcher';
import { useAuth } from '@/contexts/AuthContext';
import { getMyActiveLoads, getLoadById } from '@/services/loads.service';
import { getMyActiveBidsWithLoads } from '@/services/bids.service';
import type { BidWithLoad } from '@/services/bids.service';
import { realtimeSubscribe } from '@/lib/realtime-manager';
import { getBolStatusForLoads } from '@/services/documents.service';
import type { BolStatus } from '@/services/documents.service';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { NotificationSheet } from '@/features/notifications/components/notification-sheet';
import { AssignDriverSheet } from '@/features/loads/components/assign-driver-sheet';
import { LoadDetailSheet } from '@/features/loads/components/load-detail-sheet';

import { EQUIPMENT_LABELS } from '@freightx/shared';
import type { Load } from '@freightx/shared';
import { EmptyState } from '@/shared/components/empty-state';
import { SectionHeader } from '@/shared/components/section-header';

const QUICK_ACTIONS = [
  {
    label: 'Track Load',
    sub: 'Search by load #',
    icon: <Navigation size={20} className="text-fx-orange" />,
    path: '/track',
  },
  {
    label: 'My Fleet',
    sub: 'Trucks & GPS',
    icon: <MapPin size={20} className="text-fx-orange" />,
    path: '/carrier/fleet',
  },
  {
    label: 'Fuel Cards',
    sub: 'Cards & savings',
    icon: <ArrowUpRight size={20} className="text-fx-orange" />,
    path: '/carrier/fuel-cards',
  },
  {
    label: 'Spot Rates',
    sub: 'Market index',
    icon: <TrendingUp size={20} className="text-fx-orange" />,
    path: '/carrier/spot-rates',
  },
];

export default function CarrierDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [bolStatuses, setBolStatuses] = useState<BolStatus[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [assignLoad, setAssignLoad] = useState<Load | null>(null);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [myBids, setMyBids] = useState<BidWithLoad[]>([]);

  const { notifications, unreadCount, markAllRead } = useNotifications();

  const fetchLoads = useCallback(() => {
    if (!user?.id) return;
    getMyActiveLoads(user.id)
      .then((all) => {
        setLoads(all);
        const ids = all.map((l) => l.id);
        if (ids.length > 0) getBolStatusForLoads(ids).then(setBolStatuses).catch(console.error);
      })
      .catch(console.error);
    getMyActiveBidsWithLoads(user.id)
      .then((bids) => {
        // Exclude bids on loads already in myLoads
        setMyBids(bids);
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

  const activeLoads = loads.filter((l) =>
    ['dispatched', 'in_transit', 'awarded'].includes(l.status),
  );
  const awardedLoads = activeLoads.filter((l) => l.status === 'awarded');
  const inProgressLoads = activeLoads.filter((l) => l.status !== 'awarded');
  const deliveredLoads = loads.filter((l) => l.status === 'delivered');

  // Show loads posted in last 7 days, excluding active loads
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLoads = [...loads]
    .filter((l) => {
      if (!l.postedAt) return false;
      const postedDate = new Date(l.postedAt);
      return (
        postedDate >= sevenDaysAgo &&
        !['posted', 'bid_received', 'dispatched', 'in_transit', 'awarded'].includes(l.status)
      );
    })
    .sort((a, b) => {
      const aDate = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const bDate = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 3);

  // Carousel dot tracking
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.scrollWidth / (inProgressLoads.length || 1);
    setActiveSlide(Math.round(scrollLeft / cardWidth));
  }, [inProgressLoads.length]);

  const name = profile?.full_name ?? 'Carrier';

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        greeting
        name={name}
        notificationCount={unreadCount}
        onNotificationClick={() => setNotifsOpen(true)}
      />

      {/* View Switcher */}
      <div className="px-5 pb-4 flex justify-center">
        <ViewSwitcher />
      </div>

      {/* Divider */}
      <div className="mx-5 mb-6 h-px bg-white/[0.05]" />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 space-y-8 pb-2">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="bg-fx-surface border border-white/[0.06] rounded-ios-sm p-4 flex items-center gap-3 active-scale card-highlight text-left transition-colors hover:bg-fx-surface-2"
            >
              <div className="w-10 h-10 rounded-ios-xs bg-fx-orange/15 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{item.label}</p>
                <p className="text-[11px] text-fx-text-dim truncate mt-0.5">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Bidding On — active bids waiting for broker response */}
        {myBids.length > 0 && (
          <div>
            <SectionHeader
              label="Negotiating"
              title="Bidding On"
              badge={
                <span className="text-[11px] font-bold text-white bg-blue-500 px-2.5 py-1 rounded-full">
                  {myBids.length}
                </span>
              }
            />
            <div className="space-y-3">
              {myBids.slice(0, 3).map((bid) => {
                const l = bid.load;
                if (!l) return null;
                const isCountered = bid.status === 'countered';
                return (
                  <button
                    key={bid.id}
                    onClick={async () => {
                      try {
                        const fullLoad = await getLoadById(bid.load_id);
                        if (fullLoad) setSelectedLoad(fullLoad);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`w-full text-left rounded-ios-sm p-4 active-scale transition-colors ${
                      isCountered
                        ? 'bg-blue-500/[0.06] border border-blue-500/20'
                        : 'bg-fx-surface border border-white/[0.06]'
                    }`}
                    style={
                      isCountered ? { boxShadow: 'inset 3px 0 0 rgba(96,165,250,0.65)' } : undefined
                    }
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[11px] text-fx-text-dim">{l.load_number}</p>
                        <p className="text-[15px] font-bold text-white mt-0.5">
                          {l.origin_city} → {l.dest_city}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-bold text-white">
                          ${bid.amount_usd.toLocaleString()}
                        </p>
                        <span
                          className={`text-[10px] font-semibold tracking-[0.06em] uppercase ${
                            isCountered ? 'text-blue-400' : 'text-fx-orange'
                          }`}
                        >
                          {isCountered ? 'Counter Received' : 'Bid Pending'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-fx-text-dim">
                        Ask <span className="font-semibold">${l.rate_usd.toLocaleString()}</span>
                      </p>
                      <p className="text-[11px] font-bold text-blue-400">View Details →</p>
                    </div>
                  </button>
                );
              })}
              {myBids.length > 3 && (
                <button
                  onClick={() => navigate('/carrier/loads')}
                  className="text-xs font-semibold text-fx-orange text-center w-full py-2"
                >
                  +{myBids.length - 3} more — View All →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Required — Awarded loads needing dispatch */}
        {awardedLoads.length > 0 && (
          <div>
            <SectionHeader
              label="Pending"
              title="Action Required"
              badge={
                <span className="text-[11px] font-bold text-amber-900 bg-amber-400 px-2.5 py-1 rounded-full">
                  {awardedLoads.length}
                </span>
              }
            />
            <div className="space-y-3">
              {awardedLoads.map((load) => (
                <button
                  key={load.id}
                  onClick={() => setSelectedLoad(load)}
                  className="w-full text-left bg-amber-500/[0.06] border border-amber-500/20 rounded-ios-sm p-4 active-scale transition-colors"
                  style={{ boxShadow: 'inset 3px 0 0 rgba(251, 191, 36, 0.65)' }}
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
                      <span className="text-[10px] font-semibold text-amber-400 tracking-[0.06em] uppercase">
                        Needs Dispatch
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-fx-text-dim">
                      {load.assignedDriverId ? (
                        <span className="text-green-400 font-semibold">
                          {load.driverName ?? 'Driver assigned'}
                        </span>
                      ) : (
                        <span className="text-amber-400">No driver assigned</span>
                      )}
                    </p>
                    <p className="text-[11px] font-bold text-amber-400">
                      Sign Rate Con &amp; Dispatch →
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Waiting on Broker — Delivered loads pending completion */}
        {deliveredLoads.length > 0 && (
          <div>
            <SectionHeader
              label="Waiting"
              title="Pending Broker Close-Out"
              badge={
                <span className="text-[11px] font-bold text-green-900 bg-green-400 px-2.5 py-1 rounded-full">
                  {deliveredLoads.length}
                </span>
              }
            />
            <div className="space-y-3">
              {deliveredLoads.map((load) => (
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
                      <span className="text-green-400 font-semibold">
                        Waiting on broker to complete
                      </span>
                    </p>
                    <p className="text-[11px] font-bold text-green-400">View Details →</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Shipping — Carousel */}
        {inProgressLoads.length > 0 && (
          <div>
            <SectionHeader
              label="Live"
              title="Current Shipping"
              badge={
                <span className="text-[11px] font-semibold text-white bg-fx-orange px-2.5 py-1 rounded-full">
                  {inProgressLoads.length} Active
                </span>
              }
            />

            <div
              ref={inProgressLoads.length > 1 ? carouselRef : undefined}
              onScroll={inProgressLoads.length > 1 ? handleScroll : undefined}
              className={
                inProgressLoads.length > 1
                  ? 'flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 -mx-5 px-5'
                  : 'space-y-3'
              }
            >
              {inProgressLoads.map((currentLoad) => (
                <button
                  key={currentLoad.id}
                  onClick={() => setSelectedLoad(currentLoad)}
                  className={`${inProgressLoads.length > 1 ? 'min-w-[85%] snap-center shrink-0' : 'w-full'} bg-fx-surface border border-white/[0.06] rounded-ios p-5 card-highlight text-left active-scale transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-fx-text-dim">
                      ID {currentLoad.loadNumber}
                    </p>
                    {currentLoad.assignedDriverId && (
                      <span className="text-[11px] font-semibold text-green-400">
                        {currentLoad.driverName ?? 'Driver assigned'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 mb-4">
                    <span className="text-[11px] font-bold text-fx-orange bg-fx-orange/15 px-2 py-0.5 rounded-full">
                      {EQUIPMENT_LABELS[currentLoad.equipment] ?? currentLoad.equipment}
                    </span>
                    {currentLoad.weightLbs > 0 && (
                      <span className="text-[11px] text-fx-text-dim">
                        {currentLoad.weightLbs.toLocaleString()} lbs
                      </span>
                    )}
                    <span className="text-[11px] text-fx-text-dim">
                      ${currentLoad.rateUsd.toLocaleString()}
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="relative mb-4">
                    <div className="w-full h-[3px] bg-fx-border rounded-full" />
                    <div
                      className="absolute left-0 top-0 h-[3px] rounded-full bg-orange-gradient"
                      style={{
                        width:
                          currentLoad.status === 'in_transit'
                            ? '75%'
                            : currentLoad.status === 'dispatched'
                              ? '50%'
                              : '25%',
                      }}
                    />
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-orange-gradient ring-2 ring-fx-bg" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-orange-gradient ring-2 ring-fx-bg shadow-orange-glow-sm"
                      style={{
                        left:
                          currentLoad.status === 'in_transit'
                            ? '75%'
                            : currentLoad.status === 'dispatched'
                              ? '50%'
                              : '25%',
                      }}
                    />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-fx-border ring-2 ring-fx-bg" />
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-fx-text-dim">
                        {new Date(currentLoad.pickupDate + 'T12:00:00').toLocaleDateString(
                          'en-US',
                          {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          },
                        )}
                      </p>
                      <p className="text-[15px] font-bold text-white mt-0.5 tracking-[-0.01em]">
                        {currentLoad.originCity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-fx-text-dim">
                        Estimated{' '}
                        {new Date(currentLoad.deliveryDate + 'T12:00:00').toLocaleDateString(
                          'en-US',
                          {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          },
                        )}
                      </p>
                      <p className="text-[15px] font-bold text-white mt-0.5 tracking-[-0.01em]">
                        {currentLoad.destCity}
                      </p>
                    </div>
                  </div>

                  {/* Assign Driver button */}
                  {['awarded', 'dispatched'].includes(currentLoad.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setAssignLoad(currentLoad);
                      }}
                      className="mt-4 w-full h-10 rounded-xl border border-fx-orange/30 text-fx-orange text-xs font-semibold flex items-center justify-center gap-2 hover:bg-fx-orange/10 transition-colors"
                    >
                      <UserCheck size={14} />
                      {currentLoad.assignedDriverId ? 'Reassign Driver' : 'Assign Driver'}
                    </button>
                  )}
                </button>
              ))}
            </div>

            {/* Dot indicators */}
            {inProgressLoads.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {inProgressLoads.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeSlide ? 'w-4 bg-fx-orange' : 'w-1.5 bg-fx-border'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Loads */}
        {loads.length > 0 && (
          <div>
            <SectionHeader
              label="Last 7 Days"
              title="Recent Loads"
              action={
                recentLoads.length > 0 ? (
                  <button
                    onClick={() => navigate('/carrier/loads?filter=recent')}
                    className="text-[13px] font-semibold text-fx-orange flex items-center gap-1"
                  >
                    See All <ArrowUpRight size={13} />
                  </button>
                ) : undefined
              }
            />

            {recentLoads.length === 0 ? (
              <EmptyState
                icon={<Package size={28} className="text-fx-text-dim" />}
                title="No loads in the last 7 days"
                subtitle="Browse the load board to find opportunities"
              />
            ) : (
              <div className="space-y-3">
                {recentLoads.map((load, i) => {
                  const bol = bolStatuses.find((b) => b.loadId === load.id);
                  const showBolBadge = ['dispatched', 'in_transit'].includes(load.status);

                  return (
                    <button
                      key={load.id}
                      onClick={() => setSelectedLoad(load)}
                      className="relative w-full bg-orange-gradient rounded-ios p-5 card-orange-highlight text-left active-scale overflow-hidden grain"
                      style={{
                        filter:
                          i === 1 ? 'brightness(0.91)' : i === 2 ? 'brightness(0.82)' : 'none',
                      }}
                    >
                      <p
                        className="text-[34px] font-black text-white leading-none mb-1"
                        style={{ letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {load.loadNumber}
                      </p>
                      <p className="text-[10px] text-white/40 font-semibold mb-3 tracking-[0.08em] uppercase">
                        {load.commodity}
                        {load.totalMiles ? <span className="text-white/25 mx-1.5">·</span> : null}
                        {load.totalMiles ? `${load.totalMiles} mi` : null}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] text-white/80 font-semibold">
                          {load.originCity} → {load.destCity}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {showBolBadge && bol && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                bol.signed
                                  ? 'bg-green-500/30 text-green-200'
                                  : bol.hasBol
                                    ? 'bg-orange-400/30 text-orange-200'
                                    : 'bg-white/15 text-white/60'
                              }`}
                            >
                              {bol.signed ? 'BOL Signed' : bol.hasBol ? 'BOL Pending' : 'No BOL'}
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-white bg-black/25 px-2.5 py-1 rounded-full">
                            {load.status === 'delivered'
                              ? 'Delivered'
                              : load.status === 'completed'
                                ? 'Completed'
                                : load.status === 'in_transit'
                                  ? 'In Transit'
                                  : load.status === 'dispatched'
                                    ? 'Dispatched'
                                    : load.status === 'awarded'
                                      ? 'Awarded'
                                      : load.status === 'bid_received'
                                        ? 'Bid Received'
                                        : 'Posted'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {loads.length === 0 && (
          <EmptyState
            icon={<Navigation size={28} className="text-fx-text-dim" />}
            title="No active loads"
            subtitle="Browse the load board to get started"
            action={
              <button
                onClick={() => navigate('/carrier/loads')}
                className="text-sm font-semibold text-fx-orange border border-fx-orange/30 px-5 py-2 rounded-xl hover:bg-fx-orange/10 transition-colors"
              >
                Browse Load Board
              </button>
            }
          />
        )}
      </div>

      <BottomNav role="carrier" />

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
        onClose={() => setSelectedLoad(null)}
        showBidButton={false}
        role="carrier"
      />

      {assignLoad && (
        <AssignDriverSheet
          open={!!assignLoad}
          onClose={() => setAssignLoad(null)}
          load={assignLoad}
          onAssigned={() => {
            setAssignLoad(null);
            if (user?.id) getMyActiveLoads(user.id).then(setLoads).catch(console.error);
          }}
        />
      )}
    </div>
  );
}
