# Hours of Service (HOS) Compliance Tracking

**Purpose:** Ensure drivers comply with FMCSA Hours of Service regulations using GPS data

**Status:** Design documentation (not yet implemented)

---

## HOS Regulations Overview

### Federal Motor Carrier Safety Administration (FMCSA) Rules

**11-Hour Driving Limit**

- May drive maximum 11 hours after 10 consecutive hours off duty

**14-Hour Limit**

- May not drive beyond 14th consecutive hour after coming on duty (following 10 consecutive hours off duty)

**Rest Breaks**

- May drive only if 8 hours or less have passed since end of driver's last off-duty or sleeper berth period of at least 30 minutes

**60/70-Hour Limit**

- May not drive after 60/70 hours on duty in 7/8 consecutive days

**Sleeper Berth Provision**

- Drivers using sleeper berth must take at least 8 consecutive hours in sleeper berth, plus 2 consecutive hours either in sleeper berth, off duty, or combination

---

## Database Schema

### Add HOS tracking tables

```sql
-- database/migrations/049-hos-compliance.sql

-- HOS duty status log (required by FMCSA)
CREATE TABLE hos_duty_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  duty_status TEXT NOT NULL CHECK (duty_status IN (
    'off_duty',
    'sleeper_berth',
    'driving',
    'on_duty_not_driving'
  )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
      ELSE NULL
    END
  ) STORED,
  location_start GEOGRAPHY(POINT, 4326),
  location_end GEOGRAPHY(POINT, 4326),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hos_duty_log_driver ON hos_duty_log(driver_id, started_at DESC);

-- HOS violations log
CREATE TABLE hos_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'exceeded_11_hour_drive',
    'exceeded_14_hour_window',
    'no_30_min_break',
    'exceeded_60_70_hour',
    'missing_rest_period'
  )),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'violation', 'critical')),
  drive_hours DECIMAL(4,2),
  on_duty_hours DECIMAL(4,2),
  description TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_hos_violations_driver ON hos_violations(driver_id, detected_at DESC);

-- HOS daily summary (for 7/8-day rolling calculations)
CREATE TABLE hos_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  drive_minutes INTEGER NOT NULL DEFAULT 0,
  on_duty_minutes INTEGER NOT NULL DEFAULT 0,
  off_duty_minutes INTEGER NOT NULL DEFAULT 0,
  sleeper_berth_minutes INTEGER NOT NULL DEFAULT 0,
  violations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(driver_id, date)
);

CREATE INDEX idx_hos_daily_summary_driver_date ON hos_daily_summary(driver_id, date DESC);
```

---

## HOS Calculation Functions

### Calculate remaining drive time

```sql
CREATE OR REPLACE FUNCTION get_driver_hos_status(p_driver_id UUID)
RETURNS TABLE (
  current_duty_status TEXT,
  drive_hours_today DECIMAL,
  on_duty_hours_today DECIMAL,
  remaining_drive_hours DECIMAL,
  remaining_on_duty_hours DECIMAL,
  hours_60_70 DECIMAL,
  requires_30_min_break BOOLEAN,
  next_required_rest TIMESTAMPTZ,
  violations_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status TEXT;
  v_drive_today DECIMAL;
  v_on_duty_today DECIMAL;
  v_hours_7_days DECIMAL;
  v_last_break TIMESTAMPTZ;
  v_current_shift_start TIMESTAMPTZ;
BEGIN
  -- Get current duty status
  SELECT duty_status INTO v_current_status
  FROM profiles
  WHERE id = p_driver_id;

  -- Calculate today's hours
  SELECT
    COALESCE(SUM(duration_minutes) FILTER (WHERE duty_status = 'driving'), 0) / 60.0,
    COALESCE(SUM(duration_minutes) FILTER (WHERE duty_status IN ('driving', 'on_duty_not_driving')), 0) / 60.0
  INTO v_drive_today, v_on_duty_today
  FROM hos_duty_log
  WHERE driver_id = p_driver_id
    AND started_at >= CURRENT_DATE;

  -- Calculate 7-day rolling hours
  SELECT COALESCE(SUM(on_duty_minutes), 0) / 60.0
  INTO v_hours_7_days
  FROM hos_daily_summary
  WHERE driver_id = p_driver_id
    AND date >= CURRENT_DATE - INTERVAL '7 days';

  -- Check 30-minute break requirement
  SELECT MAX(started_at) INTO v_last_break
  FROM hos_duty_log
  WHERE driver_id = p_driver_id
    AND duty_status IN ('off_duty', 'sleeper_berth')
    AND duration_minutes >= 30;

  -- Get current shift start time
  SELECT MIN(started_at) INTO v_current_shift_start
  FROM hos_duty_log
  WHERE driver_id = p_driver_id
    AND started_at >= (
      SELECT MAX(started_at)
      FROM hos_duty_log
      WHERE driver_id = p_driver_id
        AND duty_status IN ('off_duty', 'sleeper_berth')
        AND duration_minutes >= 600  -- 10 hours
    );

  RETURN QUERY SELECT
    v_current_status,
    v_drive_today,
    v_on_duty_today,
    GREATEST(0, 11 - v_drive_today) AS remaining_drive_hours,
    GREATEST(0, 14 - v_on_duty_today) AS remaining_on_duty_hours,
    v_hours_7_days,
    (EXTRACT(EPOCH FROM (NOW() - v_last_break)) / 3600.0) > 8 AS requires_30_min_break,
    v_current_shift_start + INTERVAL '14 hours' AS next_required_rest,
    (SELECT COUNT(*) FROM hos_violations WHERE driver_id = p_driver_id AND detected_at >= CURRENT_DATE)::INTEGER;
END;
$$;
```

