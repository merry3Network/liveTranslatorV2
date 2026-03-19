import { useState, useRef, useCallback, useEffect } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';

interface UseGeminiLiveProps {
  sourceLang: string;
  targetLang: string;
  persona: string;
  playAudio: boolean;
}

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRawMode, setIsRawMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [localAIStatus, setLocalAIStatus] = useState<{ enabled: boolean; model?: string }>({ enabled: false });

  const socketRef = useRef<WebSocket | null>(null);
  const currentTranscriptionRef = useRef<string>('');
  const personaRef = useRef<string>('none');
  const sourceLangRef = useRef<string>('Japanese');
  const targetLangRef = useRef<string>('English');
  const isRawModeRef = useRef<boolean>(false);

  useEffect(() => {
    isRawModeRef.current = isRawMode;
  }, [isRawMode]);

  const handleFinalResult = useCallback((finalTranscript: string) => {
    setInputText(finalTranscript);

    if (isRawModeRef.current) {
      currentTranscriptionRef.current = finalTranscript;
      setCurrentText(finalTranscript);
    } else if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'text_input',
        data: {
          text: finalTranscript,
          sourceLang: sourceLangRef.current,
          targetLang: targetLangRef.current,
          persona: personaRef.current
        }
      }));
    }
  }, []);

  const handleInterimResult = useCallback((text: string) => {
    setInterimText(text);
  }, []);

  const handleError = useCallback((errorMsg: string, isFatal: boolean) => {
    if (isFatal) {
      setError(errorMsg);
      // We don't call stopEverything here to avoid circular dependency
      // The UI will show the error.
    } else {
      console.warn("Speech Recognition Error:", errorMsg);
    }
  }, []);

  const { isListening, startListening, stopListening } = useSpeechRecognition({
    onFinalResult: handleFinalResult,
    onInterimResult: handleInterimResult,
    onError: handleError
  });

  const stopEverything = useCallback(() => {
    stopListening();

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setInterimText('');
  }, [stopListening]);

  const connect = useCallback(async ({ sourceLang, targetLang, persona, playAudio }: UseGeminiLiveProps) => {
    try {
      setIsConnecting(true);
      setError(null);
      setCurrentText('');
      setInputText('');
      setInterimText('');
      currentTranscriptionRef.current = '';
      personaRef.current = persona;
      sourceLangRef.current = sourceLang;
      targetLangRef.current = targetLang;

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
            if (msg.data?.hasLocalAI) {
              setLocalAIStatus({ enabled: true, model: msg.data.ollamaModel });
            } else {
              setLocalAIStatus({ enabled: false });
            }
            startListening(sourceLang);
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
  }, [startListening, stopEverything]);

  const disconnect = useCallback(() => {
    stopEverything();
    setCurrentText('');
    setInputText('');
    setInterimText('');
  }, [stopEverything]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const simulateVoiceInput = (text: string, sourceLang: string, targetLang: string) => {
    setInputText(text);

    if (isRawModeRef.current) {
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
    localAIStatus,
    connect,
    disconnect,
    simulateVoiceInput
  };
};