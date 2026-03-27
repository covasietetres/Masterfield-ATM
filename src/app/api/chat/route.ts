import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Verificamos que las llaves existan antes de inicializar Supabase
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return NextResponse.json({ reply: "Error interno: Faltan credenciales del servidor." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const genAI = new GoogleGenerativeAI(geminiKey);

  try {

    const { message, prompt, engineerId, mode = 'terminal' } = await request.json();

    // Aceptamos "message" o "prompt" para no romper el frontend
    const userMessage = message || prompt;

    if (!userMessage) {
      return NextResponse.json({ reply: 'Por favor, ingresa una pregunta.' }, { status: 400 });
    }

    // 3. Extraer el conocimiento real de Supabase
    const { data: issues, error: issuesError } = await supabase.from('issues').select('title, symptom, fix');
    const { data: codes, error: codesError } = await supabase.from('codes').select('code, description');

    if (issuesError || codesError) {
      console.error("ERROR LEYENDO SUPABASE:", issuesError || codesError);
      return NextResponse.json({ reply: "Error conectando con la base de conocimientos." }, { status: 500 });
    }

    const contextText = `
      FALLAS DOCUMENTADAS: ${JSON.stringify(issues || [])}
      CÓDIGOS DE ERROR: ${JSON.stringify(codes || [])}
    `;

    // 4. Personalidades
    const terminalPrompt = `
      ERES EL EXPERTO TÉCNICO DE CAMPO PARA CAJEROS (NCR, DIEBOLD, GRG).
      TONO: Militar, técnico, preciso. Sin rodeos.
      REGLAS: Solo hechos, pasos numerados, lenguaje seco de terminal.
    `;

    const naturalPrompt = `
      ERES UN ASISTENTE TÉCNICO VIRTUAL (COMO ALEXA/DOLA).
      TONO: Extremadamente cordial, servicial, claro y profesional.
      ESTILO: Directo pero muy amable. Usa frases de cortesía ("Es un placer ayudarte", "Espero esto te sirva").
      META: Brindar una experiencia de soporte premium y fluida.
    `;

    const systemPrompt = `
      ${mode === 'natural' ? naturalPrompt : terminalPrompt}
      
      BASE DE CONOCIMIENTOS (ALTO SECRETO - MÁXIMA PRIORIDAD):
      ${contextText}
      
      REGLAS DE OPERACIÓN:
      1. SI LA INFORMACIÓN ESTÁ EN LA BASE DE CONOCIMIENTOS: Úsala obligatoriamente.
      2. PROTOCOLO MULTIMODAL: Tus respuestas deben ser visuales cuando sea posible.
      3. IDIOMA: ESPAÑOL.
      4. FORMATO: Usa Markdown para resaltar piezas o errores.
    `;

    const aiModel = genAI.getGenerativeModel({ model: "gemini-2.1-flash-lite" });

    const result = await aiModel.generateContent([
      { text: systemPrompt },
      { text: `CONSULTA DEL INGENIERO: ${userMessage}` }
    ]);

    const aiResponse = result.response.text() || '';

    // 6. Guardar en el historial de forma segura
    try {
      await supabase.from('query_history').insert({
        engineer_id: engineerId || 'Invitado',
        query_text: userMessage,
        response_text: aiResponse
      });
    } catch (e: any) {
      console.warn('Advertencia: No se pudo guardar el historial.', e.message);
    }

    // Devolvemos la respuesta
    return NextResponse.json({ response: aiResponse, reply: aiResponse });

  } catch (error) {
    console.error('ERROR GRAVE EN EL CHAT:', error);
    // Retornamos un mensaje amigable al frontend en caso de error masivo (ej. se cae el internet de la plataforma)
    return NextResponse.json({
      reply: "Lo siento, tuve un problema de conexión con los servidores. Por favor, intenta de nuevo en unos segundos."
    }, { status: 500 });
  }
}