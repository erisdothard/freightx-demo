import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeCity } from '@/lib/geocoding';

// ── Apple-style truck pins with pulse for available trucks ────────────────────

function makePinIcon(status: string) {
  const isAvailable = status === 'available';
  const isBooked = status === 'booked';
  const color = isAvailable ? '#22c55e' : isBooked ? '#e86030' : '#6b7280';
  const pulse = isAvailable
    ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};` +
      `animation:fx-pulse-ring 2s ease-out infinite;pointer-events:none;z-index:0"></div>`
    : '';

  return L.divIcon({
    className: '',
    html:
      `<div style="position:relative;width:26px;height:26px">` +
      pulse +
      `<div style="position:relative;z-index:1;width:26px;height:26px;background:${color};` +
      `border-radius:50%;border:2.5px solid rgba(255,255,255,0.9);` +
      `box-shadow:0 3px 12px rgba(0,0,0,0.5),0 0 0 1px ${color}40;` +
      `display:flex;align-items:center;justify-content:center;font-size:11px">🚛</div>` +
      `</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// ── Auto-fit all pins ─────────────────────────────────────────────────────────

function FitAll({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) map.setView(positions[0], 9, { animate: true });
    else map.fitBounds(L.latLngBounds(positions), { padding: [44, 44], animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(positions)]);
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TruckPin {
  id: string;
  city: string;
  state: string;
  equipment: string;
  status: string;
}

interface FleetMapProps {
  trucks: TruckPin[];
  className?: string;
}

// ── FleetMap ──────────────────────────────────────────────────────────────────

export function FleetMap({ trucks, className = 'h-44' }: FleetMapProps) {
  const [pins, setPins] = useState<Array<{ truck: TruckPin; pos: [number, number] }>>([]);
  const [loading, setLoading] = useState(true);

  const locationKey = trucks.map((t) => `${t.city},${t.state}`).join('|');

  useEffect(() => {
    if (trucks.length === 0) {
      setPins([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const results: Array<{ truck: TruckPin; pos: [number, number] }> = [];
      for (let i = 0; i < trucks.length; i++) {
        if (cancelled) return;
        const truck = trucks[i]!;
        const pos = await geocodeCity(truck.city, truck.state);
        if (pos) results.push({ truck, pos });
        // Nominatim rate limit: 1 req/s
        if (i < trucks.length - 1 && !cancelled) {
          await new Promise<void>((r) => setTimeout(r, 350));
        }
      }
      if (!cancelled) {
        setPins(results);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (trucks.length === 0) return null;

  if (loading) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl ${className}`}
        style={{ background: '#181820' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'map-shimmer 1.6s ease-in-out infinite',
          }}
        />
        <style>{`@keyframes map-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-5 h-5 border-2 border-white/10 border-t-fx-orange rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (pins.length === 0) return null;

  const positions = pins.map((p) => p.pos);

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <MapContainer
        center={positions[0]}
        zoom={5}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging
        style={{ height: '100%', width: '100%' }}
      >
        {/* Stadia Alidade Smooth Dark — Apple Maps aesthetic, free */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        <FitAll positions={positions} />

        {pins.map(({ truck, pos }) => (
          <Marker key={truck.id} position={pos} icon={makePinIcon(truck.status)}>
            <Tooltip direction="top" offset={[0, -14]}>
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>
                  {truck.city}, {truck.state}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                  {truck.equipment} ·{' '}
                  <span
                    style={{
                      color:
                        truck.status === 'available'
                          ? '#22c55e'
                          : truck.status === 'booked'
                            ? '#e86030'
                            : '#9ca3af',
                    }}
                  >
                    {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
                  </span>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Truck count badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(14,14,22,0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '4px 10px',
        }}
      >
        <span style={{ fontSize: 13 }}>🚛</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {pins.length} truck{pins.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Attribution */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 6,
          zIndex: 1000,
          fontSize: 9,
          color: 'rgba(255,255,255,0.22)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        © Stadia · OSM
      </div>
    </div>
  );
}
