import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';


// ── Clientes ─────────────────────────────────────────────────────────────────
// ── Clientes Lazy ────────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getGenAI() {
  const key = process.env.GEMINI_API_KEY!;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// ── Chunking: divide el texto en partes con overlap ──────────────────────────
function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

// ── POST /api/ingest ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const genAI = getGenAI();

  if (!supabase || !genAI) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta (Variables de entorno).' }, { status: 500 });
  }

  try {
    const { documentId, bucket, path, fileType } = await request.json();

    if (!documentId || !bucket || !path) {
      return NextResponse.json({ error: 'Faltan campos requeridos: documentId, bucket o path.' }, { status: 400 });
    }

    // ── 1. Descargar archivo desde Supabase Storage ──────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileData) {
      throw new Error(`Error al descargar el archivo: ${downloadError?.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let extractedText = '';

    // ── 2. Extraer texto según tipo de archivo ────────────────────────────────
    console.log(`[INGEST] Extrayendo texto para tipo: ${fileType}`);

    if (fileType === 'pdf' || fileType === 'image' || fileType === 'video') {
      const mimeType =
        fileType === 'pdf' ? 'application/pdf' :
        fileType === 'image' ? 'image/jpeg' : 'video/mp4';

      const prompt = `ACTÚA COMO UN ESCÁNER DE DOCUMENTOS TÉCNICOS.
REGLAS:
- PARA PDF: Extrae CADA PALABRA, código de error y símbolo. Transcripción literal 1:1. No omitas nada.
- PARA IMAGEN/VIDEO: Describe de forma técnica lo que ves. Ejemplo: "Placa verde, conector J1 desconectado, LED rojo encendido".
- PROHIBIDO: No uses frases como "En esta imagen...", "Se observa...", "El manual indica...".
- COMIENZA DIRECTAMENTE CON EL CONTENIDO.
- SIN SALUDOS, SIN DESPEDIDAS, SIN MARKDOWN.`;

      const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

      const result = await visionModel.generateContent([
        { text: prompt },
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType,
          },
        },
      ]);

      extractedText = result.response.text() || '';
      console.log(`[INGEST] Extraídos ${extractedText.length} caracteres de ${fileType}.`);

    } else {
      // Archivos de texto plano (.txt, .csv, etc.)
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del archivo.' }, { status: 400 });
    }

    // ── 3. Guardar texto extraído en el documento ─────────────────────────────
    await supabase
      .from('knowledge_documents')
      .update({ content_text: extractedText })
      .eq('id', documentId);

    // ── 4. Dividir en chunks y generar embeddings ─────────────────────────────
    const chunks = chunkText(extractedText);
    console.log(`[INGEST] Generando embeddings para ${chunks.length} chunks...`);

    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    let processed = 0;

    for (const chunk of chunks) {
      if (chunk.trim().length < 10) continue;

      try {
        const embeddingResult = await embeddingModel.embedContent(chunk);
        const embedding = embeddingResult.embedding?.values;

        if (!embedding || embedding.length === 0) {
          console.warn('[INGEST] Embedding vacío, se omite chunk.');
          continue;
        }

        await supabase.from('knowledge_chunks').insert({
          document_id: documentId,
          content: chunk,
          embedding,
        });

        processed++;
      } catch (embedError: any) {
        console.error(`[INGEST] Error en embedding de chunk: ${embedError.message}`);
        // Continúa con los demás chunks aunque uno falle
      }
    }

    console.log(`[INGEST] Completado. ${processed} de ${chunks.length} chunks procesados.`);
    return NextResponse.json({ success: true, chunksProcessed: processed });

  } catch (error: any) {
    console.error('[INGEST] Error general:', error);

    const msg = error.message || '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return NextResponse.json(
        { error: 'Límite de cuota de Gemini alcanzado. Espera 1 minuto e intenta de nuevo.' },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: msg || 'Error interno del servidor.' }, { status: 500 });
  }
}
