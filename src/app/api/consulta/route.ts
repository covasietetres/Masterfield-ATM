import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 });
  }

  try {
    const { query } = await request.json();

    if (!query || query.trim().length < 3) {
      return NextResponse.json({ sources: [] });
    }

    const keywords = query
      .split(/\s+/)
      .filter((w: string) => w.length >= 2) // Admitir palabras como 'ODS'
      .slice(0, 5);

    if (keywords.length === 0) {
      return NextResponse.json({ sources: [] });
    }

    const orFilters = keywords
      .map((k: string) => `content.ilike.%${k}%`)
      .join(',');

    const titleFilters = keywords
      .map((k: string) => `title.ilike.%${k}%`)
      .join(',');

    // 1. Buscar en fragmentos (chunks)
    const { data: chunks, error: chunksError } = await supabase
      .from('knowledge_chunks')
      .select('document_id, knowledge_documents(*)')
      .or(orFilters)
      .limit(20);

    // 2. Buscar por título (documentos directos)
    const { data: docsByTitle, error: docsError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .or(titleFilters)
      .limit(10);

    if (chunksError || docsError) throw (chunksError || docsError);

    const uniqueDocs = new Map();

    // Agregar documentos encontrados por fragmento
    chunks?.forEach((c: any) => {
      if (c.knowledge_documents && !uniqueDocs.has(c.document_id)) {
        uniqueDocs.set(c.document_id, c.knowledge_documents);
      }
    });

    // Agregar documentos encontrados por título
    docsByTitle?.forEach((doc: any) => {
      if (!uniqueDocs.has(doc.id)) {
        uniqueDocs.set(doc.id, doc);
      }
    });

    return NextResponse.json({ sources: Array.from(uniqueDocs.values()) });

  } catch (error: any) {
    console.error('[CONSULTA] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
