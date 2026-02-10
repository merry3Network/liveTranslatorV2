import React, { useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { SubtitleDisplay } from './components/SubtitleDisplay';
import { useGeminiLive } from './hooks/useGeminiLive';
import { BackgroundMode, TextStyle, TranslationConfig, Persona } from './types';

const App: React.FC = () => {
  // App State
  const [bgMode, setBgMode] = useState<BackgroundMode>(BackgroundMode.NORMAL);
  const [textStyle, setTextStyle] = useState<TextStyle>(TextStyle.OUTLINE);
  const [config, setConfig] = useState<TranslationConfig>({
    sourceLang: 'Japanese',
    targetLang: 'English',
    persona: Persona.NONE
  });
  const [playAudio, setPlayAudio] = useState(false);

  // Logic Hook
  const {
    isConnected,
    isConnecting,
    isListening,
    error,
    currentText,
    inputText,
    interimText,
    connect,
    disconnect,
    simulateVoiceInput
  } = useGeminiLive();

  const handleConnect = () => {
    connect({
      sourceLang: config.sourceLang,
      targetLang: config.targetLang,
      persona: config.persona,
      playAudio
    });
  };

  // Determine background color style
  const getBgStyle = () => {
    switch (bgMode) {
      case BackgroundMode.GREEN: return '#00FF00';
      case BackgroundMode.BLUE: return '#0000FF';
      case BackgroundMode.MAGENTA: return '#FF00FF';
      default: return '#111827'; // Tailwind gray-900
    }
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: getBgStyle() }}
    >
      {/* Controls Overlay */}
      <ControlPanel
        isConnected={isConnected}
        isConnecting={isConnecting}
        onConnect={handleConnect}
        onDisconnect={disconnect}
        bgMode={bgMode}
        setBgMode={setBgMode}
        textStyle={textStyle}
        setTextStyle={setTextStyle}
        config={config}
        setConfig={setConfig}
        playAudio={playAudio}
        setPlayAudio={setPlayAudio}
        error={error}
        simulateVoiceInput={simulateVoiceInput}
      />

      {/* Main Translation Display */}
      <main className="absolute inset-0 z-0">
        <SubtitleDisplay
          text={currentText}
          inputText={inputText}
          interimText={interimText}
          isListening={isListening}
          bgMode={bgMode}
          textStyle={textStyle}
        />
      </main>
    </div>
  );
};

export default App;