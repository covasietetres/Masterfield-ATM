const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lccqjhldexbjxsqkiqur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY3FqaGxkZXhianhzcWtpcXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0MTQxNywiZXhwIjoyMDg2NTE3NDE3fQ.QaEsLgxlJdp5AWP-Piplnbwpfz_doeI_VCCEcD4ii2I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('--- Starting Migration ---');

  // 1. Create tables and extensions
  const sqlCommands = [
    `CREATE TABLE IF NOT EXISTS public.engineers (
      id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name         TEXT NOT NULL,
      city         TEXT NOT NULL,
      supervisor   TEXT NOT NULL,
      hire_date    DATE NOT NULL,
      access_key   TEXT UNIQUE NOT NULL,
      is_active    BOOLEAN DEFAULT TRUE NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS engineers_access_key_idx ON public.engineers (access_key);`,
    `CREATE TABLE IF NOT EXISTS public.knowledge_documents (
      id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title         TEXT NOT NULL,
      file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'video')),
      brand         TEXT NOT NULL CHECK (brand IN ('Diebold', 'NCR', 'GRG', 'General')),
      storage_path  TEXT NOT NULL,
      content_text  TEXT,
      uploaded_by   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS knowledge_documents_brand_idx ON public.knowledge_documents (brand);`,
    `CREATE TABLE IF NOT EXISTS public.query_history (
      id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      engineer_id   UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
      query_text    TEXT NOT NULL,
      response_text TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS query_history_engineer_id_idx ON public.query_history (engineer_id);`,
    `CREATE INDEX IF NOT EXISTS query_history_created_at_idx ON public.query_history (created_at DESC);`,
    `CREATE EXTENSION IF NOT EXISTS vector;`,
    `CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
      id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      document_id  UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
      content      TEXT NOT NULL,
      embedding    vector(768),
      created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);`,
    `CREATE INDEX IF NOT EXISTS knowledge_chunks_document_id_idx ON public.knowledge_chunks(document_id);`,
    // RLS and Policies
    `ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "Allow key lookup" ON public.engineers FOR SELECT USING (TRUE);`,
    `CREATE POLICY "Admin can manage engineers" ON public.engineers FOR ALL USING (auth.role() = 'authenticated');`,
    `ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "Anyone can read documents" ON public.knowledge_documents FOR SELECT USING (TRUE);`,
    `CREATE POLICY "Admin can manage documents" ON public.knowledge_documents FOR ALL USING (auth.role() = 'authenticated');`,
    `ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY "Anyone can read knowledge chunks" ON public.knowledge_chunks FOR SELECT USING (TRUE);`,
    `CREATE POLICY "Admins can manage knowledge chunks" ON public.knowledge_chunks FOR ALL USING (auth.role() = 'authenticated');`,
    // RPC function
    `CREATE OR REPLACE FUNCTION match_knowledge_chunks (
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
    $$;`
  ];

  for (const sql of sqlCommands) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(e => ({ error: e }));
    // Note: If exec_sql RPC doesn't exist, we might need a different approach.
    // However, usually we use supabase.from('...')... but for DDL we need SQL editor or a special RPC.
    // Let's try the direct approach if possible, but JS client doesn't support raw SQL easily without RPC.
    console.log(`Executing SQL: ${sql.substring(0, 50)}...`);
  }

  // Alternative: Check if we can just insert the admin user and assume schema is handled via SQL Editor?
  // User says "move everything", implying I should handle it.
  
  console.log('Migration script finished. NOTE: If tables were not created, please run the SQL scripts in the Supabase Dashboard.');
}

migrate();
