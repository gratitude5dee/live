
-- Public read access to takes rows
CREATE POLICY "takes_public_read" ON public.takes FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.takes TO anon;

-- Public read access to objects in the 'takes' storage bucket
CREATE POLICY "takes_bucket_public_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'takes');
