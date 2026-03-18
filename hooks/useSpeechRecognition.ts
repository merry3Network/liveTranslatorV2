import { useState, useRef, useCallback } from 'react';

// Restart configuration
const RESTART_DELAY_MS = 150;
const MAX_RAPID_RESTARTS = 5;
const RAPID_RESTART_WINDOW_MS = 3000;
const BACKOFF_DELAY_MS = 2000;

interface UseSpeechRecognitionProps {
  onFinalResult: (text: string) => void;
  onInterimResult: (text: string) => void;
  onError: (errorMsg: string, isFatal: boolean) => void;
}

export const useSpeechRecognition = ({ onFinalResult, onInterimResult, onError }: UseSpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const isActiveRef = useRef(false);

  // Restart management
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimestampsRef = useRef<number[]>([]);
  const currentLangRef = useRef<string>('ja-JP');

  const scheduleRestart = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!isActiveRef.current) return;

    const now = Date.now();
    restartTimestampsRef.current = restartTimestampsRef.current.filter(
      t => now - t < RAPID_RESTART_WINDOW_MS
    );

    let delay = RESTART_DELAY_MS;
    if (restartTimestampsRef.current.length >= MAX_RAPID_RESTARTS) {
      console.warn(`Speech recognition restarted ${MAX_RAPID_RESTARTS} times in ${RAPID_RESTART_WINDOW_MS}ms, backing off...`);
      delay = BACKOFF_DELAY_MS;
      restartTimestampsRef.current = [];
    }

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (isActiveRef.current) {
        restartTimestampsRef.current.push(Date.now());
        startListening(currentLangRef.current);
      }
    }, delay);
  }, []);

  const startListening = useCallback((langDef: string) => {
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
    
    currentLangRef.current = langMap[langDef] || langDef || 'ja-JP';
    isActiveRef.current = true;

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
    if (!SpeechRecognition) {
      onError("ブラウザが音声認識に対応していません", true);
      isActiveRef.current = false;
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = currentLangRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      onInterimResult('');
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
        onInterimResult(interimTranscript);
      }

      if (finalTranscript.trim()) {
        onInterimResult('');
        onFinalResult(finalTranscript);
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
          onError("マイクの使用が許可されていません。ブラウザの設定を確認してください。", true);
          isActiveRef.current = false;
          setIsListening(false);
          return;
        case 'audio-capture':
          onError("マイクが検出されませんでした。マイクを接続してください。", true);
          isActiveRef.current = false;
          setIsListening(false);
          return;
        default:
          console.error("Unknown speech recognition error:", errorType);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      onInterimResult('');

      if (isActiveRef.current) {
        scheduleRestart();
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      if (isActiveRef.current) {
        scheduleRestart();
      }
    }
  }, [scheduleRestart, onInterimResult, onFinalResult, onError]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    restartTimestampsRef.current = [];

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    
    setIsListening(false);
    onInterimResult('');
  }, [onInterimResult]);

  return {
    isListening,
    startListening,
    stopListening
  };
};
