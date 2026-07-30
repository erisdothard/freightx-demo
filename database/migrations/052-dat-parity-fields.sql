-- Phase 22: DAT parity — load classification + broker factoring flag
ALTER TABLE loads ADD COLUMN IF NOT EXISTS full_partial TEXT
  CHECK (full_partial IN ('full', 'partial'));

ALTER TABLE companies ADD COLUMN IF NOT EXISTS accepts_factoring BOOLEAN DEFAULT false;
