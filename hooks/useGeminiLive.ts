import { useState, useRef, useCallback, useEffect } from 'react';

interface UseGeminiLiveProps {
  sourceLang: string;
  targetLang: string;
  persona: string;
  playAudio: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const RESTART_DELAY_MS = 150;
const MAX_RAPID_RESTARTS = 5;
const RAPID_RESTART_WINDOW_MS = 3000;
const BACKOFF_DELAY_MS = 2000;
const DEBOUNCE_MS = 1000;

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRawMode, setIsRawMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');

  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const currentTranscriptionRef = useRef<string>('');
  const personaRef = useRef<string>('none');
  const isActiveRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimestampsRef = useRef<number[]>([]);
  const sourceLangRef = useRef<string>('Japanese');
  const targetLangRef = useRef<string>('English');
  const isRawModeRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferedTextRef = useRef<string>('');

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushBufferedText = useCallback(() => {
    const text = bufferedTextRef.current.trim();
    bufferedTextRef.current = '';
    
    if (!text) return;
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'text_input',
        data: {
          text,
          sourceLang: sourceLangRef.current,
          targetLang: targetLangRef.current,
          persona: personaRef.current
        }
      }));
    }
  }, []);

  const debouncedSend = useCallback((text: string) => {
    bufferedTextRef.current = bufferedTextRef.current 
      ? `${bufferedTextRef.current} ${text}`
      : text;
    
    clearDebounceTimer();
    
    debounceTimerRef.current = setTimeout(flushBufferedText, DEBOUNCE_MS);
  }, [clearDebounceTimer, flushBufferedText]);

  const connect = useCallback(async ({ sourceLang, targetLang, persona, playAudio }: UseGeminiLiveProps) => {
    try {
      if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        throw new Error("ブラウザが音声認識に対応していません");
      }

      setIsConnecting(true);
      setError(null);
      setCurrentText('');
      setInputText('');
      setInterimText('');
      currentTranscriptionRef.current = '';
      bufferedTextRef.current = '';
      personaRef.current = persona;
      sourceLangRef.current = sourceLang;
      targetLangRef.current = targetLang;

      clearDebounceTimer();

      let wsUrl = 'ws://localhost:8080';
      if (import.meta.env.VITE_BACKEND_URL) {
        wsUrl = import.meta.env.VITE_BACKEND_URL;
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'config', data: { sourceLang, targetLang, persona } }));
      };

      socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'connected':
            setIsConnected(true);
            setIsConnecting(false);
            isActiveRef.current = true;
            startSpeechRecognition(sourceLang, targetLang);
            break;
          case 'text':
            if (msg.content && !isRawModeRef.current) {
              currentTranscriptionRef.current = msg.content;
              setCurrentText(currentTranscriptionRef.current);
            }
            break;
          case 'turn_complete':
            break;
          case 'error':
            setError(msg.message);
            break;
        }
      };

      socket.onerror = () => {
        setError("接続失敗。バックエンドサーバーが起動しているか確認してください。");
        stopEverything();
      };

      socket.onclose = () => {
        stopEverything();
      };

    } catch (err: any) {
      console.error(err);
      setError(err.message || "セッション開始に失敗しました");
      stopEverything();
    }
  }, [clearDebounceTimer]);

  const scheduleRestart = useCallback((sourceLang: string, targetLang: string) => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!isActiveRef.current) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const now = Date.now();
    restartTimestampsRef.current = restartTimestampsRef.current.filter(t => now - t < RAPID_RESTART_WINDOW_MS);

    let delay = RESTART_DELAY_MS;
    if (restartTimestampsRef.current.length >= MAX_RAPID_RESTARTS) {
      console.warn(`Speech recognition restarted ${MAX_RAPID_RESTARTS} times in ${RAPID_RESTART_WINDOW_MS}ms, backing off...`);
      delay = BACKOFF_DELAY_MS;
      restartTimestampsRef.current = [];
    }

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (isActiveRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
        restartTimestampsRef.current.push(Date.now());
        startSpeechRecognition(sourceLang, targetLang);
      }
    }, delay);
  }, []);

  const startSpeechRecognition = (sourceLang: string, targetLang: string) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    const langMap: { [key: string]: string } = {
      'Japanese': 'ja-JP',
      'English': 'en-US',
      'Spanish': 'es-ES',
      'Chinese': 'zh-CN',
      'Korean': 'ko-KR',
      'French': 'fr-FR',
      'German': 'de-DE'
    };

    recognition.lang = langMap[sourceLang] || 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setInterimText(interimTranscript);
      }

      if (finalTranscript.trim()) {
        setInterimText('');
        setInputText(finalTranscript);

        if (isRawModeRef.current) {
          currentTranscriptionRef.current = finalTranscript;
          setCurrentText(finalTranscript);
        } else if (socketRef.current?.readyState === WebSocket.OPEN) {
          debouncedSend(finalTranscript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      const errorType = event.error;
      console.warn("Speech Recognition Error:", errorType);

      switch (errorType) {
        case 'no-speech':
        case 'aborted':
          break;
        case 'network':
          console.error("Speech recognition network error — will retry");
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          setError("マイクの使用が許可されていません。ブラウザの設定を確認してください。");
          isActiveRef.current = false;
          setIsListening(false);
          return;
        case 'audio-capture':
          setError("マイクが検出されませんでした。マイクを接続してください。");
          isActiveRef.current = false;
          setIsListening(false);
          return;
        default:
          console.error("Unknown speech recognition error:", errorType);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      if (isActiveRef.current) {
        scheduleRestart(sourceLang, targetLang);
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      if (isActiveRef.current) {
        scheduleRestart(sourceLang, targetLang);
      }
    }
  };

  const stopEverything = useCallback(() => {
    isActiveRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    clearDebounceTimer();
    bufferedTextRef.current = '';
    restartTimestampsRef.current = [];

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsListening(false);
    setInterimText('');
  }, [clearDebounceTimer]);

  const disconnect = useCallback(() => {
    stopEverything();
    setCurrentText('');
    setInputText('');
    setInterimText('');
  }, [stopEverything]);

  useEffect(() => {
    isRawModeRef.current = isRawMode;
  }, [isRawMode]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const simulateVoiceInput = (text: string, sourceLang: string, targetLang: string) => {
    setInputText(text);

    if (isRawModeRef.current) {
      currentTranscriptionRef.current = text;
      setCurrentText(text);
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      clearDebounceTimer();
      bufferedTextRef.current = '';
      
      socketRef.current.send(JSON.stringify({
        type: 'text_input',
        data: { text, sourceLang, targetLang, persona: personaRef.current }
      }));
    } else {
      console.warn("Socket not connected");
    }
  };

  return {
    isConnected,
    isConnecting,
    isListening,
    error,
    currentText,
    inputText,
    interimText,
    isRawMode,
    setIsRawMode,
    connect,
    disconnect,
    simulateVoiceInput
  };
};
