# Enterprise GPS & Location Tracking Architecture

**Version:** 2.0
**Date:** 2026-04-10
**Status:** Design Proposal

---

## Executive Summary

FreightX currently has a **production-ready GPS tracking system** built for single-region, low-volume operations (<500 concurrent drivers). To scale to **enterprise freight marketplace** levels (multi-tenant, 10K+ drivers, compliance-critical), we need architectural upgrades in:

1. **Role-based GPS permissions** (who can send vs. view)
2. **Enterprise geocoding** (commercial-grade address validation)
3. **Between-load tracking** (deadhead optimization)
4. **Data governance** (RLS hardening, retention policies, audit logs)
5. **Scale infrastructure** (TimescaleDB, Redis, Kafka)

---

## Current State (As-Built)

### ✅ What Works Well

- **Real-time GPS streaming** (30s intervals, 50m movement threshold)
- **Offline resilience** (queued pings, auto-retry on reconnection)
- **Anomaly detection** (teleportation, excessive speed, signal loss)
- **Role-specific UIs** (driver sends, carrier views, broker tracks)
- **Public tracking tokens** (7-day expiry, revocable)
- **Geofencing** (500m radius, enter/exit events)
- **Dwell time tracking** (auto-detention flagging >120 min)
- **Predictive ETA** (confidence scoring, rush-hour penalties)
- **Driver scoring** (speed 40%, route 35%, dwell 25%)

### ⚠️ Gaps for Enterprise Scale

| Gap                            | Impact                            | Priority    |
| ------------------------------ | --------------------------------- | ----------- |
| **Permissive RLS policies**    | Data leaks across tenants         | 🔴 Critical |
| **No data retention policy**   | Unbounded storage growth          | 🔴 Critical |
| **Nominatim geocoding**        | Rate limits, wrong results        | 🟡 High     |
| **No between-load tracking**   | Can't optimize deadhead           | 🟡 High     |
| **No audit logging**           | Compliance risk (GDPR, SOC2)      | 🔴 Critical |
| **PostgreSQL for time-series** | Slow queries at scale (>10M rows) | 🟡 High     |
| **No fleet-wide heatmaps**     | Carriers can't see truck density  | 🟢 Medium   |

---

## Enterprise Architecture Design

### 1. Role-Based GPS Permissions (RBAC)

**Problem:** Carriers seeing "Send GPS" button when they should only view.

**Solution:**

```typescript
// apps/web/src/lib/permissions.ts

export const GPS_PERMISSIONS = {
  driver: {
    canSend: true, // Send GPS pings
    canView: false, // Can't see other drivers
  },
  carrier: {
    canSend: false, // Carriers don't send GPS
    canView: true, // View all their drivers
    scope: 'company', // Only drivers in their company
  },
  broker: {
    canSend: false,
    canView: true,
    scope: 'load', // Only loads they booked
  },
  shipper: {
    canSend: false,
    canView: true,
    scope: 'load', // Only their loads
  },
  ownerOperator: {
    canSend: true, // Owner-operators wear both hats
    canView: true,
    scope: 'self',
  },
};

export function canSendGps(role: string, userId: string): boolean {
  // Check if user is owner-operator (carrier + driver)
  const isOwnerOp = await checkOwnerOperatorStatus(userId);
  if (isOwnerOp) return true;
  return GPS_PERMISSIONS[role]?.canSend ?? false;
}
```

**UI Changes:**

- Driver dashboard: Show "Send GPS" only if `canSendGps(role, userId) === true`
- Carrier dashboard: Hide all GPS send controls
- Add role badge to top header: "Driver", "Carrier (Owner-Operator)", etc.

**Database RLS Updates:**

```sql
-- location_pings: Tighten who can INSERT
CREATE POLICY "drivers_can_insert_own_pings"
ON location_pings FOR INSERT
TO authenticated
WITH CHECK (
  -- Must be driver role AND own user_id
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'driver'
    AND id = location_pings.user_id
  )
);

-- breadcrumb_snapshots: Restrict reads to load participants
CREATE POLICY "load_participants_can_read_breadcrumbs"
ON breadcrumb_snapshots FOR SELECT
TO authenticated
USING (
  load_id IN (
    SELECT id FROM loads
    WHERE posted_by = auth.uid()           -- Shipper
    OR accepted_by = auth.uid()            -- Carrier
    OR assigned_driver_id = auth.uid()     -- Driver
    OR id IN (
      SELECT load_id FROM bids WHERE bidder_id = auth.uid()
    )
  )
);
```

