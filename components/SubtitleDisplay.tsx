import React, { useEffect, useRef } from 'react';
import { BackgroundMode, TextStyle } from '../types';

interface SubtitleDisplayProps {
  text: string;
  inputText?: string;
  bgMode: BackgroundMode;
  textStyle: TextStyle;
}

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ text, inputText, bgMode, textStyle }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom if text gets too long
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, inputText]);

  // Determine text color and rendering classes based on style
  const getTextClasses = () => {
    switch (textStyle) {
      case TextStyle.OUTLINE:
        return 'text-white text-outline-black tracking-wide';
      case TextStyle.BOX:
        return 'text-white bg-black/70 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm inline-block';
      default:
        // Simple style depends on background brightness
        if (bgMode === BackgroundMode.NORMAL) return 'text-gray-100';
        return 'text-white';
    }
  };

  const isEmpty = (!text || text.trim().length === 0) && (!inputText || inputText.trim().length === 0);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-end items-center p-8 pb-16 overflow-y-auto no-scrollbar scroll-smooth"
    >
      <div className="max-w-[90%] text-center transition-all duration-300 ease-in-out flex flex-col gap-4">
        {isEmpty ? (
          <div className={`text-3xl opacity-30 font-semibold ${bgMode === BackgroundMode.NORMAL ? 'text-white' : 'text-black'}`}>
            音声待機中...
          </div>
        ) : (
          <>
            {/* Input Text (Source) */}
            {inputText && (
              <div className={`text-2xl md:text-3xl lg:text-4xl opacity-80 mb-2 ${bgMode === BackgroundMode.NORMAL ? 'text-gray-400' : 'text-white text-outline-black'
                }`}>
                {inputText}
              </div>
            )}

            {/* Translated Text (Target) */}
            {text && (
              <div
                className={`text-5xl md:text-6xl lg:text-7xl leading-tight break-words ${getTextClasses()}`}
              >
                {text}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};