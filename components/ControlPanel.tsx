import React from 'react';
import { BackgroundMode, TextStyle, TranslationConfig } from '../types';
import { Mic, MicOff, Settings, Minimize2, Maximize2, AlertCircle } from 'lucide-react';

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
  error: string | null;
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
  error
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
        <div className="flex items-center justify-between bg-gray-800 p-2 rounded border border-gray-700">
          <span className="text-sm">音声読み上げ (TTS)</span>
          <button
            onClick={() => setPlayAudio(!playAudio)}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${playAudio ? 'bg-emerald-500' : 'bg-gray-600'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${playAudio ? 'translate-x-6' : ''}`} />
          </button>
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
      </div>
    </div>
  );
};