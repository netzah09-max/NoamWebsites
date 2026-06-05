ALTER TABLE public.reviews ADD COLUMN image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-images', 'review-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view review images"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-images');

CREATE POLICY "Anyone can upload review images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "Admin can delete review images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-images' AND (auth.jwt() ->> 'email'::text) = 'netzah09@gmail.com'::text);