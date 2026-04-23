-- Create technical_sites table
CREATE TABLE IF NOT EXISTS public.technical_sites (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL,
  how_to_get    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for name search
CREATE INDEX IF NOT EXISTS technical_sites_name_idx ON public.technical_sites (name);

-- RLS
ALTER TABLE public.technical_sites ENABLE ROW LEVEL SECURITY;

-- Anyone can read/search
CREATE POLICY "Anyone can read sites" ON public.technical_sites
  FOR SELECT USING (TRUE);

-- Only authenticated users (admins) can register/modify sites
CREATE POLICY "Admin can manage sites" ON public.technical_sites
  FOR ALL USING (auth.role() = 'authenticated');
