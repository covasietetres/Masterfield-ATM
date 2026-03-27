import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Clientes ─────────────────────────────────────────────────────────────────
// ── Configuración ─────────────────────────────────────────────────────────────
const MODELO_CHAT      = 'gemini-2.5-flash-lite';
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
            .select('content')
            .or(orFilters)
            .limit(8);

          if (chunks && chunks.length > 0) {
            contextText = chunks
              .map((c: any) => `[MANUAL]: ${c.content}`)
              .join('\n---\n');
            usedManuals = true;
          }
        }
      } catch (searchErr: any) {
        console.warn('[DOLA] Búsqueda de contexto fallida:', searchErr.message);
      }
    }

    // ── 2. Construir prompt del sistema ──────────────────────────────────────
    const systemText = `ERES DOLA, EXPERTA TÉCNICA EN CAJEROS AUTOMÁTICOS (NCR, DIEBOLD, GRG).

PERSONALIDAD: Cordial, directa y extremadamente precisa. Combinas la calidez de una asistente virtual con el conocimiento técnico de un ingeniero senior.

${usedManuals
  ? `BASE DE CONOCIMIENTO DISPONIBLE (ÚSALA COMO PRIMERA FUENTE):\n${contextText}`
  : `NOTA: No se encontraron manuales relevantes. Usa tu base de conocimiento interna sobre ATMs.`
}

REGLAS ABSOLUTAS:
1. SIEMPRE prioriza la información de los manuales sobre conocimiento general.
2. Si hay imagen: analiza PRIMERO el problema visual, luego apóyate en los manuales.
3. Da pasos numerados, claros y concisos.
4. Si no sabes algo, dilo directamente: "No tengo información sobre eso en los manuales."
5. IDIOMA: Español únicamente. Jamás respondas en inglés.
6. Responde en texto corrido, sin markdown excesivo, optimizado para ser leído en voz alta.`;

    // ── 3. Armar partes del contenido ────────────────────────────────────────
    const parts: any[] = [
      { text: systemText },
      { text: `CONSULTA DEL INGENIERO: ${message || 'Analiza el archivo adjunto y describe el problema.'}` },
    ];

    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: { data: imageBase64, mimeType: imageMimeType },
      });
    }

    // ── 4. Llamar a Gemini ───────────────────────────────────────────────────
    const aiModel = genAI.getGenerativeModel({ model: MODELO_CHAT });
    const result = await aiModel.generateContent(parts);

    const aiResponse = result.response.text() || 'No pude generar una respuesta. Por favor, intenta de nuevo.';

    // ── 5. Guardar en historial ──────────────────────────────────────────────
    try {
      await supabase.from('query_history').insert({
        engineer_id: engineerId || null,
        query_text: message || '[Consulta visual]',
        response_text: aiResponse,
      });
    } catch (histErr: any) {
      console.warn('[DOLA] No se pudo guardar en historial:', histErr.message);
    }

    return NextResponse.json({ response: aiResponse, usedManuals });

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
