const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    const models = await ai.models.list();
    let output = "Available Models:\n";
    for await (const model of models) {
      output += model.name + "\n";
    }
    fs.writeFileSync('models_list.txt', output);
    console.log("Models saved to models_list.txt");
  } catch (e) {
    console.error("List failed:", e.message);
  }
}

listModels();
