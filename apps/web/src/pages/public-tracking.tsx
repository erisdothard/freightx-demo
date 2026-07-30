import { useState, useEffect, useMemo } from 'react';
import { MapPin, Navigation, Package } from 'lucide-react';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';
import { MapView } from '@/shared/components/map-view';
import { useParams } from 'react-router-dom';
import { getLoadByToken } from '@/services/tracking-tokens.service';
import { useLiveTracking } from '@/features/loads/hooks/use-live-tracking';
import { getTrackingMilestones } from '@/services/loads.service';
import type { Load, TrackingMilestone } from '@freightx/shared';

export default function PublicTrackingPage() {
  const { token } = useParams();
  const [load, setLoad] = useState<Load | null>(null);
  const [milestones, setMilestones] = useState<TrackingMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadNumber, setLoadNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getLoadByToken(token)
      .then(async (result) => {
        if (!result) {
          setError('This tracking link is invalid or has expired.');
          return;
        }
        setLoadNumber(result.loadNumber);
        setLoad(result.load);
        if (result.load) {
          const ms = await getTrackingMilestones(result.loadNumber);
          setMilestones(ms);
        }
      })
      .catch(() => setError('Failed to load tracking info.'))
      .finally(() => setLoading(false));
  }, [token]);

  const completedCount = milestones.filter((m) => m.completed).length;
  const progress = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0;

  const GPS_TERMINAL = new Set([
    'delivered',
    'cancelled',
    'tonu',
    'rejected',
    'draft',
    'pending_approval',
  ]);
  const gpsEligible = !!load && !GPS_TERMINAL.has(load.status);

  const livePing = useLiveTracking(loadNumber);
  const livePosition: [number, number] | undefined = livePing
    ? [livePing.latitude, livePing.longitude]
    : undefined;
  const heading = livePing?.heading_deg ?? undefined;

  // Staleness
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const { agoLabel, isStale } = useMemo(() => {
    if (!livePing?.recorded_at) return { agoLabel: null, isStale: false };
    const diffS = Math.floor((now - new Date(livePing.recorded_at).getTime()) / 1000);
    if (diffS < 60) return { agoLabel: 'just now', isStale: false };
    const diffM = Math.floor(diffS / 60);
    const stale = diffM >= 2;
    if (diffM < 60) return { agoLabel: `${diffM}m ago`, isStale: stale };
    const diffH = Math.floor(diffM / 60);
    return { agoLabel: `${diffH}h ${diffM % 60}m ago`, isStale: true };
  }, [livePing?.recorded_at, now]);

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#0a0a12' }}>
      {/* Header */}
      <div className="px-5 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(145deg, #F07040, #C03A12)' }}
          >
            <span className="text-sm font-bold text-white">FX</span>
          </div>
          <div>
            <p className="text-[17px] font-bold text-white tracking-[-0.01em]">FreightX Tracking</p>
            <p className="text-[11px] text-fx-text-dim">Public tracking link</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-8">
        {loading && <SkeletonList count={3} />}

        {error && (
          <EmptyState
            icon={<Navigation size={28} className="text-fx-text-dim" />}
            title="Link Expired"
            subtitle={error}
          />
        )}

        {load && (
          <>
            {/* Load info */}
            <div className="bg-fx-surface rounded-ios p-5 card-highlight">
              <div className="flex items-center gap-2 mb-3">
                <Package size={16} className="text-fx-orange" />
                <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <p className="text-[11px] text-fx-text-dim font-medium mb-0.5 uppercase tracking-wide">
                    From
                  </p>
                  <p className="text-[14px] font-semibold text-white">
                    {load.originCity}, {load.originState}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fx-text-dim font-medium mb-0.5 uppercase tracking-wide">
                    To
                  </p>
                  <p className="text-[14px] font-semibold text-white">
                    {load.destCity}, {load.destState}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fx-text-dim font-medium mb-0.5 uppercase tracking-wide">
                    Status
                  </p>
                  <p className="text-[14px] font-semibold text-fx-orange">
                    {load.status === 'in_transit'
                      ? 'In Transit'
                      : load.status === 'delivered'
                        ? 'Delivered'
                        : load.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fx-text-dim font-medium mb-0.5 uppercase tracking-wide">
                    Delivery
                  </p>
                  <p className="text-[14px] font-semibold text-white">
                    {new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-fx-surface rounded-ios p-4 card-highlight">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">Live Tracking</p>
                {gpsEligible && livePosition && !isStale && (
                  <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Live {agoLabel && `· ${agoLabel}`}
                  </span>
                )}
                {gpsEligible && livePosition && isStale && (
                  <span className="text-xs text-yellow-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full" />
                    Stale · {agoLabel}
                  </span>
                )}
                {gpsEligible && !livePosition && (
                  <span className="text-xs text-fx-text-dim font-medium">Awaiting GPS</span>
                )}
              </div>
              <MapView
                origin={{ city: load.originCity, state: load.originState }}
                destination={{ city: load.destCity, state: load.destState }}
                originAddress={gpsEligible ? (load.originAddress ?? undefined) : undefined}
                destAddress={gpsEligible ? (load.destAddress ?? undefined) : undefined}
                progress={progress}
                inTransit={gpsEligible}
                livePosition={livePosition}
                heading={heading}
                className="h-48"
              />
              <div className="flex items-center justify-between text-xs mt-3">
                <div className="flex items-center gap-1">
                  <MapPin size={12} className="text-green-400" />
                  <span className="text-fx-text-dim">
                    Pickup: {new Date(load.pickupDate + 'T12:00:00').toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Navigation size={12} className="text-fx-orange" />
                  <span className="text-fx-text-dim">
                    Delivery: {new Date(load.deliveryDate + 'T12:00:00').toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Milestones */}
            {milestones.length > 0 && (
              <div className="bg-fx-surface rounded-ios overflow-hidden card-highlight">
                <div
                  className="px-5 py-3.5 text-center"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-[14px] font-semibold text-white">Shipment Progress</p>
                </div>
                {milestones.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between px-5 py-4"
                    style={
                      i < milestones.length - 1
                        ? { borderBottom: '1px solid rgba(255,255,255,0.05)' }
                        : {}
                    }
                  >
                    <div className="flex-1">
                      <p
                        className={`text-[14px] font-semibold ${m.current ? 'text-fx-orange' : m.completed ? 'text-white' : 'text-fx-text-dim'}`}
                      >
                        {m.label}
                      </p>
                      <p className="text-[12px] text-fx-text-dim mt-0.5">{m.location}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p
                        className={`text-[14px] font-bold ${m.current || m.completed ? 'text-fx-orange' : 'text-fx-text-dim'}`}
                      >
                        {m.timestamp?.split('·')[1]?.trim() ?? '—'}
                      </p>
                      <p className="text-[11px] text-fx-text-dim mt-0.5">
                        {m.timestamp?.split('·')[0]?.trim()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="text-center py-4">
              <p className="text-[11px] text-fx-text-dim">
                Powered by <span className="text-fx-orange font-semibold">FreightX</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
