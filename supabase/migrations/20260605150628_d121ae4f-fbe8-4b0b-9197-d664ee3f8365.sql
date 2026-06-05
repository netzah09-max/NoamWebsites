
-- 1) Validate requests inserts
DROP POLICY IF EXISTS "Anyone can insert requests" ON public.requests;
CREATE POLICY "Anyone can insert requests"
ON public.requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(full_name)) BETWEEN 1 AND 120
  AND length(trim(phone)) BETWEEN 3 AND 30
  AND length(trim(need)) BETWEEN 1 AND 200
  AND length(trim(description)) BETWEEN 1 AND 2000
  AND (plan IS NULL OR length(plan) <= 80)
  AND (email IS NULL OR (length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
);

-- 2) Restrict review-images uploads: images only, <= 5MB
DROP POLICY IF EXISTS "Anyone can upload review images" ON storage.objects;
CREATE POLICY "Anyone can upload review images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'review-images'
  AND (lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'))
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
  AND coalesce(metadata->>'mimetype','') LIKE 'image/%'
);

-- 3) Remove broad listing on public bucket; individual files remain accessible via public URL
DROP POLICY IF EXISTS "Public can view review images" ON storage.objects;
