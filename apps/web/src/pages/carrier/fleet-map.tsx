import { useState, useEffect, useRef } from 'react';
import MapGL, { Marker, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Navigation, Radio, Truck, Users, Loader2, MapPin, Send } from 'lucide-react';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { Badge } from '@/shared/components/ui/badge';
import { MapView } from '@/shared/components/map-view';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMyActiveLoads, getCompanyDrivers } from '@/services/loads.service';
import { useLiveTracking, type LivePing } from '@/features/loads/hooks/use-live-tracking';
import type { Load } from '@freightx/shared';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// CONUS center fallback
const DEFAULT_VIEW = { longitude: -98.5795, latitude: 39.8283, zoom: 3.8 };

/* ── Types ──────────────────────────────────────────────────────── */

interface DriverProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

type BatchPing = LivePing & { load_number: string | null; driver_id: string };

/* ── Live GPS map pin ────────────────────────────────────────────── */

function LiveDriverPin({
  heading,
  name,
  onLoad,
}: {
  heading: number | null;
  name: string;
  onLoad?: boolean;
}) {
  const color = onLoad ? '#e86030' : '#3b82f6'; // orange = in-transit, blue = manual GPS
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ position: 'relative', width: 44, height: 44, cursor: 'pointer' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          animation: 'fx-pulse-ring 1.8s ease-out infinite',
          pointerEvents: 'none',
        }}
      />
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        {heading != null && (
          <path
            d="M22 22 L16 8 L28 8 Z"
            fill={color}
            opacity="0.65"
            transform={`rotate(${heading}, 22, 22)`}
          />
        )}
        <circle cx="22" cy="22" r="16" fill={color} stroke="white" strokeWidth="2.5" />
        <text
          x="22"
          y="27"
          textAnchor="middle"
          fill="white"
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {initials}
        </text>
      </svg>
    </div>
  );
}

/* ── Status badge config ─────────────────────────────────────────── */

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'orange' | 'blue' | 'green' | 'gray' }
> = {
  in_transit: { label: 'In Transit', variant: 'orange' },
  dispatched: { label: 'Dispatched', variant: 'blue' },
  awarded: { label: 'Awarded', variant: 'blue' },
  delivered: { label: 'Delivered', variant: 'green' },
  completed: { label: 'Completed', variant: 'gray' },
};

const DONE_STATUSES = new Set(['delivered', 'completed']);

/* ── Active load row (used inside detail sheet) ─────────────────── */

