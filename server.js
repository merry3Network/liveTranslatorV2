/**
 * To run this server:
 * 1. Install dependencies: npm install ws @google/genai dotenv
 * 2. Set API_KEY (Gemini) in your environment variables.
 * 3. Run: npm start
 */

const { WebSocketServer } = require('ws');
const { GoogleGenAI } = require('@google/genai');
const deepl = require('deepl-node');
require('dotenv').config();

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

// Helper to sanitize keys from .env (handles whitespace and surrounding quotes)
const sanitizeKey = (key) => {
  if (!key) return "";
  return key.trim().replace(/^["']|["']$/g, '');
};

console.log(`Translation Server (Web Speech API + Gemini) running on port ${port}`);

// Initialize Gemini
// We do this per request or globally. Globally is fine for Flash model.
// But we need the API Key to be present.
if (!process.env.API_KEY) {
  console.error("WARNING: API_KEY (Gemini) is missing. Persona translations will fail.");
}
if (!process.env.DEEPL_API_KEY) {
  console.error("WARNING: DEEPL_API_KEY is missing. Standard translations will fail.");
}

// DeepL Language Mapping (to DeepL ISO codes)
const deeplLangMap = {
  'Japanese': 'ja',
  'English': 'en-US',
  'Spanish': 'es',
  'Chinese': 'zh',
  'Korean': 'ko',
  'French': 'fr',
  'German': 'de'
};

wss.on('connection', (ws, req) => {
  console.log(`Client connected from ${req.socket.remoteAddress}`);

  // We can re-instantiate Gemini per client if we want unique sessions/history, 
  // but for simple translation, one instance is okay if stateless.
  // However, to be safe and allow hot-swapping keys if needed, let's create it inside.
  let ai = null;
  const geminiKey = sanitizeKey(process.env.API_KEY || process.env.GEMINI_API_KEY);
  if (geminiKey && !geminiKey.includes("your_gemini_api_key_here")) {
    ai = new GoogleGenAI({ apiKey: geminiKey });
  }

  let translator = null;
  const deeplKey = sanitizeKey(process.env.DEEPL_API_KEY);
  if (deeplKey && !deeplKey.includes("your_deepl_api_key_here")) {
    try {
      translator = new deepl.Translator(deeplKey);
      const isFree = deeplKey.endsWith(':fx');
      console.log(`DeepL: Initialized with ${isFree ? 'Free (:fx)' : 'Pro'} key.`);
    } catch (err) {
      console.error("DeepL Initialization failed:", err.message);
    }
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'config') {
        const hasGemini = !!ai;
        const hasDeepL = !!translator;
        console.log(`Session config: Persona=${message.data.persona}, GeminiReady=${hasGemini}, DeepLReady=${hasDeepL}`);

        ws.persona = message.data.persona;
        ws.send(JSON.stringify({ type: 'connected', data: { hasGemini, hasDeepL } }));
      }
      else if (message.type === 'text_input') {
        const { text, sourceLang, targetLang, persona } = message.data;
        console.log(`Translate Request: "${text}" [${sourceLang} -> ${targetLang}] Persona: ${persona}`);

        if (!text || text.trim().length === 0) return;

        try {
          let translatedText = '';

          // ROUTING: If no persona, use DeepL. If persona, use Gemini.
          if (!persona || persona === 'none') {
            if (!translator) {
              const keyPresent = !!process.env.DEEPL_API_KEY;
              ws.send(JSON.stringify({
                type: 'error',
                message: keyPresent ? 'DeepL auth error. Check if your key is Free (:fx) or Pro.' : 'DeepL API Key (DEEPL_API_KEY) is missing.'
              }));
              return;
            }
            console.log(`Using DeepL for standard translation`);
            const targetCode = deeplLangMap[targetLang] || 'en-US';
            const result = await translator.translateText(text, null, targetCode);
            translatedText = result.text;
          } else {
            console.log(`Using Gemini for persona: ${persona}`);
            if (!ai) {
              ws.send(JSON.stringify({ type: 'error', message: 'Gemini API Key missing or error' }));
              return;
            }

            let systemInstruction = `Translate the following ${sourceLang} text to ${targetLang} naturally for subtitles. Only output the translation, nothing else.`;

            switch (persona) {
              case 'samurai':
                systemInstruction += " Use archaic Japanese (samurai style), using words like 'でござる' or '某'.";
                break;
              case 'tsundere':
                systemInstruction += " Use a tsundere personality (harsh but sometimes soft), common in anime.";
                break;
              case 'cat':
                systemInstruction += " Translate with a cat-like personality, adding 'にゃ' or 'にゃん' to sentences.";
                break;
              case 'butler':
                systemInstruction += " Use extremely polite and formal language suitable for a butler serving a master.";
                break;
            }

            const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash', // Corrected from gemini-2.5-flash which doesn't exist yet
              contents: `${systemInstruction}\n\nText: "${text}"`,
            });
            translatedText = response.text;
          }

          if (translatedText) {
            ws.send(JSON.stringify({
              type: 'text',
              content: translatedText
            }));
            ws.send(JSON.stringify({ type: 'turn_complete' }));
          }
        } catch (err) {
          console.error("Translation Error:", err);
          ws.send(JSON.stringify({ type: 'error', message: 'Translation failed: ' + err.message }));
        }
      }

    } catch (e) {
      console.error('Server Logic Error:', e.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
    }
  });
});
