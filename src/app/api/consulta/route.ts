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
      .filter((w: string) => w.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) {
      return NextResponse.json({ sources: [] });
    }

    const orFilters = keywords
      .map((k: string) => `content.ilike.%${k}%`)
      .join(',');

    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('document_id, knowledge_documents(*)')
      .or(orFilters)
      .limit(20);

    if (error) throw error;

    const uniqueDocs = new Map();
    chunks?.forEach((c: any) => {
      if (c.knowledge_documents && !uniqueDocs.has(c.document_id)) {
        uniqueDocs.set(c.document_id, c.knowledge_documents);
      }
    });

    return NextResponse.json({ sources: Array.from(uniqueDocs.values()) });

  } catch (error: any) {
    console.error('[CONSULTA] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
