const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    const models = await ai.models.list();
    console.log("Available Models:");
    for await (const model of models) {
      console.log(model.name);
    }
  } catch (e) {
    console.error("List failed:", e.message);
  }
}

listModels();
