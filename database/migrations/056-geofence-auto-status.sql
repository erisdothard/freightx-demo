-- Migration 056: Geofence auto-status tracking columns
-- Tracks dwell duration and whether auto-status was applied on geofence events.

ALTER TABLE geofence_events ADD COLUMN IF NOT EXISTS dwell_seconds INTEGER;
ALTER TABLE geofence_events ADD COLUMN IF NOT EXISTS auto_status_applied TEXT;
