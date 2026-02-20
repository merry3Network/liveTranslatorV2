/**
 * To run this server:
 * 1. Install dependencies: npm install ws @google/genai dotenv
 * 2. Set GEMINI_API_KEYS (comma-separated for rotation) or API_KEY in your environment variables.
 * 3. Run: npm start
 */

const { WebSocketServer } = require('ws');
const { GoogleGenAI } = require('@google/genai');
const deepl = require('deepl-node');
require('dotenv').config();

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

const sanitizeKey = (key) => {
  if (!key) return "";
  return key.trim().replace(/^["']|["']$/g, '');
};

const parseApiKeys = () => {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.API_KEYS;
  if (keysEnv) {
    return keysEnv.split(',').map(k => sanitizeKey(k)).filter(k => k && !k.includes("your_gemini_api_key_here"));
  }
  const singleKey = sanitizeKey(process.env.API_KEY || process.env.GEMINI_API_KEY);
  if (singleKey && !singleKey.includes("your_gemini_api_key_here")) {
    return [singleKey];
  }
  return [];
};

const ENABLE_MOCK = process.env.ENABLE_MOCK === 'true';
const GEMINI_RPM = parseInt(process.env.GEMINI_RPM || '5', 10);
const GEMINI_RPD = parseInt(process.env.GEMINI_RPD || '20', 10);

const geminiKeys = parseApiKeys();

console.log(`Translation Server (Web Speech API + Gemini) running on port ${port}`);

if (ENABLE_MOCK) {
  console.log('🎭 MOCK MODE ENABLED - No real API calls will be made');
}

if (geminiKeys.length === 0 && !ENABLE_MOCK) {
  console.error("WARNING: No valid Gemini API keys found. Persona translations will fail.");
} else if (geminiKeys.length > 0) {
  console.log(`🔑 Loaded ${geminiKeys.length} Gemini API key(s) | Rate limits: ${GEMINI_RPM} RPM / ${GEMINI_RPD} RPD per key`);
  console.log(`   Effective total: ${geminiKeys.length * GEMINI_RPM} RPM / ${geminiKeys.length * GEMINI_RPD} RPD`);
}

if (!process.env.DEEPL_API_KEY) {
  console.error("WARNING: DEEPL_API_KEY is missing. Standard translations will fail.");
}

const deeplLangMap = {
  'Japanese': 'ja',
  'English': 'en-US',
  'Spanish': 'es',
  'Chinese': 'zh',
  'Korean': 'ko',
  'French': 'fr',
  'German': 'de'
};

const mockPersonaStyles = {
  'samurai': (text) => {
    const endings = ['でござる', 'である', 'じゃ'];
    const ending = endings[Math.floor(Math.random() * endings.length)];
    return text.replace(/です/g, ending).replace(/ます/g, 'まする') + '...某もそう思うでござる。';
  },
  'tsundere': (text) => {
    const prefixes = ['べ、別に...', 'あんたのために翻訳したわけじゃないんだから！', 'ちゅ、ちゅういしてあげるわよ... '];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return prefix + text;
  },
  'cat': (text) => {
    const catEndings = ['にゃ', 'にゃん', 'ニャ'];
    const ending = catEndings[Math.floor(Math.random() * catEndings.length)];
    return text + ending + '🐱';
  },
  'butler': (text) => {
    return 'お客様、' + text.replace(/です/g, 'でございます').replace(/ます/g, 'ます') + '...何かご用命があればお申し付けくださいませ。';
  }
};

function mockTranslate(text, sourceLang, targetLang, persona) {
  let result = text;
  if (persona && persona !== 'none' && mockPersonaStyles[persona]) {
    result = mockPersonaStyles[persona](text);
  }
  return `[MOCK] ${result}`;
}

class RateLimiter {
  constructor(rpm, rpd) {
    this.rpm = rpm;
    this.rpd = rpd;
    this.minuteRequests = [];
    this.dayRequests = [];
  }

  check() {
    const now = Date.now();
    this.minuteRequests = this.minuteRequests.filter(t => now - t < 60000);
    this.dayRequests = this.dayRequests.filter(t => now - t < 86400000);
    return {
      allowed: this.minuteRequests.length < this.rpm && this.dayRequests.length < this.rpd,
      minuteRemaining: Math.max(0, this.rpm - this.minuteRequests.length),
      dayRemaining: Math.max(0, this.rpd - this.dayRequests.length),
      minuteResetIn: this.minuteRequests.length > 0 ? Math.max(0, 60000 - (now - this.minuteRequests[0])) : 0,
      dayResetIn: this.dayRequests.length > 0 ? Math.max(0, 86400000 - (now - this.dayRequests[0])) : 0,
      minuteUsed: this.minuteRequests.length,
      dayUsed: this.dayRequests.length
    };
  }

  record() {
    const now = Date.now();
    this.minuteRequests.push(now);
    this.dayRequests.push(now);
  }

  getStatus() {
    const now = Date.now();
    this.minuteRequests = this.minuteRequests.filter(t => now - t < 60000);
    this.dayRequests = this.dayRequests.filter(t => now - t < 86400000);
    return {
      minuteUsed: this.minuteRequests.length,
      dayUsed: this.dayRequests.length,
      minuteRemaining: Math.max(0, this.rpm - this.minuteRequests.length),
      dayRemaining: Math.max(0, this.rpd - this.dayRequests.length)
    };
  }
}

class KeyPool {
  constructor(keys, rpm, rpd) {
    this.keyPool = keys.map((key, index) => ({
      index,
      key,
      limiter: new RateLimiter(rpm, rpd),
      client: new GoogleGenAI({ apiKey: key })
    }));
  }

  getAvailableKey() {
    for (const item of this.keyPool) {
      const check = item.limiter.check();
      if (check.allowed) {
        return item;
      }
    }
    return null;
  }

  getAggregatedStatus() {
    let totalMinuteRemaining = 0;
    let totalDayRemaining = 0;
    let totalMinuteUsed = 0;
    let totalDayUsed = 0;
    let minResetIn = Infinity;
    let allLimited = true;

    for (const item of this.keyPool) {
      const status = item.limiter.check();
      totalMinuteRemaining += status.minuteRemaining;
      totalDayRemaining += status.dayRemaining;
      totalMinuteUsed += status.minuteUsed;
      totalDayUsed += status.dayUsed;
      if (status.allowed) allLimited = false;
      if (!status.allowed && status.minuteResetIn < minResetIn) {
        minResetIn = status.minuteResetIn;
      }
    }

    return {
      allowed: !allLimited,
      minuteRemaining: totalMinuteRemaining,
      dayRemaining: totalDayRemaining,
      minuteUsed: totalMinuteUsed,
      dayUsed: totalDayUsed,
      waitTime: minResetIn === Infinity ? 0 : minResetIn,
      keyCount: this.keyPool.length
    };
  }

  hasKeys() {
    return this.keyPool.length > 0;
  }
}

const keyPool = new KeyPool(geminiKeys, GEMINI_RPM, GEMINI_RPD);

class TranslationCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getKey(text, sourceLang, targetLang, persona) {
    return `${text}|${sourceLang}|${targetLang}|${persona || 'none'}`;
  }

  get(text, sourceLang, targetLang, persona) {
    const key = this.getKey(text, sourceLang, targetLang, persona);
    return this.cache.get(key);
  }

  set(text, sourceLang, targetLang, persona, result) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    const key = this.getKey(text, sourceLang, targetLang, persona);
    this.cache.set(key, result);
  }
}

