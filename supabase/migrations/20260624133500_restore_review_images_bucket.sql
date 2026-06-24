INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can upload review images" ON storage.objects;
CREATE POLICY "Anyone can upload review images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'review-images'
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
  AND coalesce(metadata->>'mimetype', '') LIKE 'image/%'
);

DROP POLICY IF EXISTS "Public can view review images" ON storage.objects;
CREATE POLICY "Public can view review images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'review-images');

DELETE FROM public.reviews
WHERE id = 'b7baa533-f6bf-4b31-8430-43b57cba2c6c';
