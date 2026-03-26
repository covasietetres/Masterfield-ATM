const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function testEmbedding() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    console.log("Testing embedContent with gemini-embedding-001...");
    
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: ['Este es un texto de prueba para el asesor técnico.'],
    });
    
    console.log("Success! Embedding length:", result.embeddings[0].values.length);
    
  } catch (e) {
    console.error("Embedding test failed:", e.message);
    if (e.stack) console.error(e.stack);
  }
}

testEmbedding();
