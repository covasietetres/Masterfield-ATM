-- ============================================
-- ATM Field Master - Supabase Migration
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Engineers table (key-based auth, managed by admins)
CREATE TABLE IF NOT EXISTS public.engineers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  city         TEXT NOT NULL,
  supervisor   TEXT NOT NULL,
  hire_date    DATE NOT NULL,
  access_key   TEXT UNIQUE NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast key lookup (login)
CREATE UNIQUE INDEX IF NOT EXISTS engineers_access_key_idx ON public.engineers (access_key);

-- 2. Knowledge documents table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'video')),
  brand         TEXT NOT NULL CHECK (brand IN ('Diebold', 'NCR', 'GRG', 'General')),
  storage_path  TEXT NOT NULL,
  content_text  TEXT,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for brand filtering
CREATE INDEX IF NOT EXISTS knowledge_documents_brand_idx ON public.knowledge_documents (brand);

-- 3. Query history table
CREATE TABLE IF NOT EXISTS public.query_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id   UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  query_text    TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS query_history_engineer_id_idx ON public.query_history (engineer_id);
CREATE INDEX IF NOT EXISTS query_history_created_at_idx ON public.query_history (created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Engineers: public read for login (key lookup), admin manages
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

-- Allow unauthenticated to look up by key (needed for engineer login)
CREATE POLICY "Allow key lookup" ON public.engineers
  FOR SELECT USING (TRUE);

-- Only authenticated admins can insert/update/delete
CREATE POLICY "Admin can manage engineers" ON public.engineers
  FOR ALL USING (auth.role() = 'authenticated');

-- Knowledge documents: anyone can read, only admins write
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read documents" ON public.knowledge_documents
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin can manage documents" ON public.knowledge_documents
  FOR ALL USING (auth.role() = 'authenticated');

-- Query history: open insert for engineers (no auth), admins read all
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert query history" ON public.query_history
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admin can read query history" ON public.query_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- Storage Buckets
-- Create these manually in Supabase Dashboard > Storage:
-- 1. "manuals" - for PDFs (public)
-- 2. "media" - for images/videos (public)
-- Or run:
-- ============================================

-- Enable storage (run these only if you have storage enabled):
INSERT INTO storage.buckets (id, name, public) 
  VALUES ('manuals', 'manuals', TRUE)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('media', 'media', TRUE)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read manuals" ON storage.objects
  FOR SELECT USING (bucket_id = 'manuals');

CREATE POLICY "Admin upload manuals" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'manuals' AND auth.role() = 'authenticated');

CREATE POLICY "Admin delete manuals" ON storage.objects
  FOR DELETE USING (bucket_id = 'manuals' AND auth.role() = 'authenticated');

CREATE POLICY "Public read media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Admin upload media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Admin delete media" ON storage.objects
  FOR DELETE USING (bucket_id = 'media' AND auth.role() = 'authenticated');

-- ============================================
-- DEFAULT ADMIN USER
-- Email:    admin@atmfieldmaster.com
-- Password: Admin@2025
-- Change the password after first login!
-- ============================================

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@atmfieldmaster.com') THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'admin@atmfieldmaster.com',
      crypt('Admin@2025', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Administrador"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      json_build_object('sub', new_user_id::text, 'email', 'admin@atmfieldmaster.com'),
      'email',
      'admin@atmfieldmaster.com', -- provider_id is required and usually the email for email provider
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
END $$;
