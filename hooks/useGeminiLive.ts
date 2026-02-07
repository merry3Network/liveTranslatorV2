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

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');

  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any | null>(null);

  // Buffer for translation
  const currentTranscriptionRef = useRef<string>('');
  const personaRef = useRef<string>('none');

  const connect = useCallback(async ({ sourceLang, targetLang, persona, playAudio }: UseGeminiLiveProps) => {
    try {
      if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        throw new Error("Browser does not support Speech Recognition");
      }

      setIsConnecting(true);
      setError(null);
      setCurrentText('');
      setInputText('');
      currentTranscriptionRef.current = '';
      personaRef.current = persona;

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
            startSpeechRecognition(sourceLang, targetLang);
            break;
          case 'text':
            if (msg.content) {
              // Replace previous text with new translation
              currentTranscriptionRef.current = msg.content;
              setCurrentText(currentTranscriptionRef.current);
            }
            break;
          case 'turn_complete':
            // No need to append space or do anything for replace mode
            // currentTranscriptionRef.current += " ";
            // setCurrentText(currentTranscriptionRef.current);
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

      if (transcript.trim()) {
        setInputText(prev => {
          // Keep last few sentences or just append? 
          // Ideally we just want to see the latest input.
          // Let's just show the latest recognized phrase for clarity.
          return transcript;
        });

        // Send text to backend for translation
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'text_input',
            data: {
              text: transcript,
              sourceLang,
              targetLang,
              persona: personaRef.current
            }
          }));
        }
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
    setInputText('');
  }, [stopEverything]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const simulateVoiceInput = (text: string, sourceLang: string, targetLang: string) => {
    setInputText(text); // Update input text for simulation too

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
    error,
    currentText,
    inputText,
    connect,
    disconnect,
    simulateVoiceInput
  };
};