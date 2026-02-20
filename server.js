/**
 * To run this server:
 * 1. Install dependencies: npm install ws @google/genai dotenv
 * 2. Set API_KEY (Gemini) in your environment variables.
 * 3. Run: npm start
 */

const { WebSocketServer } = require('ws');
const { GoogleGenAI } = require('@google/genai');
const deepl = require('deepl-node');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

const sanitizeKey = (key) => {
  if (!key) return "";
  return key.trim().replace(/^["']|["']$/g, '');
};

console.log(`Translation Server (Web Speech API + Gemini) running on port ${port}`);

const ENABLE_MOCK = process.env.ENABLE_MOCK === 'true';
const GEMINI_RPM = parseInt(process.env.GEMINI_RPM || '5', 10);
const GEMINI_RPD = parseInt(process.env.GEMINI_RPD || '20', 10);
const DEEPL_CPM = parseInt(process.env.DEEPL_CPM || '500000', 10);
const RATE_LIMIT_FILE = path.join(__dirname, '.rate-limits.json');

if (ENABLE_MOCK) {
  console.log('🎭 MOCK MODE ENABLED - No real API calls will be made');
}

if (!process.env.API_KEY && !ENABLE_MOCK) {
  console.error("WARNING: API_KEY (Gemini) is missing. Persona translations will fail.");
}
if (!process.env.DEEPL_API_KEY) {
  console.error("WARNING: DEEPL_API_KEY is missing. Standard translations will fail.");
}

console.log(`Rate Limits: Gemini ${GEMINI_RPM} RPM / ${GEMINI_RPD} RPD, DeepL ${DEEPL_CPM} chars/month`);

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

function loadRateLimits() {
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      const data = fs.readFileSync(RATE_LIMIT_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Could not load rate limits file:', e.message);
  }
  return null;
}

function saveRateLimits(data) {
  try {
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('Could not save rate limits file:', e.message);
  }
}

class RateLimiter {
  constructor(rpm, rpd) {
    this.rpm = rpm;
    this.rpd = rpd;
    this.minuteRequests = [];
    this.dayRequests = [];
    this.load();
  }

  load() {
    const data = loadRateLimits();
    if (data && data.gemini) {
      const now = Date.now();
      this.minuteRequests = (data.gemini.minuteRequests || []).filter(t => now - t < 60000);
      this.dayRequests = (data.gemini.dayRequests || []).filter(t => now - t < 86400000);
      console.log(`Gemini rate limits loaded: ${this.minuteRequests.length} min, ${this.dayRequests.length} day`);
    }
  }

  save() {
    const data = loadRateLimits() || {};
    data.gemini = {
      minuteRequests: this.minuteRequests,
      dayRequests: this.dayRequests,
      lastUpdated: Date.now()
    };
    saveRateLimits(data);
  }

  check() {
    const now = Date.now();
    this.minuteRequests = this.minuteRequests.filter(t => now - t < 60000);
    this.dayRequests = this.dayRequests.filter(t => now - t < 86400000);
    
    return {
      allowed: this.minuteRequests.length < this.rpm && this.dayRequests.length < this.rpd,
      isMinuteLimit: this.minuteRequests.length >= this.rpm,
      isDayLimit: this.dayRequests.length >= this.rpd,
      minuteResetIn: this.minuteRequests.length > 0 ? Math.max(0, 60000 - (now - this.minuteRequests[0])) : 0,
      dayResetIn: this.dayRequests.length > 0 ? Math.max(0, 86400000 - (now - this.dayRequests[0])) : 0
    };
  }

  record() {
    const now = Date.now();
    this.minuteRequests.push(now);
    this.dayRequests.push(now);
    this.save();
  }
}

class CharacterRateLimiter {
  constructor(monthlyLimit) {
    this.monthlyLimit = monthlyLimit;
    this.monthUsage = 0;
    this.monthStart = this.getCurrentMonthStart();
    this.load();
  }

  getCurrentMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }

  getNextMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  }

  load() {
    const data = loadRateLimits();
    if (data && data.deepl) {
      if (data.deepl.monthStart === this.monthStart) {
        this.monthUsage = data.deepl.monthUsage || 0;
        console.log(`DeepL rate limits loaded: ${this.monthUsage} chars used this month`);
      } else {
        console.log('DeepL rate limits: new month detected, resetting usage');
      }
    }
  }

  save() {
    const data = loadRateLimits() || {};
    data.deepl = {
      monthUsage: this.monthUsage,
      monthStart: this.monthStart,
      lastUpdated: Date.now()
    };
    saveRateLimits(data);
  }

  check(charCount) {
    if (this.monthStart !== this.getCurrentMonthStart()) {
      this.monthUsage = 0;
      this.monthStart = this.getCurrentMonthStart();
    }
    
    return {
      allowed: this.monthUsage + charCount <= this.monthlyLimit,
      remaining: Math.max(0, this.monthlyLimit - this.monthUsage),
      used: this.monthUsage
    };
  }

  record(charCount) {
    if (this.monthStart !== this.getCurrentMonthStart()) {
      this.monthUsage = 0;
      this.monthStart = this.getCurrentMonthStart();
    }
    this.monthUsage += charCount;
    this.save();
  }
}