---

### 2. Enterprise Geocoding & Address Validation

**Problem:** Nominatim returns wrong coordinates (Nashville → Portland).

**Solution:** Replace with **Google Maps Geocoding API** + address validation UI.

#### A. Google Maps Integration

```typescript
// apps/web/src/lib/geocoding-enterprise.ts

import { GOOGLE_MAPS_API_KEY } from '@/lib/env';

interface GeocodingResult {
  coords: [number, number];
  normalized_address: string;
  confidence: 'rooftop' | 'range_interpolated' | 'approximate';
  place_id: string;
}

export async function geocodeAddressGoogle(
  address: string,
  city: string,
  state: string,
): Promise<GeocodingResult | null> {
  const query = `${address}, ${city}, ${state}, USA`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 'OK' || data.results.length === 0) return null;

  const result = data.results[0];
  return {
    coords: [result.geometry.location.lat, result.geometry.location.lng],
    normalized_address: result.formatted_address,
    confidence: result.geometry.location_type,
    place_id: result.place_id,
  };
}
```

#### B. Address Validation UI

When user enters address in load posting form:

```tsx
// apps/web/src/features/loads/components/address-validator.tsx

export function AddressValidator({ onConfirm }: Props) {
  const [rawAddress, setRawAddress] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);

  async function handleValidate() {
    const results = await geocodeAddressGoogle(rawAddress, city, state);
    if (!results) {
      toast.error('Address not found. Please check and try again.');
      return;
    }
    setSuggestions([results]);
  }

  return (
    <div>
      <input value={rawAddress} onChange={(e) => setRawAddress(e.target.value)} />
      <button onClick={handleValidate}>Validate Address</button>

      {suggestions.length > 0 && (
        <div className="suggestions">
          <p>Did you mean:</p>
          {suggestions.map((s) => (
            <button key={s.place_id} onClick={() => onConfirm(s)} className="suggestion-item">
              <strong>{s.normalized_address}</strong>
              <span className="confidence">{s.confidence}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### C. Database Schema Updates

Store both raw and normalized addresses:

```sql
-- database/migrations/XXX-address-normalization.sql

ALTER TABLE loads
  ADD COLUMN origin_address_raw TEXT,          -- What user typed
  ADD COLUMN origin_address_normalized TEXT,   -- Google validated
  ADD COLUMN origin_place_id TEXT,             -- Google Place ID
  ADD COLUMN origin_geocode_confidence TEXT,   -- rooftop | range | approximate
  ADD COLUMN dest_address_raw TEXT,
  ADD COLUMN dest_address_normalized TEXT,
  ADD COLUMN dest_place_id TEXT,
  ADD COLUMN dest_geocode_confidence TEXT;

-- Keep existing originLat/originLng for compatibility
```

**Fallback strategy:**

1. Try Google Maps Geocoding API (primary)
2. If quota exceeded → fallback to Nominatim
3. If both fail → ask user to confirm city-level coordinates

**Cost estimate:**

- Google Maps Geocoding: $5/1000 requests
- Typical load posting: 2 geocodes (origin + destination)
- 10,000 loads/month = 20,000 geocodes = $100/month

---

### 3. Between-Load Tracking (Deadhead Optimization)

**Problem:** Drivers only tracked when load is `in_transit`. Carriers can't see where empty trucks are.

**Solution:** Continuous GPS when driver is "on duty" (not just assigned to active load).

#### A. Driver Duty Status

```sql
-- database/migrations/XXX-driver-duty-status.sql

CREATE TYPE duty_status AS ENUM ('on_duty', 'off_duty', 'sleeper', 'driving');

