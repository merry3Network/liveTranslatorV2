import { useState, useRef, useCallback, useEffect } from 'react';

interface UseGeminiLiveProps {
  sourceLang: string;
  targetLang: string;
  playAudio: boolean;
}

// Global declaration for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>('');

  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any | null>(null);

  // Buffer for translation
  const currentTranscriptionRef = useRef<string>('');

  const connect = useCallback(async ({ sourceLang, targetLang, playAudio }: UseGeminiLiveProps) => {
    try {
      if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        throw new Error("Browser does not support Speech Recognition");
      }

      setIsConnecting(true);
      setError(null);
      setCurrentText('');
      currentTranscriptionRef.current = '';

      // Connect to Translation Server
      let wsUrl = 'ws://localhost:8080';
      const meta = import.meta as any;
      if (meta.env && meta.env.VITE_BACKEND_URL) {
        wsUrl = meta.env.VITE_BACKEND_URL;
      } else if (window.location.protocol.startsWith('http')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          // Remote logic
        }
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'config', data: { sourceLang, targetLang } }));
      };

      socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'connected':
            setIsConnected(true);
            setIsConnecting(false);
            startSpeechRecognition(sourceLang, targetLang);
            break;
          case 'text':
            if (msg.content) {
              currentTranscriptionRef.current += msg.content;
              if (currentTranscriptionRef.current.length > 500) {
                currentTranscriptionRef.current = currentTranscriptionRef.current.slice(-500);
              }
              setCurrentText(currentTranscriptionRef.current);
            }
            break;
          case 'turn_complete':
            currentTranscriptionRef.current += " ";
            setCurrentText(currentTranscriptionRef.current);
            break;
          case 'error':
            setError(msg.message);
            stopEverything();
            break;
        }
      };

      socket.onerror = (e) => {
        console.error("WebSocket Error", e);
        setError("Connection failed. Ensure backend server is running.");
        stopEverything();
      };

      socket.onclose = () => {
        stopEverything();
      };

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start session");
      stopEverything();
    }
  }, []);

  const startSpeechRecognition = (sourceLang: string, targetLang: string) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Map internal language names to BCP 47 tags
    // Simple mapping for demo
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
    recognition.interimResults = false; // We only want final results to send for translation

    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript;

      // Send text to backend for translation
      if (socketRef.current?.readyState === WebSocket.OPEN && transcript.trim()) {
        socketRef.current.send(JSON.stringify({
          type: 'text_input',
          data: {
            text: transcript,
            sourceLang,
            targetLang
          }
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error", event.error);
      // Don't stop entirely on simple no-speech errors, but maybe log
    };

    recognition.onend = () => {
      // Auto-restart if still connected
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          recognition.start();
        } catch (e) { }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  };

  const stopEverything = useCallback(() => {
    // Stop Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    // Close Socket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    stopEverything();
    setCurrentText('');
  }, [stopEverything]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    currentText,
    connect,
    disconnect
  };
};