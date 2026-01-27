/**
 * To run this server:
 * 1. Install dependencies: npm install ws @google/genai dotenv
 * 2. Set API_KEY (Gemini) in your environment variables.
 * 3. Run: npm start
 */

const { WebSocketServer } = require('ws');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

console.log(`Translation Server (Web Speech API + Gemini) running on port ${port}`);

// Initialize Gemini
// We do this per request or globally. Globally is fine for Flash model.
// But we need the API Key to be present.
if (!process.env.API_KEY) {
  console.error("WARNING: API_KEY is missing. Translation will fail.");
}

wss.on('connection', (ws, req) => {
  console.log(`Client connected from ${req.socket.remoteAddress}`);

  // We can re-instantiate Gemini per client if we want unique sessions/history, 
  // but for simple translation, one instance is okay if stateless.
  // However, to be safe and allow hot-swapping keys if needed, let's create it inside.
  let ai = null;
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'config') {
        // Verify key availability
        if (!process.env.API_KEY) {
          ws.send(JSON.stringify({ type: 'error', message: 'Server API_KEY missing' }));
        } else {
          ws.send(JSON.stringify({ type: 'connected' }));
        }
      }
      else if (message.type === 'text_input') {
        const { text, sourceLang, targetLang } = message.data;

        if (!text || text.trim().length === 0) return;
        if (!ai) {
          ws.send(JSON.stringify({ type: 'error', message: 'Server API_KEY error' }));
          return;
        }

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following ${sourceLang} text to ${targetLang} naturally for subtitles. Only output the translation, nothing else.\n\nText: "${text}"`,
          });

          const translatedText = response.text;

          if (translatedText) {
            ws.send(JSON.stringify({
              type: 'text',
              content: translatedText
            }));
            ws.send(JSON.stringify({ type: 'turn_complete' }));
          }
        } catch (err) {
          console.error("Translation Error:", err.message);
          ws.send(JSON.stringify({ type: 'error', message: 'Translation failed' }));
        }
      }

    } catch (e) {
      console.error('Server Logic Error:', e.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
    }
  });
});