ALTER TABLE users
  ADD COLUMN current_duty_status duty_status DEFAULT 'off_duty',
  ADD COLUMN duty_status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN last_known_location GEOGRAPHY(POINT, 4326),
  ADD COLUMN last_location_update TIMESTAMPTZ;

-- Index for "find empty trucks near pickup" queries
CREATE INDEX idx_users_last_known_location ON users USING GIST(last_known_location)
  WHERE role = 'driver' AND current_duty_status IN ('on_duty', 'driving');
```

#### B. Continuous GPS Hook

```typescript
// apps/web/src/features/loads/hooks/use-continuous-gps.ts

export function useContinuousGps() {
  const { user } = useAuth();
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>('off_duty');

  // Auto-enable GPS when on_duty or driving
  const shouldTrack = dutyStatus === 'on_duty' || dutyStatus === 'driving';

  useDriverLocation({
    loadNumber: null, // No specific load
    active: shouldTrack,
    updateInterval: dutyStatus === 'driving' ? 30000 : 60000, // 30s when driving, 60s when on-duty
  });

  return { dutyStatus, setDutyStatus };
}
```

#### C. Fleet Availability Map

Carrier dashboard shows:

- 🟢 **Green pins**: Empty trucks on-duty (available for assignment)
- 🔵 **Blue pins**: Trucks with dispatched loads (not yet in transit)
- 🟠 **Orange pins**: Trucks in transit (currently hauling)
- ⚪ **Gray pins**: Off-duty trucks (last known location)

```tsx
// apps/web/src/pages/carrier/fleet-availability.tsx

export default function FleetAvailability() {
  const { drivers } = useCompanyDrivers();

  const availableDrivers = drivers.filter((d) => d.duty_status === 'on_duty' && !d.current_load_id);

  return (
    <MapView>
      {availableDrivers.map((driver) => (
        <Marker
          key={driver.id}
          position={driver.last_known_location}
          color="green"
          popup={`${driver.name} - Available since ${driver.duty_status_updated_at}`}
        />
      ))}
    </MapView>
  );
}
```

#### D. Deadhead Optimization API

```typescript
// apps/web/src/services/deadhead-optimizer.service.ts

/**
 * Find closest available truck to a pickup location
 */
export async function findNearestTruck(
  pickupLat: number,
  pickupLng: number,
  maxDistanceMiles: number,
): Promise<Driver[]> {
  const { data } = await supabase.rpc('find_nearest_available_trucks', {
    pickup_point: `POINT(${pickupLng} ${pickupLat})`,
    max_distance_meters: maxDistanceMiles * 1609.34,
  });
  return data ?? [];
}
```

```sql
-- Supabase RPC function
CREATE OR REPLACE FUNCTION find_nearest_available_trucks(
  pickup_point GEOGRAPHY,
  max_distance_meters FLOAT
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  distance_miles FLOAT,
  last_update TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    ST_Distance(u.last_known_location, pickup_point) / 1609.34 AS distance_miles,
    u.last_location_update
  FROM users u
  WHERE u.role = 'driver'
    AND u.current_duty_status IN ('on_duty', 'driving')
    AND u.id NOT IN (SELECT assigned_driver_id FROM loads WHERE status IN ('in_transit', 'dispatched'))
    AND ST_DWithin(u.last_known_location, pickup_point, max_distance_meters)
  ORDER BY ST_Distance(u.last_known_location, pickup_point) ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
```

---

### 4. Data Governance & Compliance

#### A. Retention Policies

**Requirements:**

- GDPR: Right to be forgotten (delete on request)
- SOC2: Audit trail of who accessed what
- Business: 90-day GPS history for dispute resolution

```sql
-- database/migrations/XXX-retention-policies.sql

-- Auto-delete location pings older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_location_pings()
RETURNS void AS $$
BEGIN
  DELETE FROM location_pings
  WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-location-pings',
  '0 2 * * *',  -- 2 AM daily
  'SELECT cleanup_old_location_pings();'
);

