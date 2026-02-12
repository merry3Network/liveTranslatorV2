import React from 'react';
import { BackgroundMode, TextStyle, TranslationConfig, Persona } from '../types';
import { Mic, MicOff, Settings, Minimize2, Maximize2, AlertCircle, User, Zap, Ghost, Cat, Coffee } from 'lucide-react';

interface ControlPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  bgMode: BackgroundMode;
  setBgMode: (mode: BackgroundMode) => void;
  textStyle: TextStyle;
  setTextStyle: (style: TextStyle) => void;
  config: TranslationConfig;
  setConfig: (config: TranslationConfig) => void;
  playAudio: boolean;
  setPlayAudio: (play: boolean) => void;
  isRawMode: boolean;
  setIsRawMode: (isRaw: boolean) => void;
  error: string | null;
  simulateVoiceInput?: (text: string, sourceLang: string, targetLang: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  bgMode,
  setBgMode,
  textStyle,
  setTextStyle,
  config,
  setConfig,
  playAudio,
  setPlayAudio,
  isRawMode,
  setIsRawMode,
  error,
  simulateVoiceInput
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const languages = [
    { code: 'Japanese', label: '日本語' },
    { code: 'English', label: '英語' },
    { code: 'Spanish', label: 'スペイン語' },
    { code: 'Chinese', label: '中国語' },
    { code: 'Korean', label: '韓国語' },
    { code: 'French', label: 'フランス語' },
    { code: 'German', label: 'ドイツ語' },
  ];

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed top-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity"
      >
        <Settings size={24} />
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-50 w-80 bg-gray-900/95 backdrop-blur-sm text-gray-100 rounded-xl shadow-2xl border border-gray-700 p-4 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Settings size={18} />
          OBS 翻訳ツール
        </h2>
        <button onClick={() => setIsCollapsed(true)} className="text-gray-400 hover:text-white">
          <Minimize2 size={18} />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-2 rounded mb-4 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connection Status */}
      <div className="mb-6">
        {!isConnected ? (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${isConnecting
              ? 'bg-gray-600 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
          >
            {isConnecting ? '接続中...' : <><Mic size={20} /> 翻訳開始</>}
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <MicOff size={20} /> 翻訳停止
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Languages */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">入力言語 (音声)</label>
            <select
              value={config.sourceLang}
              onChange={(e) => setConfig({ ...config, sourceLang: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none"
              disabled={isConnected}
            >
              {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">出力言語 (字幕)</label>
            <select
              value={config.targetLang}
              onChange={(e) => setConfig({ ...config, targetLang: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-emerald-500 outline-none"
              disabled={isConnected}
            >
              {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* Play Audio Toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between bg-gray-800 p-2 rounded border border-gray-700">
            <span className="text-sm">音声読み上げ (TTS)</span>
            <button
              onClick={() => setPlayAudio(!playAudio)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${playAudio ? 'bg-emerald-500' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${playAudio ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-800 p-2 rounded border border-gray-700">
            <div className="flex flex-col">
              <span className="text-sm">翻訳バイパス (Raw Mode)</span>
              <span className="text-[10px] text-gray-400">認識した声を直接表示します</span>
            </div>
            <button
              onClick={() => setIsRawMode(!isRawMode)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${isRawMode ? 'bg-amber-500' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isRawMode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* Persona Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">属性 (ペルソナ)</label>
          <div className="grid grid-cols-5 gap-1">
            {[
              { persona: Persona.NONE, icon: <User size={14} />, label: 'なし' },
              { persona: Persona.SAMURAI, icon: <Zap size={14} />, label: '侍' },
              { persona: Persona.TSUNDERE, icon: <Ghost size={14} />, label: 'デレ' },
              { persona: Persona.CAT, icon: <Cat size={14} />, label: '猫' },
              { persona: Persona.BUTLER, icon: <Coffee size={14} />, label: '執事' },
            ].map((option) => (
              <button
                key={option.persona}
                onClick={() => setConfig({ ...config, persona: option.persona })}
                className={`flex flex-col items-center justify-center py-2 rounded border transition-all ${config.persona === option.persona
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'
                  }`}
                title={option.label}
              >
                {option.icon}
                <span className="text-[10px] mt-1">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">背景色 (クロマキー)</label>
          <div className="flex gap-2">
            {[
              { mode: BackgroundMode.NORMAL, color: 'bg-gray-800', label: 'ダーク' },
              { mode: BackgroundMode.GREEN, color: 'bg-[#00FF00]', label: 'グリーン' },
              { mode: BackgroundMode.BLUE, color: 'bg-[#0000FF]', label: 'ブルー' },
              { mode: BackgroundMode.MAGENTA, color: 'bg-[#FF00FF]', label: 'マゼンタ' },
            ].map((option) => (
              <button
                key={option.mode}
                onClick={() => setBgMode(option.mode)}
                className={`flex-1 h-8 rounded border-2 transition-all ${bgMode === option.mode ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  } ${option.color}`}
                title={option.label}
              />
            ))}
          </div>
        </div>

        {/* Text Style Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">字幕スタイル</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { style: TextStyle.SIMPLE, label: '標準' },
              { style: TextStyle.OUTLINE, label: '縁取り' },
              { style: TextStyle.BOX, label: 'ボックス' },
            ].map((option) => (
              <button
                key={option.style}
                onClick={() => setTextStyle(option.style)}
                className={`px-2 py-1.5 text-xs rounded border transition-colors ${textStyle === option.style
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Test Inputs */}
        <div className="pt-2 border-t border-gray-700">
          <label className="block text-xs font-medium text-gray-400 mb-2">翻訳テスト (発話シミュレーション)</label>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => simulateVoiceInput && simulateVoiceInput("こんにちは、ご機嫌いかがですか", config.sourceLang, config.targetLang)}
              disabled={!isConnected}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs py-2 px-3 rounded border border-gray-600 text-left transition-colors"
            >
              Test: こんにちは、ご機嫌いかがですか
            </button>
            <button
              onClick={() => simulateVoiceInput && simulateVoiceInput("Hello, How are you.", config.sourceLang, config.targetLang)}
              disabled={!isConnected}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs py-2 px-3 rounded border border-gray-600 text-left transition-colors"
            >
              Test: Hello, How are you.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};