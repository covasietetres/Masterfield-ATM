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

    const finalDocs = Array.from(uniqueDocs.values());

    // 3. RECONSTRUCCIÓN AVANZADA: Si el texto completo es nulo o muy corto, reconstruir desde chunks
    console.log(`[CONSULTA] Procesando ${finalDocs.length} documentos únicos...`);
    
    for (const doc of finalDocs) {
      const hasText = doc.content_text && doc.content_text.trim().length > 100;
      
      if (!hasText) {
        console.log(`[CONSULTA] Documento "${doc.title}" sin texto completo. Intentando reconstruir...`);
        const { data: allChunks, error: recError } = await supabase
          .from('knowledge_chunks')
          .select('content')
          .eq('document_id', doc.id);
        
        if (recError) {
          console.error(`[CONSULTA] Error recuperando chunks para ${doc.id}:`, recError);
          continue;
        }

        if (allChunks && allChunks.length > 0) {
          console.log(`[CONSULTA] Reconstruidos ${allChunks.length} fragmentos para "${doc.title}"`);
          doc.content_text = allChunks.map((ch: any) => ch.content).join('\n\n');
        } else {
          console.warn(`[CONSULTA] No se encontraron fragmentos (chunks) para el documento ${doc.id}`);
        }
      }
    }

    return NextResponse.json({ sources: finalDocs });

  } catch (error: any) {
    console.error('[CONSULTA] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