-- Delete breadcrumb snapshots after 7 days (route replay data)
CREATE OR REPLACE FUNCTION cleanup_old_breadcrumbs()
RETURNS void AS $$
BEGIN
  DELETE FROM breadcrumb_snapshots
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'cleanup-breadcrumbs',
  '0 3 * * *',  -- 3 AM daily
  'SELECT cleanup_old_breadcrumbs();'
);
```

#### B. Audit Logging

Track who accessed location data (GDPR Article 15 requirement):

```sql
-- database/migrations/XXX-location-access-audit.sql

CREATE TABLE location_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_id UUID REFERENCES users(id),
  accessor_role TEXT,
  accessed_driver_id UUID REFERENCES users(id),
  accessed_load_id UUID REFERENCES loads(id),
  access_type TEXT, -- 'view_ping' | 'view_breadcrumb' | 'export'
  access_timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_location_audit_driver ON location_access_audit(accessed_driver_id, access_timestamp DESC);
CREATE INDEX idx_location_audit_timestamp ON location_access_audit(access_timestamp DESC);
```

**Log access in RLS policies:**

```sql
-- Example: Log when someone views location pings
CREATE POLICY "log_location_ping_access"
ON location_pings FOR SELECT
TO authenticated
USING (
  -- Log access first
  (SELECT log_location_access(auth.uid(), load_id, 'view_ping')) IS NOT NULL
  AND
  -- Then check permission
  load_id IN (SELECT id FROM loads WHERE posted_by = auth.uid() OR accepted_by = auth.uid())
);
```

#### C. GDPR "Right to Forget"

```sql
-- database/migrations/XXX-gdpr-right-to-forget.sql

