-- Migration 053: Legal-grade document engine columns
-- Adds cryptographic hashing, GPS anchoring, and consent tracking to documents table.

-- SHA-256 hashes for tamper detection
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_hash TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_doc_hash TEXT;

-- GPS coordinates captured at signature time
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_lat DOUBLE PRECISION;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_lng DOUBLE PRECISION;

-- Network-derived timestamp (anti-spoofing)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_network_ts TIMESTAMPTZ;

-- Click-wrap consent timestamp
ALTER TABLE documents ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;
