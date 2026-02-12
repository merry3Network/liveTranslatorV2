import { useState, useRef, useCallback, useEffect } from 'react';

interface UseGeminiLiveProps {
  sourceLang: string;
  targetLang: string;
  persona: string;
  playAudio: boolean;
}

// Global declaration for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Restart configuration
const RESTART_DELAY_MS = 150;
const MAX_RAPID_RESTARTS = 5;
const RAPID_RESTART_WINDOW_MS = 3000;
const BACKOFF_DELAY_MS = 2000;

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

  // Buffer for translation
  const currentTranscriptionRef = useRef<string>('');
  const personaRef = useRef<string>('none');

  // Restart management
  const isActiveRef = useRef(false); // true = user wants recognition running
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimestampsRef = useRef<number[]>([]);
  const sourceLangRef = useRef<string>('Japanese');
  const targetLangRef = useRef<string>('English');
  const isRawModeRef = useRef<boolean>(false);

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
      personaRef.current = persona;
      sourceLangRef.current = sourceLang;
      targetLangRef.current = targetLang;

      // Connect to Translation Server
      let wsUrl = 'ws://localhost:8080';

      // Check for environment variable (Vite)
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
            if (msg.content && !isRawMode) {
              currentTranscriptionRef.current = msg.content;
              setCurrentText(currentTranscriptionRef.current);
            }
            break;
          case 'turn_complete':
            break;
          case 'error':
            setError(msg.message);
            stopEverything();
            break;
        }
      };

      socket.onerror = (e) => {
        console.error("WebSocket Error", e);
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
  }, []);

  /**
   * Schedule a delayed restart of speech recognition.
   * Uses backoff if too many rapid restarts are detected.
   */
  const scheduleRestart = useCallback((sourceLang: string, targetLang: string) => {
    // Clear any pending restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Don't restart if intentionally stopped
    if (!isActiveRef.current) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    // Check for rapid restart loop
    const now = Date.now();
    restartTimestampsRef.current = restartTimestampsRef.current.filter(
      t => now - t < RAPID_RESTART_WINDOW_MS
    );

    let delay = RESTART_DELAY_MS;
    if (restartTimestampsRef.current.length >= MAX_RAPID_RESTARTS) {
      console.warn(`Speech recognition restarted ${MAX_RAPID_RESTARTS} times in ${RAPID_RESTART_WINDOW_MS}ms, backing off...`);
      delay = BACKOFF_DELAY_MS;
      // Clear the timestamps so we don't keep backing off forever
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
    // Clean up any existing recognition instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent restart loop from old instance
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Map internal language names to BCP 47 tags
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
    recognition.interimResults = true; // Enable interim results for real-time feedback
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: any) => {
      // Process all results from the latest batch
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

      // Show interim text (real-time feedback while speaking)
      if (interimTranscript) {
        setInterimText(interimTranscript);
      }

      // Process final results — send to translation
      if (finalTranscript.trim()) {
        setInterimText(''); // Clear interim since we got a final result
        setInputText(finalTranscript);

        // If in Raw Mode, display the final transcript directly and skip sending to server
        if (isRawModeRef.current) {
          currentTranscriptionRef.current = finalTranscript;
          setCurrentText(finalTranscript);
        } else if (socketRef.current?.readyState === WebSocket.OPEN) {
          // Send text to backend for translation - ONLY if not in raw mode
          socketRef.current.send(JSON.stringify({
            type: 'text_input',
            data: {
              text: finalTranscript,
              sourceLang,
              targetLang,
              persona: personaRef.current
            }
          }));
        }
      }
    };

    recognition.onerror = (event: any) => {
      const errorType = event.error;
      console.warn("Speech Recognition Error:", errorType);

      switch (errorType) {
        case 'no-speech':
          // No speech detected — normal, just let onend handle restart
          break;
        case 'aborted':
          // Recognition was aborted — restart via onend
          break;
        case 'network':
          // Network issue — will restart with backoff via onend
          console.error("Speech recognition network error — will retry");
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          // Permission denied — show error and stop
          setError("マイクの使用が許可されていません。ブラウザの設定を確認してください。");
          isActiveRef.current = false;
          setIsListening(false);
          return; // Don't let onend restart
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

      // Auto-restart if we should still be listening
      if (isActiveRef.current) {
        scheduleRestart(sourceLang, targetLang);
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      // If start fails, try to restart after a delay
      if (isActiveRef.current) {
        scheduleRestart(sourceLang, targetLang);
      }
    }
  };

  const stopEverything = useCallback(() => {
    // Mark as intentionally stopped
    isActiveRef.current = false;

    // Clear restart timer
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Clear restart history
    restartTimestampsRef.current = [];

    // Stop Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent restart from firing
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    // Close Socket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsListening(false);
    setInterimText('');
  }, []);

  const disconnect = useCallback(() => {
    stopEverything();
    setCurrentText('');
    setInputText('');
    setInterimText('');
  }, [stopEverything]);

  // Sync refs
  useEffect(() => {
    isRawModeRef.current = isRawMode;
  }, [isRawMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const simulateVoiceInput = (text: string, sourceLang: string, targetLang: string) => {
    setInputText(text); // Update input text for simulation too

    if (isRawModeRef.current) {
      // In Raw Mode, just update the display locally
      currentTranscriptionRef.current = text;
      setCurrentText(text);
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'text_input',
        data: {
          text,
          sourceLang,
          targetLang,
          persona: personaRef.current
        }
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