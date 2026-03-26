const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function diagnose() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    
    console.log("1. Testing Embedding...");
    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: ['test message'],
    });
    console.log("Embedding response received.");

    console.log("2. Testing Content Generation (gemini-1.5-flash)...");
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hola' }] }]
    });
    console.log("AI Response:", result.text);
    
    console.log("DIAGNOSIS COMPLETE: Success.");
  } catch (error) {
    console.error("DIAGNOSIS FAILED:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

diagnose();
