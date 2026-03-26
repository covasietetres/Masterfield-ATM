const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function testEmbedding() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    console.log("Testing embedContent with alternative format...");
    
    // Format A: contents as array of objects with parts
    try {
      console.log("A. Trying contents: [{ parts: [{ text: '...' }] }]");
      const resA = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: [{ parts: [{ text: 'test' }] }],
      });
      console.log("A Success!");
    } catch (e) { console.log("A Failed:", e.message); }

    // Format B: content: '...'
    try {
      console.log("B. Trying content: 'test'");
      const resB = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        content: 'test',
      });
      console.log("B Success!");
    } catch (e) { console.log("B Failed:", e.message); }

    // Format C: contents: 'test'
    try {
      console.log("C. Trying contents: 'test'");
      const resC = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: 'test',
      });
      console.log("C Success!");
    } catch (e) { console.log("C Failed:", e.message); }

  } catch (e) {
    console.error("Test failed:", e.message);
  }
}

testEmbedding();
