const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function inspect() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    console.log("AI Keys:", Object.keys(ai));
    if (ai.models) {
      console.log("ai.models Keys:", Object.keys(ai.models));
    }
  } catch (e) {
    console.error("Inspect failed:", e.message);
  }
}

inspect();
