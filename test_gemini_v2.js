const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function testGeneration() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    console.log("Testing generateContent with gemini-2.5-flash-lite...");
    
    // Trying with the full name as returned by list()
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: 'Hola, di hola en una palabra' }] }]
    });
    
    console.log("Success! AI Response:", result.text);
    
  } catch (e) {
    console.error("Test failed:", e.message);
    if (e.stack) console.error(e.stack);
  }
}

testGeneration();