const translationCache = new TranslationCache();

class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  enqueue(request) {
    const existingIndex = this.queue.findIndex(r => r.ws === request.ws && r.type === 'text_input');
    if (existingIndex !== -1) {
      this.queue[existingIndex] = request;
      return;
    }
    this.queue.push(request);
    this.process();
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      await this.handleRequest(request);
    }

    this.processing = false;
  }

  async handleRequest(request) {
    const { ws, message, translator } = request;

    if (message.type === 'text_input') {
      const { text, sourceLang, targetLang, persona } = message.data;
      console.log(`Translate Request: "${text}" [${sourceLang} -> ${targetLang}] Persona: ${persona}`);

      if (!text || text.trim().length === 0) return;

      try {
        let translatedText = '';

        const cached = translationCache.get(text, sourceLang, targetLang, persona);
        if (cached) {
          console.log('Cache hit!');
          translatedText = cached;
        } else if (!persona || persona === 'none') {
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
          if (ENABLE_MOCK) {
            console.log(`Using MOCK for persona: ${persona}`);
            translatedText = mockTranslate(text, sourceLang, targetLang, persona);
          } else {
            const rateStatus = keyPool.getAggregatedStatus();

            if (!rateStatus.allowed) {
              const isDailyLimit = rateStatus.dayRemaining === 0;
              console.error(`All keys rate limited. ${isDailyLimit ? 'Daily' : 'Minute'} limit reached.`);

              ws.send(JSON.stringify({
                type: 'rate_limit',
                data: {
                  limited: true,
                  isDailyLimit,
                  waitTime: rateStatus.waitTime,
                  minuteRemaining: rateStatus.minuteRemaining,
                  dayRemaining: rateStatus.dayRemaining,
                  message: isDailyLimit
                    ? `全APIキーの1日のリクエスト上限に達しました。`
                    : `1分間のリクエスト上限に達しました。${Math.ceil(rateStatus.waitTime / 1000)}秒お待ちください。`
                }
              }));
              return;
            }

            ws.send(JSON.stringify({
              type: 'rate_limit',
              data: {
                limited: false,
                minuteRemaining: rateStatus.minuteRemaining,
                dayRemaining: rateStatus.dayRemaining
              }
            }));

            const keyItem = keyPool.getAvailableKey();
            if (!keyItem) {
              ws.send(JSON.stringify({ type: 'error', message: 'No available API keys' }));
              return;
            }

            console.log(`Using Gemini for persona: ${persona} (Key #${keyItem.index + 1})`);

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

            try {
              const response = await keyItem.client.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: `${systemInstruction}\n\nText: "${text}"`,
              });

              keyItem.limiter.record();
              translatedText = response.text;

            } catch (apiError) {
              const errorMsg = apiError.message || String(apiError);
              const status = apiError.status || apiError.statusCode;

              if (status === 429 || errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota')) {
                console.error(`Gemini API rate limit hit on Key #${keyItem.index + 1}:`, errorMsg);
                keyItem.limiter.record();

                const retryKey = keyPool.getAvailableKey();
                if (retryKey) {
                  console.log(`Retrying with Key #${retryKey.index + 1}...`);
                  try {
                    const retryResponse = await retryKey.client.models.generateContent({
                      model: 'gemini-2.0-flash',
                      contents: `${systemInstruction}\n\nText: "${text}"`,
                    });
                    retryKey.limiter.record();
                    translatedText = retryResponse.text;
                  } catch (retryErr) {
                    console.error(`Retry failed on Key #${retryKey.index + 1}:`, retryErr.message);
                    ws.send(JSON.stringify({
                      type: 'rate_limit',
                      data: {
                        limited: true,
                        isDailyLimit: errorMsg.includes('quota') || errorMsg.includes('daily'),
                        waitTime: 60000,
                        message: 'Gemini APIのレートリミットに達しました。'
                      }
                    }));
                    return;
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'rate_limit',
                    data: {
                      limited: true,
                      isDailyLimit: errorMsg.includes('quota') || errorMsg.includes('daily'),
                      waitTime: 60000,
                      message: '全てのAPIキーでレートリミットに達しました。'
                    }
                  }));
                  return;
                }
              } else {
                throw apiError;
              }
            }
          }
        }

        if (translatedText) {
          translationCache.set(text, sourceLang, targetLang, persona, translatedText);

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
  }
}