---

## Violation Detection

### Real-time violation monitoring

```typescript
// services/hos-compliance.service.ts

export async function detectHosViolations(driverId: string): Promise<HosViolation[]> {
  const violations: HosViolation[] = [];

  const { data: status } = await supabase.rpc('get_driver_hos_status', {
    p_driver_id: driverId,
  });

  if (!status) return violations;

  // Check 11-hour driving limit
  if (status.drive_hours_today >= 11) {
    violations.push({
      type: 'exceeded_11_hour_drive',
      severity: 'critical',
      description: `Driver has driven ${status.drive_hours_today.toFixed(1)} hours (limit: 11)`,
      drive_hours: status.drive_hours_today,
    });
  }

  // Warning at 10 hours (1 hour before violation)
  if (status.drive_hours_today >= 10 && status.drive_hours_today < 11) {
    violations.push({
      type: 'exceeded_11_hour_drive',
      severity: 'warning',
      description: `Driver approaching 11-hour limit (${status.remaining_drive_hours.toFixed(1)} hours remaining)`,
      drive_hours: status.drive_hours_today,
    });
  }

  // Check 14-hour on-duty limit
  if (status.on_duty_hours_today >= 14) {
    violations.push({
      type: 'exceeded_14_hour_window',
      severity: 'critical',
      description: `Driver has been on duty ${status.on_duty_hours_today.toFixed(1)} hours (limit: 14)`,
      on_duty_hours: status.on_duty_hours_today,
    });
  }

  // Check 30-minute break requirement
  if (status.requires_30_min_break && status.current_duty_status === 'driving') {
    violations.push({
      type: 'no_30_min_break',
      severity: 'violation',
      description: 'Driver must take 30-minute break after 8 hours of driving',
    });
  }

  // Check 60/70-hour limit
  if (status.hours_60_70 >= 60) {
    violations.push({
      type: 'exceeded_60_70_hour',
      severity: 'critical',
      description: `Driver has ${status.hours_60_70.toFixed(1)} on-duty hours in past 7 days (limit: 60)`,
      on_duty_hours: status.hours_60_70,
    });
  }

  return violations;
}
```

---

## Driver Dashboard Integration

### Show HOS status in driver app

