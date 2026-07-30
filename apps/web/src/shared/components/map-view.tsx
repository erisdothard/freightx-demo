import { useEffect, useRef, useState } from 'react';
import Map, { Marker, Source, Layer, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { geocodeCity, geocodeAddress } from '@/lib/geocoding';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// ── Apple-style SVG teardrop pins ────────────────────────────────────────────

function makePinSvg(fill: string) {
  return (
    `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<filter id="ps" x="-60%" y="-30%" width="220%" height="200%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.5)"/>` +
    `</filter>` +
    `<g filter="url(#ps)">` +
    `<path d="M14 2C8.477 2 4 6.477 4 12c0 7.5 10 20 10 20S24 19.5 24 12C24 6.477 19.523 2 14 2z" fill="${fill}"/>` +
    `<circle cx="14" cy="12" r="4.5" fill="white" fill-opacity="0.92"/>` +
    `</g></svg>`
  );
}

// ── Driver marker — precision dot + heading wedge + pulse ring ────────────────

function DriverMarker({ heading, inTransit }: { heading?: number | null; inTransit: boolean }) {
  return (
    <div style={{ position: 'relative', width: 30, height: 30 }}>
      {inTransit && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: '#e86030',
            animation: 'fx-pulse-ring 1.8s ease-out infinite',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 1 }}>
        {heading != null && (
          <path
            d="M12 12 L8 4 L16 4 Z"
            fill="#e86030"
            opacity="0.7"
            transform={`rotate(${heading}, 12, 12)`}
          />
        )}
        <circle cx="12" cy="12" r="6" fill="#e86030" />
        <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.85)" />
      </svg>
    </div>
  );
}

// ── Geofence circle → GeoJSON polygon ────────────────────────────────────────

