const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const genAI = new GoogleGenAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
  
  try {
    console.log("Testing Embedding...");
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" }); // Standard embedding
    const result = await embedModel.embedContent("test");
    console.log("Embedding success:", !!result.embedding);

    console.log("Testing Chat Model (gemini-1.5-flash)...");
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chatResult = await chatModel.generateContent("Say hello");
    console.log("Chat success:", chatResult.response.text());
  } catch (e) {
    console.error("Test failed:", e.message);
  }
}

test();
