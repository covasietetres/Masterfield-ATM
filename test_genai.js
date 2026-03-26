const { GoogleGenAI } = require('@google/genai');

async function main() {
  try {
    const ai = new GoogleGenAI({ apiKey: 'AIzaSyDgECKjo2I9U8S20CABHDEYYxGa3tTZC7c' });
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'hola',
    });
    console.log(result.text);
  } catch (err) {
    console.error('ERROR EN GENAI:', err);
  }
}
main();