function circleToPolygon(lat: number, lng: number, radiusM: number, steps = 64) {
  const km = radiusM / 1000;
  const distX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distY = km / 110.574;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    coords.push([lng + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
  }
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
    properties: {},
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeofenceCircle {
  lat: number;
  lng: number;
  radiusM: number;
  label?: string;
}

interface MapViewProps {
  origin: { city: string; state: string };
  destination?: { city: string; state: string };
  /** Full street address for origin pin (geocodes to street level when provided) */
  originAddress?: string;
  /** Full street address for destination pin (geocodes to street level when provided) */
  destAddress?: string;
  progress?: number;
  inTransit?: boolean;
  className?: string;
  /** Real GPS position [lat, lng]. When provided, replaces interpolated truck position. */
  livePosition?: [number, number];
  /** Direction of travel in degrees (0–360). Renders an arrow on the truck marker. */
  heading?: number | null;
  /** Breadcrumb trail polyline for route replay */
  breadcrumbTrail?: [number, number][];
  /** Current index into breadcrumb trail for replay snap */
  replayIndex?: number;
  /** Geofence circles to render on the map */
  geofences?: GeofenceCircle[];
}

// ── MapView ───────────────────────────────────────────────────────────────────

export function MapView({
  origin,
  destination,
  originAddress,
  destAddress,
  progress = 0,
  inTransit = false,
  className = 'h-40',
  livePosition,
  heading,
  breadcrumbTrail,
  replayIndex,
  geofences,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [originPos, setOriginPos] = useState<[number, number] | null>(null);
  const [destPos, setDestPos] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [o, d] = await Promise.all([
        originAddress
          ? geocodeAddress(originAddress, origin.city, origin.state)
          : geocodeCity(origin.city, origin.state),
        destination
          ? destAddress
            ? geocodeAddress(destAddress, destination.city, destination.state)
            : geocodeCity(destination.city, destination.state)
          : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setOriginPos(o);
        setDestPos(d);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    origin.city,
    origin.state,
    originAddress,
    destination?.city,
    destination?.state,
    destAddress,
  ]);

  // Fit bounds once map loads and positions resolve
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !originPos) return;
    if (destPos) {
      mapRef.current.fitBounds(
        [
          [Math.min(originPos[1], destPos[1]), Math.min(originPos[0], destPos[0])],
          [Math.max(originPos[1], destPos[1]), Math.max(originPos[0], destPos[0])],
        ],
        { padding: 44, animate: true },
      );
    } else {
      mapRef.current.flyTo({ center: [originPos[1], originPos[0]], zoom: 10, animate: true });
    }
  }, [mapLoaded, originPos, destPos]);

  // Shimmer loading skeleton
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

  if (!originPos) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl text-xs text-fx-text-dim ${className}`}
        style={{ background: '#181820' }}
      >
        Location unavailable
      </div>
    );
  }

  // Prefer real GPS; fall back to interpolated milestone position
  const truckPos: [number, number] | null = inTransit
    ? (livePosition ??
      (destPos
        ? [
            originPos[0] + (destPos[0] - originPos[0]) * (progress / 100),
            originPos[1] + (destPos[1] - originPos[1]) * (progress / 100),
          ]
        : null))
    : null;

  // Replay position override
  const replayPos: [number, number] | null =
    breadcrumbTrail && replayIndex != null ? (breadcrumbTrail[replayIndex] ?? null) : null;

  // Route GeoJSON — Mapbox expects [lng, lat]
  const routeCoords: [number, number][] = destPos
    ? [
        [originPos[1], originPos[0]],
        [destPos[1], destPos[0]],
      ]
    : [];

  // Breadcrumb GeoJSON — flip [lat, lng] → [lng, lat]
  const breadcrumbCoords: [number, number][] =
    breadcrumbTrail && breadcrumbTrail.length > 1
      ? breadcrumbTrail.map(([lat, lng]) => [lng, lat])
      : [];

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{ longitude: originPos[1], latitude: originPos[0], zoom: 5 }}
        scrollZoom={false}
        dragPan
        attributionControl={false}
        logoPosition="top-right"
        onLoad={() => setMapLoaded(true)}
        style={{ height: '100%', width: '100%' }}
      >
        {/* Route glow halo */}
        {routeCoords.length === 2 && (
          <Source
            id="route-glow-src"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: routeCoords },
              properties: {},
            }}
          >
            <Layer
              id="route-glow"
              type="line"
              paint={{
                'line-color': '#e86030',
                'line-width': 12,
                'line-opacity': 0.15,
                'line-blur': 6,
              }}
              layout={{ 'line-cap': 'round' }}
            />
          </Source>
        )}

        {/* Route main line */}
        {routeCoords.length === 2 && (
          <Source
            id="route-src"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: routeCoords },
              properties: {},
            }}
          >
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': '#e86030', 'line-width': 3.5, 'line-opacity': 0.95 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        )}

        {/* Breadcrumb dashed trail */}
        {breadcrumbCoords.length > 1 && (
          <Source
            id="breadcrumb-src"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: breadcrumbCoords },
              properties: {},
            }}
          >
            <Layer
              id="breadcrumb-line"
              type="line"
              paint={{
                'line-color': '#e86030',
                'line-width': 2.5,
                'line-opacity': 0.7,
                'line-dasharray': [2, 2],
              }}
              layout={{ 'line-cap': 'round' }}
            />
          </Source>
        )}

        {/* Geofence circles */}
        {geofences?.map((gf, i) => (
          <Source
            key={i}
            id={`geofence-${i}`}
            type="geojson"
            data={circleToPolygon(gf.lat, gf.lng, gf.radiusM)}
          >
            <Layer
              id={`geofence-fill-${i}`}
              type="fill"
              paint={{ 'fill-color': '#e86030', 'fill-opacity': 0.1 }}
            />
            <Layer
              id={`geofence-line-${i}`}
              type="line"
              paint={{ 'line-color': '#e86030', 'line-width': 1.5, 'line-opacity': 0.5 }}
            />
          </Source>
        ))}

        {/* Origin pin */}
        <Marker longitude={originPos[1]} latitude={originPos[0]} anchor="bottom">
          <div dangerouslySetInnerHTML={{ __html: makePinSvg('#22c55e') }} />
        </Marker>

        {/* Destination pin */}
        {destPos && (
          <Marker longitude={destPos[1]} latitude={destPos[0]} anchor="bottom">
            <div dangerouslySetInnerHTML={{ __html: makePinSvg('#e86030') }} />
          </Marker>
        )}

        {/* Live driver marker */}
        {truckPos && (
          <Marker longitude={truckPos[1]} latitude={truckPos[0]} anchor="center">
            <DriverMarker heading={heading} inTransit={inTransit} />
          </Marker>
        )}

        {/* Replay snap marker */}
        {replayPos && (
          <Marker longitude={replayPos[1]} latitude={replayPos[0]} anchor="center">
            <DriverMarker heading={null} inTransit={true} />
          </Marker>
        )}
      </Map>

      {/* FIND DRIVER button */}
      {truckPos && (
        <button
          onClick={() =>
            mapRef.current?.flyTo({ center: [truckPos[1], truckPos[0]], zoom: 15, duration: 800 })
          }
          style={{
            position: 'absolute',
            bottom: 14,
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
          <span style={{ fontSize: 13 }}>🚛</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
            FIND DRIVER
          </span>
        </button>
      )}

      {/* Glass zoom buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          right: 12,
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {(['+', '−'] as const).map((label, i) => (
          <button
            key={label}
            onClick={() => (i === 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())}
            style={{
              width: 32,
              height: 32,
              background: 'rgba(14,14,22,0.72)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: i === 0 ? '10px 10px 4px 4px' : '4px 4px 10px 10px',
              color: '#fff',
              fontSize: 20,
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Live badge */}
      {inTransit && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1,
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
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}
