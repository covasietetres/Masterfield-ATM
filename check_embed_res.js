const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function checkFormatC() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: 'test',
    });
    console.log("Result Keys:", Object.keys(res));
    if (res.embeddings) {
        console.log("res.embeddings type:", Array.isArray(res.embeddings) ? "Array" : typeof res.embeddings);
        if (res.embeddings[0]) console.log("res.embeddings[0] Keys:", Object.keys(res.embeddings[0]));
    }
  } catch (e) { console.error(e); }
}

checkFormatC();