const geminiLimiter = new RateLimiter(GEMINI_RPM, GEMINI_RPD);
const deeplLimiter = new CharacterRateLimiter(DEEPL_CPM);

class TranslationCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getKey(text, sourceLang, targetLang, persona) {
    return `${text}|${sourceLang}|${targetLang}|${persona || 'none'}`;
  }

  get(text, sourceLang, targetLang, persona) {
    return this.cache.get(this.getKey(text, sourceLang, targetLang, persona));
  }

  set(text, sourceLang, targetLang, persona, result) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(this.getKey(text, sourceLang, targetLang, persona), result);
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
      await this.handleRequest(this.queue.shift());
    }
    this.processing = false;
  }

  async handleRequest(request) {
    const { ws, message, ai, translator } = request;
    
    if (message.type !== 'text_input') return;
    
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
          ws.send(JSON.stringify({ type: 'error', message: '翻訳サービスが利用できません。' }));
          return;
        }
        
        const charCount = text.length;
        const rateCheck = deeplLimiter.check(charCount);
        
        if (!rateCheck.allowed) {
          console.error(`DeepL monthly limit exceeded: ${rateCheck.used}/${this.monthlyLimit}`);
          ws.send(JSON.stringify({ type: 'error', message: '月間の翻訳上限に達しました。' }));
          return;
        }
        
        console.log(`Using DeepL for standard translation (${charCount} chars, ${rateCheck.remaining} remaining)`);
        const targetCode = deeplLangMap[targetLang] || 'en-US';
        const result = await translator.translateText(text, null, targetCode);
        deeplLimiter.record(charCount);
        translatedText = result.text;
      } else {
        if (ENABLE_MOCK) {
          console.log(`Using MOCK for persona: ${persona}`);
          translatedText = mockTranslate(text, sourceLang, targetLang, persona);
        } else {
          const rateCheck = geminiLimiter.check();
          
          if (!rateCheck.allowed) {
            console.error(`Gemini rate limit exceeded (${rateCheck.isDayLimit ? 'daily' : 'minute'})`);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: rateCheck.isDayLimit ? '本日の翻訳上限に達しました。' : '翻訳上限に達しました。しばらくお待ちください。'
            }));
            return;
          }

          if (!ai) {
            ws.send(JSON.stringify({ type: 'error', message: '翻訳サービスが利用できません。' }));
            return;
          }

          console.log(`Using Gemini for persona: ${persona}`);
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
            const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash',
              contents: `${systemInstruction}\n\nText: "${text}"`,
            });
            geminiLimiter.record();
            translatedText = response.text;
          } catch (apiError) {
            const errorMsg = apiError.message || String(apiError);
            const status = apiError.status || apiError.statusCode;
            
            if (status === 429 || errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota')) {
              console.error('Gemini API rate limit hit:', errorMsg);
              ws.send(JSON.stringify({ type: 'error', message: '翻訳上限に達しました。しばらくお待ちください。' }));
              return;
            }
            throw apiError;
          }
        }
      }

      if (translatedText) {
        translationCache.set(text, sourceLang, targetLang, persona, translatedText);
        ws.send(JSON.stringify({ type: 'text', content: translatedText }));
        ws.send(JSON.stringify({ type: 'turn_complete' }));
      }
    } catch (err) {
      console.error("Translation Error:", err);
      ws.send(JSON.stringify({ type: 'error', message: '翻訳に失敗しました。' }));
    }
  }
}

const requestQueue = new RequestQueue();

wss.on('connection', (ws, req) => {
  console.log(`Client connected from ${req.socket.remoteAddress}`);

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

  ws.on('close', () => console.log('Client disconnected'));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'config') {
        const hasGemini = !!ai || ENABLE_MOCK;
        const hasDeepL = !!translator;
        console.log(`Session config: Persona=${message.data.persona}, GeminiReady=${hasGemini}, DeepLReady=${hasDeepL}, MockMode=${ENABLE_MOCK}`);
        ws.persona = message.data.persona;
        ws.send(JSON.stringify({ type: 'connected', data: { hasGemini, hasDeepL } }));
      }
      else if (message.type === 'text_input') {
        requestQueue.enqueue({ ws, message, ai, translator });
      }
    } catch (e) {
      console.error('Server Logic Error:', e.message);
      ws.send(JSON.stringify({ type: 'error', message: 'サーバーエラーが発生しました。' }));
    }
  });
});
