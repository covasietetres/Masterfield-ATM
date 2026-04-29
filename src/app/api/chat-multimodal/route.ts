import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Clientes ─────────────────────────────────────────────────────────────────
// ── Configuración ─────────────────────────────────────────────────────────────
const MODELO_CHAT      = 'gemini-1.5-flash';
const MODELO_EMBEDDING = 'text-embedding-004';

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

// ── POST /api/chat-multimodal ─────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = getSupabase();
  const genAI = getGenAI();

  if (!supabase || !genAI) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta (Variables de entorno).' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { message, imageBase64, imageMimeType, engineerId } = body;

    if (!message && !imageBase64) {
      return NextResponse.json(
        { error: 'Se requiere un mensaje o una imagen.' },
        { status: 400 }
      );
    }

    // ── 1. Buscar contexto en la base de conocimiento (sin costo de API) ─────
    let contextText = '';
    let usedManuals = false;

    if (message && message.trim().length > 3) {
      try {
        const keywords = message
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
          .slice(0, 5);

        if (keywords.length > 0) {
          const orFilters = keywords
            .map((k: string) => `content.ilike.%${k}%`)
            .join(',');

          const { data: chunks } = await supabase
            .from('knowledge_chunks')
            .select('content, document_id, knowledge_documents(*)')
            .or(orFilters)
            .limit(8);

          if (chunks && chunks.length > 0) {
            contextText = chunks
              .map((c: any) => `[MANUAL]: ${c.content}`)
              .join('\n---\n');
            usedManuals = true;

            const uniqueDocs = new Map();
            chunks.forEach((c: any) => {
              if (c.knowledge_documents && !uniqueDocs.has(c.document_id)) {
                uniqueDocs.set(c.document_id, c.knowledge_documents);
              }
            });
            body.sources = Array.from(uniqueDocs.values());
          }
        }
      } catch (searchErr: any) {
        console.warn('[DOLA] Búsqueda de contexto fallida:', searchErr.message);
      }
    }

    // ── 2. Construir prompt del sistema ──────────────────────────────────────
    const systemText = `ERES DOLA, LA ASISTENTE TÉCNICA DE ÉLITE PARA INGENIEROS DE CAMPO DE CAJEROS AUTOMÁTICOS (NCR, DIEBOLD, GRG).

TU MISIÓN: Resolver problemas técnicos en el menor tiempo posible, evitando que el ingeniero pierda tiempo leyendo manuales extensos.

PERSONALIDAD: Profesional, técnica, concisa y sumamente eficiente. Hablas como un ingeniero senior asesorando a un colega en el sitio.

${usedManuals
  ? `INFORMACIÓN TÉCNICA EXTRAÍDA (ÚSALA COMO PRIORIDAD ABSOLUTA):\n${contextText}`
  : `NOTA: No hay manuales específicos para esta consulta. Responde basándote en tu conocimiento experto de hardware ATM.`
}

REGLAS DE RESPUESTA:
1. SÉ CONCISO: No saludes excesivamente. Ve directo a la falla y la solución.
2. PASOS ACCIONABLES: Presenta la solución en una lista numerada de pasos físicos (ej. "1. Abre la puerta del dispensador...", "2. Verifica el sensor S1...").
3. REFERENCIA: Si usas manuales, menciona brevemente la fuente (ej. "Según el manual del NCR 6622...").
4. ANÁLISIS VISUAL: Si hay una imagen, identifícala primero: "Veo un error de atasco en el transporte de billetes..." y luego da la solución.
5. CERO CARACTERES ESPECIALES: Evita markdown complejo (*, #, _) para que el lector de voz (TTS) no se confunda. Usa texto plano limpio.
6. IDIOMA: Español técnico de Latinoamérica/España.`;

    const parts: any[] = [
      { text: systemText },
      { text: `CONSULTA DEL INGENIERO: ${message || 'Analiza el archivo adjunto y describe el problema.'}` },
    ];

    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: { data: imageBase64, mimeType: imageMimeType },
      });
    }

    const aiModel = genAI.getGenerativeModel({ model: MODELO_CHAT });
    const result = await aiModel.generateContent(parts);

    const aiResponse = result.response.text() || 'No pude generar una respuesta. Por favor, intenta de nuevo.';

    try {
      await supabase.from('query_history').insert({
        engineer_id: engineerId || null,
        query_text: message || '[Consulta visual]',
        response_text: aiResponse,
      });
    } catch (histErr: any) {
      console.warn('[DOLA] No se pudo guardar en historial:', histErr.message);
    }

    return NextResponse.json({ 
      response: aiResponse, 
      usedManuals,
      sources: body.sources || [] 
    });

  } catch (error: any) {
    console.error('[DOLA] Error en chat-multimodal:', error);
    const msg: string = error?.message || JSON.stringify(error);

    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return NextResponse.json(
        { error: 'Límite de cuota de Gemini alcanzado. Por favor espera 1 minuto e intenta de nuevo.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: 'Error interno del servidor. Revisa la consola para más detalles.' },
      { status: 500 }
    );
  }
}
