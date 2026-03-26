const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function testGeneration() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    console.log("Testing generateContent with gemini-1.5-flash...");
    
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hola, di hola' }] }]
    });
    
    console.log("Result Keys:", Object.keys(result));
    console.log("Result text property:", result.text);
    
  } catch (e) {
    console.error("Test failed:", e.message);
  }
}

testGeneration();