function ActiveLoadRow({ load }: { load: Load }) {
  const isDone = DONE_STATUSES.has(load.status);
  const ping = useLiveTracking(isDone ? null : load.loadNumber);
  const speedMph = ping?.speed_ms != null ? Math.round(ping.speed_ms * 2.237) : null;
  const lastPing = ping?.recorded_at
    ? new Date(ping.recorded_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const badge = STATUS_BADGE[load.status];

  return (
    <div
      className={`bg-fx-surface-2 border border-fx-border rounded-xl p-3 space-y-2${isDone ? ' opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-fx-orange">{load.loadNumber}</span>
          {badge && (
            <Badge variant={badge.variant} className="text-[9px] px-1.5 py-0">
              {badge.label}
            </Badge>
          )}
        </div>
        {!isDone &&
          (ping ? (
            <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live GPS
            </span>
          ) : (
            <span className="text-[10px] text-fx-text-dim flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-fx-text-dim rounded-full" />
              No GPS
            </span>
          ))}
      </div>
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-fx-orange shrink-0" />
        <p className="text-xs text-fx-text-muted truncate">
          {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
        </p>
      </div>
      {!isDone && ping && (
        <div className="flex items-center gap-3 text-[11px] text-fx-text-dim">
          {speedMph != null && (
            <span className="flex items-center gap-1">
              <Navigation size={10} className="text-fx-orange" />
              {speedMph} mph
            </span>
          )}
          {lastPing && <span>Last: {lastPing}</span>}
          <span className="ml-auto text-green-400 flex items-center gap-1">
            <Radio size={10} /> Tracking
          </span>
        </div>
      )}
    </div>
  );
}

/* ── GPS mini-map inside detail sheet ───────────────────────────── */

function DriverGpsMap({ load }: { load: Load }) {
  const ping = useLiveTracking(load.loadNumber);
  const speedMph = ping?.speed_ms != null ? Math.round(ping.speed_ms * 2.237) : null;
  const lastPing = ping?.recorded_at
    ? new Date(ping.recorded_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const livePos: [number, number] | undefined = ping ? [ping.latitude, ping.longitude] : undefined;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest">
        Live Location — {load.loadNumber}
      </p>
      <MapView
        origin={{ city: load.originCity ?? '', state: load.originState ?? '' }}
        destination={{ city: load.destCity ?? '', state: load.destState ?? '' }}
        inTransit
        livePosition={livePos}
        heading={ping?.heading_deg}
        className="h-52 rounded-2xl"
      />
      {ping && (
        <div className="flex items-center gap-4 text-xs text-fx-text-dim">
          {speedMph != null && (
            <span className="flex items-center gap-1">
              <Navigation size={12} className="text-fx-orange" />
              {speedMph} mph
            </span>
          )}
          {lastPing && <span>Last ping: {lastPing}</span>}
          <span className="ml-auto text-green-400 flex items-center gap-1">
            <Radio size={12} /> Live
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Driver detail bottom sheet ─────────────────────────────────── */

function DriverDetailSheet({
  driver,
  loads,
  ping,
  open,
  onClose,
  onRequestGps,
}: {
  driver: DriverProfile | null;
  loads: Load[];
  ping: BatchPing | null;
  open: boolean;
  onClose: () => void;
  onRequestGps: (driverId: string) => void;
}) {
  if (!driver) return null;

  const name = driver.full_name ?? driver.email ?? 'Unknown';
  const driverLoads = loads.filter(
    (l) => l.assignedDriverId === driver.id || l.secondDriverId === driver.id,
  );
  const activeLoad = driverLoads.find((l) => l.status === 'in_transit');
  const hasGps = !!ping;

  return (
    <BottomSheet open={open} onClose={onClose} title="Driver Details">
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
            <span className="text-lg font-extrabold text-fx-orange">
              {name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-fx-text">{name}</p>
            {driver.email && <p className="text-xs text-fx-text-dim">{driver.email}</p>}
          </div>
          <Badge variant={activeLoad ? 'orange' : hasGps ? 'blue' : 'green'}>
            {activeLoad ? 'In Transit' : hasGps ? 'GPS On' : 'Available'}
          </Badge>
        </div>

        {/* Request GPS button — shown when driver has no active GPS */}
        {!hasGps && (
          <button
            onClick={() => onRequestGps(driver.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-fx-orange/10 border border-fx-orange/30 text-fx-orange text-sm font-bold active:bg-fx-orange/20 transition-colors"
          >
            <Send size={14} />
            Request GPS
          </button>
        )}

        {activeLoad && <DriverGpsMap load={activeLoad} />}

        {driverLoads.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold text-fx-text-muted uppercase tracking-widest mb-2">
              Assigned Loads ({driverLoads.length})
            </p>
            <div className="space-y-2">
              {[...driverLoads]
                .sort((a, b) => {
                  const p: Record<string, number> = {
                    in_transit: 0,
                    dispatched: 1,
                    awarded: 2,
                    delivered: 3,
                    completed: 4,
                  };
                  return (p[a.status] ?? 5) - (p[b.status] ?? 5);
                })
                .map((load) => (
                  <ActiveLoadRow key={load.id} load={load} />
                ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Truck size={28} className="text-fx-text-dim mx-auto mb-2" />
            <p className="text-sm text-fx-text-muted">No loads assigned</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/* ── Driver roster card ─────────────────────────────────────────── */

function DriverRosterCard({
  driver,
  loads,
  ping,
  onLoad,
  onTap,
}: {
  driver: DriverProfile;
  loads: Load[];
  ping: BatchPing | null;
  onLoad: boolean;
  onTap: () => void;
}) {
  const name = driver.full_name ?? driver.email ?? 'Unknown';
  const driverLoads = loads.filter(
    (l) => l.assignedDriverId === driver.id || l.secondDriverId === driver.id,
  );
  const activeLoad = driverLoads.find((l) => l.status === 'in_transit');
  const speedMph = ping?.speed_ms != null ? Math.round(ping.speed_ms * 2.237) : null;

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-fx-surface border border-fx-border rounded-2xl p-3 flex items-center gap-3 active:bg-fx-surface-2 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
        <span className="text-sm font-extrabold text-fx-orange">
          {name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-fx-text truncate">{name}</p>
        {activeLoad ? (
          <p className="text-[11px] text-fx-text-dim truncate">
            {activeLoad.originCity} → {activeLoad.destCity}
            {speedMph != null && ` · ${speedMph} mph`}
          </p>
        ) : ping ? (
          <p className="text-[11px] text-fx-text-dim">
            Sharing GPS{speedMph != null ? ` · ${speedMph} mph` : ''}
          </p>
        ) : (
          <p className="text-[11px] text-fx-text-dim">
            {driverLoads.length} load{driverLoads.length !== 1 ? 's' : ''} assigned
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant={activeLoad ? 'orange' : ping ? 'blue' : 'green'}>
          {activeLoad ? 'In Transit' : ping ? 'GPS On' : 'Available'}
        </Badge>
        <span
          className={`text-[10px] font-semibold flex items-center gap-1 ${
            ping ? 'text-green-400' : 'text-fx-text-dim'
          }`}
        >
          {ping ? (
            <>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              {onLoad ? 'GPS Live' : 'Sharing'}
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 bg-fx-text-dim rounded-full" />
              No GPS
            </>
          )}
        </span>
      </div>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */

export default function CarrierFleetMapPage() {
  const { company, user } = useAuth();
  const mapRef = useRef<MapRef>(null);

  const [loads, setLoads] = useState<Load[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  // Keyed by driver_id — shows GPS from any source (in-transit, manual share, idle)
  const [pings, setPings] = useState<Map<string, BatchPing>>(new Map());
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const companyId = company?.id;
  const inTransitCount = loads.filter((l) => l.status === 'in_transit').length;

  /* ── Initial data fetch ─────────────────────────────────────── */

  useEffect(() => {
    if (!companyId || !user?.id) {
      setLoading(false);
      return;
    }

    Promise.all([
      getMyActiveLoads(user.id).catch(() => [] as Load[]),
      getCompanyDrivers(companyId).catch(
        () => [] as Array<{ id: string; fullName: string; email: string }>,
      ),
    ])
      .then(async ([l, companyDrivers]) => {
        setLoads(l);

        const driverMap = new Map<string, DriverProfile>();
        for (const d of companyDrivers) {
          driverMap.set(d.id, {
            id: d.id,
            full_name: d.fullName,
            email: d.email,
            avatar_url: null,
          });
        }

        // Include any drivers assigned to loads but not in company roster
        const assignedIds = [
          ...new Set([
            ...(l.map((load) => load.assignedDriverId).filter(Boolean) as string[]),
            ...(l.map((load) => load.secondDriverId).filter(Boolean) as string[]),
          ]),
        ].filter((id) => !driverMap.has(id));

        if (assignedIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', assignedIds);
          for (const p of (profiles as DriverProfile[]) ?? []) {
            driverMap.set(p.id, p);
          }
        }

        const allDrivers = [...driverMap.values()];
        setDriverProfiles(allDrivers);

        // Batch-fetch latest GPS ping for ALL company drivers (not just in-transit)
        const allDriverIds = allDrivers.map((d) => d.id);

        if (allDriverIds.length > 0) {
          const { data: latestPings } = await supabase
            .from('location_pings')
            .select(
              'driver_id,load_number,latitude,longitude,heading_deg,speed_ms,accuracy_m,recorded_at',
            )
            .in('driver_id', allDriverIds)
            .order('recorded_at', { ascending: false });

          if (latestPings) {
            // Keyed by driver_id — keep the most recent ping per driver
            const pingMap = new Map<string, BatchPing>();
            // Ignore pings older than 30 minutes
            const staleThreshold = Date.now() - 30 * 60 * 1000;
            for (const p of latestPings as BatchPing[]) {
              if (!pingMap.has(p.driver_id) && new Date(p.recorded_at).getTime() > staleThreshold) {
                pingMap.set(p.driver_id, p);
              }
            }
            setPings(pingMap);
          }
        }
      })
      .catch((err) => console.error('Failed to load fleet:', err))
      .finally(() => setLoading(false));
  }, [companyId, user?.id]);

  /* ── Live GPS subscription for all company drivers ────────── */

  useEffect(() => {
    if (driverProfiles.length === 0) return;

    const driverIdSet = new Set(driverProfiles.map((d) => d.id));

    const channel = supabase
      .channel('fleet_live_tracking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'location_pings' },
        (payload) => {
          const row = payload.new as BatchPing;
          if (driverIdSet.has(row.driver_id)) {
            setPings((prev) => new Map(prev).set(row.driver_id, row));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverProfiles]);

  /* ── Map helpers ────────────────────────────────────────────── */

  function fitToAllDrivers() {
    if (!mapRef.current || pings.size === 0) return;
    const positions = [...pings.values()];
    if (positions.length === 1) {
      mapRef.current.flyTo({
        center: [positions[0].longitude, positions[0].latitude],
        zoom: 10,
        duration: 800,
      });
      return;
    }
    const lngs = positions.map((p) => p.longitude);
    const lats = positions.map((p) => p.latitude);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, duration: 800, maxZoom: 12 },
    );
  }

  // Auto-fit map once both map and pings are ready
  useEffect(() => {
    if (mapLoaded && pings.size > 0) {
      fitToAllDrivers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, pings.size]);

  function getDriverPing(driver: DriverProfile): BatchPing | null {
    return pings.get(driver.id) ?? null;
  }

  /** Check if driver has an in-transit load (for marker differentiation) */
  function isDriverOnLoad(driver: DriverProfile): boolean {
    return loads.some(
      (l) =>
        (l.assignedDriverId === driver.id || l.secondDriverId === driver.id) &&
        l.status === 'in_transit',
    );
  }

  const [gpsRequestSent, setGpsRequestSent] = useState<Set<string>>(new Set());

  async function handleRequestGps(driverId: string) {
    if (gpsRequestSent.has(driverId)) return;
    try {
      await supabase.rpc('send_notification', {
        p_user_id: driverId,
        p_type: 'gps_request',
        p_title: 'GPS Sharing Requested',
        p_body: `${company?.name ?? 'Your carrier'} is requesting your live location.`,
      });
      setGpsRequestSent((prev) => new Set(prev).add(driverId));
    } catch (err) {
      console.error('Failed to send GPS request:', err);
    }
  }

  const navRole = 'carrier' as const;

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Fleet Map" />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="text-fx-orange animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Live map ──────────────────────────────────────── */}
          <div className="relative" style={{ height: 'calc(56vh - 56px)' }}>
            <MapGL
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              initialViewState={DEFAULT_VIEW}
              scrollZoom
              dragPan
              attributionControl={false}
              logoPosition="top-right"
              onLoad={() => setMapLoaded(true)}
              style={{ height: '100%', width: '100%' }}
            >
              {driverProfiles.map((driver) => {
                const ping = getDriverPing(driver);
                if (!ping) return null;
                const name = driver.full_name ?? driver.email ?? 'Unknown';
                const onLoad = isDriverOnLoad(driver);
                return (
                  <Marker
                    key={driver.id}
                    longitude={ping.longitude}
                    latitude={ping.latitude}
                    anchor="center"
                    onClick={() => setSelectedDriver(driver)}
                  >
                    <LiveDriverPin heading={ping.heading_deg} name={name} onLoad={onLoad} />
                  </Marker>
                );
              })}
            </MapGL>

            {/* GPS count badge */}
            {pings.size > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(14,14,22,0.72)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  padding: '4px 10px',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 6px #22c55e',
                    display: 'inline-block',
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '0.06em',
                  }}
                >
                  {pings.size} SHARING GPS
                  {inTransitCount > 0 && ` · ${inTransitCount} IN TRANSIT`}
                </span>
              </div>
            )}

            {/* Fit-all button */}
            {pings.size > 0 && (
              <button
                onClick={fitToAllDrivers}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(14,14,22,0.72)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 20,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '0.04em',
                  }}
                >
                  FIT ALL
                </span>
              </button>
            )}

            {/* Empty map state */}
            {pings.size === 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    background: 'rgba(14,14,22,0.72)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '10px 18px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.5)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    No drivers sharing GPS
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Driver roster ────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-3 pb-2 flex items-center gap-2">
              <Users size={15} className="text-fx-text-muted" />
              <span className="text-sm font-bold text-fx-text">
                {driverProfiles.length} Driver{driverProfiles.length !== 1 ? 's' : ''}
              </span>
              {pings.size > 0 && (
                <span className="text-[11px] text-fx-orange font-semibold">
                  · {pings.size} sharing GPS
                </span>
              )}
              {pings.size === 0 && driverProfiles.length > 0 && (
                <span className="ml-auto text-[11px] text-fx-text-dim">No GPS signals</span>
              )}
            </div>

            <div className="px-4 pb-4 space-y-2">
              {driverProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Truck size={36} className="text-fx-text-dim mb-3" />
                  <p className="font-bold text-fx-text">No drivers on your team</p>
                  <p className="text-sm text-fx-text-muted mt-1">
                    Go to Profile → Team Members to invite drivers
                  </p>
                </div>
              ) : (
                [...driverProfiles]
                  .sort((a, b) => {
                    // Sort: in-transit first, then GPS-sharing, then offline
                    const aOnLoad = isDriverOnLoad(a);
                    const bOnLoad = isDriverOnLoad(b);
                    if (aOnLoad !== bOnLoad) return Number(bOnLoad) - Number(aOnLoad);
                    const aGps = pings.has(a.id);
                    const bGps = pings.has(b.id);
                    return Number(bGps) - Number(aGps);
                  })
                  .map((driver) => (
                    <DriverRosterCard
                      key={driver.id}
                      driver={driver}
                      loads={loads}
                      ping={getDriverPing(driver)}
                      onLoad={isDriverOnLoad(driver)}
                      onTap={() => setSelectedDriver(driver)}
                    />
                  ))
              )}
            </div>
          </div>

          <DriverDetailSheet
            driver={selectedDriver}
            loads={loads}
            ping={selectedDriver ? getDriverPing(selectedDriver) : null}
            open={!!selectedDriver}
            onClose={() => setSelectedDriver(null)}
            onRequestGps={handleRequestGps}
          />
        </>
      )}

      <BottomNav role={navRole} />
    </div>
  );
}
