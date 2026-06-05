CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
ON public.reviews FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert reviews"
ON public.reviews FOR INSERT
WITH CHECK (
  length(trim(name)) BETWEEN 1 AND 80
  AND length(trim(content)) BETWEEN 1 AND 1000
);

CREATE POLICY "Admin can delete reviews"
ON public.reviews FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'netzah09@gmail.com'::text);