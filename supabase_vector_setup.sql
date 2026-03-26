-- ====================================================================
-- ATM Field Master - Vector Database Setup for Knowledge Base (RAG)
-- Run this script in the Supabase SQL Editor
-- ====================================================================

-- 1. Enable the pgvector extension for embedding math
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the knowledge_chunks table
-- This stores the individual paragraphs from your PDFs/Manuals
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id  UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    vector(768), -- 768 dimensions for Google's text-embedding-004
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create an index for fast vector similarity searches (HNSW)
-- This allows the database to quickly find the most relevant chunks of text
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON public.knowledge_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Index the foreign key for faster joins
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_id_idx ON public.knowledge_chunks(document_id);

-- 4. Set up Row Level Security (RLS) for the chunks table
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Anyone (including engineers via the app) can read the chunks
CREATE POLICY "Anyone can read knowledge chunks" ON public.knowledge_chunks
  FOR SELECT USING (TRUE);

-- Only authenticated users (admins uploading PDFs) can insert/update/delete
CREATE POLICY "Admins can manage knowledge chunks" ON public.knowledge_chunks
  FOR ALL USING (auth.role() = 'authenticated');

-- 5. Create the Vector Search Function (RPC)
-- This function is called by the Next.js API to find the most relevant manuals
CREATE OR REPLACE FUNCTION match_knowledge_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_chunks.id,
    knowledge_chunks.document_id,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