const requestQueue = new RequestQueue();

wss.on('connection', (ws, req) => {
  console.log(`Client connected from ${req.socket.remoteAddress}`);

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
        const hasGemini = keyPool.hasKeys() || ENABLE_MOCK;
        const hasDeepL = !!translator;
        console.log(`Session config: Persona=${message.data.persona}, GeminiReady=${hasGemini}, DeepLReady=${hasDeepL}, MockMode=${ENABLE_MOCK}`);

        ws.persona = message.data.persona;
        ws.send(JSON.stringify({
          type: 'connected',
          data: {
            hasGemini,
            hasDeepL,
            mockMode: ENABLE_MOCK,
            rateLimits: {
              rpm: GEMINI_RPM,
              rpd: GEMINI_RPD,
              keyCount: geminiKeys.length,
              effectiveRpm: geminiKeys.length * GEMINI_RPM,
              effectiveRpd: geminiKeys.length * GEMINI_RPD
            }
          }
        }));
      }
      else if (message.type === 'rate_status') {
        const status = keyPool.getAggregatedStatus();
        ws.send(JSON.stringify({
          type: 'rate_status',
          data: status
        }));
      }
      else if (message.type === 'text_input') {
        requestQueue.enqueue({
          ws,
          message,
          translator
        });
      }

    } catch (e) {
      console.error('Server Logic Error:', e.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
    }
  });
});
