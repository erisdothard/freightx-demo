-- Migration 051: BOL Enhancements
-- Add freight class, packaging type, and reference fields to loads table
-- Add BOL number to documents table

-- Add new columns to loads table
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS freight_class TEXT;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS packaging_type TEXT;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE public.loads ADD COLUMN IF NOT EXISTS shipper_reference TEXT;

-- Freight class constraint (NMFC standard classes)
ALTER TABLE public.loads DROP CONSTRAINT IF EXISTS valid_freight_class;
ALTER TABLE public.loads ADD CONSTRAINT valid_freight_class
  CHECK (freight_class IS NULL OR freight_class IN (
    '50','55','60','65','70','77.5','85','92.5','100','110','125',
    '150','175','200','250','300','400','500'
  ));

-- Packaging type constraint
ALTER TABLE public.loads DROP CONSTRAINT IF EXISTS valid_packaging_type;
ALTER TABLE public.loads ADD CONSTRAINT valid_packaging_type
  CHECK (packaging_type IS NULL OR packaging_type IN (
    'pallets','crates','boxes','drums','bags','rolls','loose','other'
  ));

-- Add BOL number to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS bol_number TEXT;

-- Add index for BOL number lookups
CREATE INDEX IF NOT EXISTS idx_documents_bol_number ON public.documents(bol_number) WHERE bol_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.loads.freight_class IS 'NMFC freight class (50-500)';
COMMENT ON COLUMN public.loads.packaging_type IS 'Type of packaging (pallets, crates, boxes, etc.)';
COMMENT ON COLUMN public.loads.po_number IS 'Purchase order number reference';
COMMENT ON COLUMN public.loads.shipper_reference IS 'Shipper-provided reference number';
COMMENT ON COLUMN public.documents.bol_number IS 'Bill of Lading number';
