-- 034: Add signature columns to documents table for BOL signing flow
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signatory_name text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type text;

-- Allow drivers to update documents they uploaded (for signing)
CREATE POLICY IF NOT EXISTS "drivers_update_own_documents"
  ON documents FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Allow drivers to insert documents for loads assigned to them
CREATE POLICY IF NOT EXISTS "drivers_insert_documents"
  ON documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_id
      AND loads.assigned_driver_id = auth.uid()
    )
  );
