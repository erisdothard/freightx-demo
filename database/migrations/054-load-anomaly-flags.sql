-- Migration 054: Load-level anomaly/fraud detection flags
-- Stores detected anomalies as a JSONB array on each load.

ALTER TABLE loads ADD COLUMN IF NOT EXISTS anomaly_flags JSONB DEFAULT '[]';