CREATE OR REPLACE FUNCTION anonymize_driver_location_data(driver_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete all location pings
  DELETE FROM location_pings WHERE user_id = driver_id;

  -- Delete breadcrumb snapshots
  DELETE FROM breadcrumb_snapshots WHERE load_id IN (
    SELECT id FROM loads WHERE assigned_driver_id = driver_id
  );

  -- Clear last known location
  UPDATE users
  SET last_known_location = NULL,
      last_location_update = NULL
  WHERE id = driver_id;

  -- Log deletion
  INSERT INTO gdpr_deletion_log (user_id, deletion_type, deleted_at)
  VALUES (driver_id, 'location_data', NOW());
END;
$$ LANGUAGE plpgsql;
```

---

### 5. Scale Infrastructure

#### A. TimescaleDB for GPS Time-Series

**Problem:** PostgreSQL table scans slow down with >10M location pings.

**Solution:** Migrate `location_pings` to TimescaleDB hypertable.

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert location_pings to hypertable
SELECT create_hypertable(
  'location_pings',
  'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Auto-compression after 7 days
ALTER TABLE location_pings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'user_id, load_id',
  timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('location_pings', INTERVAL '7 days');
```

**Performance improvement:**

- Before: 5-10s query for "show all pings for load X"
- After: <100ms with automatic compression + indexing

#### B. Redis for Live Tracking

**Problem:** Dashboard refreshes query PostgreSQL every 3 seconds → high DB load.

**Solution:** Cache "last known location" in Redis.

```typescript
// apps/web/src/lib/redis-location-cache.ts

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function cacheDriverLocation(driverId: string, ping: LocationPing): Promise<void> {
  await redis.setex(
    `driver:location:${driverId}`,
    60, // 60s TTL
    JSON.stringify(ping),
  );
}

export async function getDriverLocation(driverId: string): Promise<LocationPing | null> {
  const cached = await redis.get(`driver:location:${driverId}`);
  return cached ? JSON.parse(cached) : null;
}

// Update Redis on every GPS ping
export async function onLocationPingReceived(ping: LocationPing) {
  await Promise.all([
    supabase.from('location_pings').insert(ping), // Write to DB
    cacheDriverLocation(ping.user_id, ping), // Update Redis cache
  ]);
}
```

**Dashboard reads from Redis first:**

```typescript
// apps/web/src/features/loads/hooks/use-live-tracking.ts (updated)

export function useLiveTracking(loadNumber: string) {
  const [ping, setPing] = useState<LocationPing | null>(null);

  useEffect(() => {
    // Read from Redis cache every 3s
    const interval = setInterval(async () => {
      const cached = await getDriverLocation(driverId);
      if (cached) {
        setPing(cached);
      } else {
        // Fallback to Supabase if not in cache
        const { data } = await supabase
          .from('location_pings')
          .select('*')
          .eq('load_number', loadNumber)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();
        setPing(data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadNumber, driverId]);

  return ping;
}
```

#### C. Kafka for Event Streaming (10K+ drivers)

**When to use:** If fleet grows beyond 1,000 concurrent drivers sending GPS every 30s (= 2,000 pings/min).

```
Driver App → API Gateway → Kafka Topic "location-pings" → Consumer Workers → TimescaleDB + Redis
                                        ↓
                                  Geofence Processor → Notifications
                                        ↓
                                  Anomaly Detector → Alerts
                                        ↓
                                  ETA Updater → Dashboard
```

**Benefits:**

- Decouple GPS ingestion from downstream processing
- Horizontal scaling (add more consumer workers)
- Replay events for debugging
- Guaranteed delivery (no lost pings)

---

## Implementation Roadmap

### Phase 1: Security & Compliance (Week 1-2) 🔴 Critical

- [ ] Fix RLS policies (breadcrumb_snapshots, geofences, dwell_records)
- [ ] Add role-based GPS send permissions
- [ ] Implement audit logging for location access
- [ ] Add 90-day retention policy + auto-cleanup
- [ ] GDPR "right to forget" function

### Phase 2: Address Validation (Week 3) 🟡 High

- [ ] Integrate Google Maps Geocoding API
- [ ] Build address validation UI
- [ ] Update database schema (raw + normalized addresses)
- [ ] Migrate existing loads to normalized format
- [ ] Add Nominatim fallback for quota limits

### Phase 3: Between-Load Tracking (Week 4-5) 🟡 High

- [ ] Add driver duty status (on_duty, off_duty, driving, sleeper)
- [ ] Build continuous GPS hook (independent of load assignment)
- [ ] Create fleet availability map (empty trucks)
- [ ] Implement deadhead optimizer (find nearest truck)
- [ ] Add "assign to nearest driver" button for carriers

### Phase 4: Scale Infrastructure (Week 6-8) 🟢 Medium

- [ ] Enable TimescaleDB extension
- [ ] Convert location_pings to hypertable
- [ ] Add Redis caching layer
- [ ] Update dashboard to read from Redis
- [ ] Load test: 1,000 concurrent drivers

### Phase 5: Advanced Features (Week 9-12) 🟢 Low

- [ ] Fleet heatmaps (truck density visualization)
- [ ] Route optimization suggestions
- [ ] HOS (Hours of Service) compliance tracking
- [ ] Driver behavior scoring (speed, braking, idling)
- [ ] Kafka event streaming (if >1,000 drivers)

---

## Cost Analysis

| Component      | Current                | Enterprise               | Delta    |
| -------------- | ---------------------- | ------------------------ | -------- |
| **Geocoding**  | $0 (Nominatim)         | $100/mo (Google 20K req) | +$100    |
| **Database**   | $25/mo (Supabase Free) | $100/mo (TimescaleDB)    | +$75     |
| **Redis**      | $0                     | $15/mo (Upstash Pro)     | +$15     |
| **Monitoring** | $0                     | $50/mo (Sentry Business) | +$50     |
| **Total**      | $25/mo                 | $265/mo                  | +$240/mo |

**ROI:**

- Current system: Handles 100 drivers
- Enterprise system: Handles 10,000 drivers
- Cost per driver: $2.50 → $0.03/month (100x efficiency gain)

---

## Testing Strategy

### Load Testing Scenarios

1. **GPS Ingestion:**
   - 1,000 drivers × 1 ping/30s = 2,000 pings/min
   - Run for 1 hour = 120,000 pings
   - Measure: DB insert latency, queue depth, error rate

2. **Dashboard Performance:**
   - 100 concurrent carrier dashboards
   - Each refreshing every 3s
   - Measure: Redis hit rate, API response time

3. **Geofence Processing:**
   - 500 active loads with pickup/delivery geofences
   - Simulate 1,000 drivers crossing boundaries
   - Measure: Event processing latency, notification delivery time

4. **Deadhead Queries:**
   - Query "find 10 nearest trucks" 1,000 times/min
   - Measure: Query time, PostGIS index efficiency

### Integration Tests

```typescript
// test/integration/gps-tracking.spec.ts

describe('Enterprise GPS Tracking', () => {
  it('should enforce role-based GPS send permissions', async () => {
    const carrier = await createUser({ role: 'carrier' });
    const driver = await createUser({ role: 'driver' });

    // Carrier can't send GPS
    await expect(sendGpsPing(carrier.id, { lat: 36.1, lng: -86.7 })).rejects.toThrow(
      'Permission denied',
    );

    // Driver can send GPS
    await expect(sendGpsPing(driver.id, { lat: 36.1, lng: -86.7 })).resolves.toBeTruthy();
  });

  it('should log location access for GDPR compliance', async () => {
    const broker = await createUser({ role: 'broker' });
    const load = await createLoad({ postedBy: broker.id });

    await viewLoadTracking(broker.id, load.id);

    const auditLog = await getLocationAccessAudit(broker.id);
    expect(auditLog).toHaveLength(1);
    expect(auditLog[0].access_type).toBe('view_ping');
  });

  it('should geocode Nashville correctly (not Portland)', async () => {
    const result = await geocodeAddressGoogle('123 Main St', 'Nashville', 'TN');

    expect(result.coords[0]).toBeCloseTo(36.16, 1); // Nashville lat
    expect(result.coords[1]).toBeCloseTo(-86.78, 1); // Nashville lng
    expect(result.normalized_address).toContain('Nashville, TN');
  });
});
```

---

## Security Considerations

### Threat Model

| Threat                    | Mitigation                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| **GPS spoofing**          | Anomaly detection (teleportation, excessive speed) + device attestation |
| **Unauthorized tracking** | RLS policies + role-based permissions + audit logs                      |
| **Data exfiltration**     | Rate limiting on export endpoints + access logging                      |
| **Man-in-the-middle**     | HTTPS only + certificate pinning in mobile app                          |
| **Replay attacks**        | Timestamp validation (reject pings >5 min old)                          |

### Privacy Controls

- **Driver consent:** GPS only shared after explicit opt-in (GDPR Article 6)
- **Duty status:** GPS auto-disabled when driver goes off-duty
- **Data minimization:** Only store lat/lng/timestamp (no device fingerprints)
- **Transparency:** Drivers see who viewed their location (in app)

---

## Success Metrics

| Metric                  | Current       | Target    | Measurement                   |
| ----------------------- | ------------- | --------- | ----------------------------- |
| **GPS uptime**          | 95%           | 99.9%     | % of pings delivered          |
| **Geocoding accuracy**  | 80%           | 98%       | Manual audit of 100 addresses |
| **Dashboard load time** | 2-3s          | <500ms    | Redis cache hit rate >95%     |
| **Database query time** | 5s (10M rows) | <100ms    | TimescaleDB compression       |
| **Compliance audit**    | N/A           | Pass SOC2 | Audit log coverage 100%       |

---

## Open Questions

1. **Mobile app:** Do we need native iOS/Android apps for better background GPS? (Web Geolocation API has limitations when tab is backgrounded)
2. **Offline mode:** How long can drivers queue pings before storage limits?
3. **International:** Do we need geocoding for Canada/Mexico? (Different APIs/rates)
4. **Legal:** Does continuous GPS tracking require driver employment classification review? (Consult labor attorney)

---

## References

- [Google Maps Geocoding API Docs](https://developers.google.com/maps/documentation/geocoding)
- [TimescaleDB Best Practices](https://docs.timescale.com/timescaledb/latest/how-to-guides/compression/)
- [GDPR Article 15 (Right of Access)](https://gdpr-info.eu/art-15-gdpr/)
- [SOC2 Location Data Requirements](https://www.aicpa.org/soc4so)

---

**Next Steps:**

1. Review this design with 3 Aces Trucking stakeholders
2. Get legal sign-off on GDPR/compliance sections
3. Obtain Google Maps API key + set up billing alerts
4. Kick off Phase 1 (Security & Compliance) sprint
