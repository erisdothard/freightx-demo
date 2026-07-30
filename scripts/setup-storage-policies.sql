-- Company Logos: public read, authenticated insert/update/delete
CREATE POLICY "Company logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Company logos authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Company logos authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Company logos authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

-- Avatars: public read, authenticated insert/update/delete
CREATE POLICY "Avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Avatars authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Avatars authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Avatars authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Tire Photos: public read, authenticated insert/update/delete
CREATE POLICY "Tire photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tire-photos');

CREATE POLICY "Tire photos authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tire-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Tire photos authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tire-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Tire photos authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tire-photos' AND auth.role() = 'authenticated');

-- Incident Photos: public read, authenticated insert/update/delete
CREATE POLICY "Incident photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'incident-photos');

CREATE POLICY "Incident photos authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'incident-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Incident photos authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'incident-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Incident photos authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'incident-photos' AND auth.role() = 'authenticated');

-- Documents: authenticated read/insert/update/delete (private bucket)
CREATE POLICY "Documents authenticated read"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Documents authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Documents authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Documents authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Receipts: authenticated read/insert/update/delete (private bucket)
CREATE POLICY "Receipts authenticated read"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Receipts authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Receipts authenticated update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Receipts authenticated delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');