```tsx
// components/hos-status-card.tsx

export function HosStatusCard({ driverId }: { driverId: string }) {
  const [status, setStatus] = useState<HosStatus | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const { data } = await supabase.rpc('get_driver_hos_status', {
        p_driver_id: driverId,
      });
      setStatus(data);
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [driverId]);

  if (!status) return null;

  return (
    <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
      <h3 className="text-xs font-bold text-fx-text-muted uppercase mb-3">Hours of Service</h3>

      {/* Driving hours progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-fx-text-muted">Driving Hours</span>
          <span className="text-xs font-bold text-fx-text">
            {status.drive_hours_today.toFixed(1)} / 11
          </span>
        </div>
        <div className="h-2 bg-fx-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              status.drive_hours_today >= 11
                ? 'bg-red-500'
                : status.drive_hours_today >= 10
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min((status.drive_hours_today / 11) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* On-duty hours progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-fx-text-muted">On-Duty Hours</span>
          <span className="text-xs font-bold text-fx-text">
            {status.on_duty_hours_today.toFixed(1)} / 14
          </span>
        </div>
        <div className="h-2 bg-fx-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              status.on_duty_hours_today >= 14
                ? 'bg-red-500'
                : status.on_duty_hours_today >= 13
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min((status.on_duty_hours_today / 14) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Warnings */}
      {status.requires_30_min_break && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5 flex items-start gap-2">
          <AlertCircle size={14} className="text-yellow-400 mt-0.5" />
          <p className="text-xs font-semibold text-yellow-400">30-minute break required</p>
        </div>
      )}

      {status.violations_count > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5" />
          <p className="text-xs font-semibold text-red-400">
            {status.violations_count} violation{status.violations_count > 1 ? 's' : ''} today
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## ELD (Electronic Logging Device) Integration

FreightX GPS tracking can serve as an ELD alternative if certified:

### ELD Certification Requirements

1. **Technical specifications** (49 CFR Part 395, Subpart B, Appendix A)
   - Automatic recording of driving time
   - GPS location logging
   - Synchronized UTC time
   - Tamper-resistant design

2. **Data retention**
   - 8 days of data on device
   - 6 months of records (transferable)

3. **Output capabilities**
   - Generate driver logs
   - Transfer data to authorized officials
   - Print logs on demand

### Implementation Status

- ✅ Automatic GPS logging
- ✅ UTC timestamps
- ✅ Data retention (90 days)
- ❌ ELD certification pending
- ❌ Roadside inspection output format
- ❌ Malfunction diagnostics

**To become ELD-certified:** Submit to FMCSA for independent testing and registration

---

## Compliance Reports

### Weekly HOS Report for Carriers

```sql
CREATE OR REPLACE FUNCTION generate_weekly_hos_report(
  p_carrier_id UUID,
  p_week_start DATE
)
RETURNS TABLE (
  driver_id UUID,
  driver_name TEXT,
  total_drive_hours DECIMAL,
  total_on_duty_hours DECIMAL,
  violations_count INTEGER,
  compliance_score DECIMAL
)
LANGUAGE sql
AS $$
  SELECT
    p.id AS driver_id,
    p.full_name AS driver_name,
    COALESCE(SUM(hds.drive_minutes), 0) / 60.0 AS total_drive_hours,
    COALESCE(SUM(hds.on_duty_minutes), 0) / 60.0 AS total_on_duty_hours,
    COALESCE(SUM(hds.violations_count), 0)::INTEGER AS violations_count,
    GREATEST(0, 100 - (COALESCE(SUM(hds.violations_count), 0) * 10))::DECIMAL AS compliance_score
  FROM profiles p
  LEFT JOIN hos_daily_summary hds ON hds.driver_id = p.id
    AND hds.date >= p_week_start
    AND hds.date < p_week_start + INTERVAL '7 days'
  WHERE p.company_id IN (
    SELECT company_id FROM profiles WHERE id = p_carrier_id
  )
  AND p.role = 'driver'
  GROUP BY p.id, p.full_name
  ORDER BY compliance_score ASC, violations_count DESC;
$$;
```

---

## Future Enhancements

1. **Predictive alerts:** "You will exceed 11-hour limit in 45 minutes"
2. **Route optimization:** Factor HOS limits into dispatch planning
3. **Driver coaching:** Identify patterns of non-compliance
4. **Automated DOT audits:** Generate inspection-ready reports

---

## Legal Disclaimer

This documentation is for informational purposes only. FreightX is not currently ELD-certified. Carriers are responsible for ensuring compliance with all applicable FMCSA regulations. Consult with legal counsel before relying on this system for HOS compliance.
