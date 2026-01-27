import React, { useEffect, useRef } from 'react';
import { BackgroundMode, TextStyle } from '../types';

interface SubtitleDisplayProps {
  text: string;
  bgMode: BackgroundMode;
  textStyle: TextStyle;
}

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ text, bgMode, textStyle }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom if text gets too long
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  // Determine text color and rendering classes based on style
  const getTextClasses = () => {
    switch (textStyle) {
      case TextStyle.OUTLINE:
        return 'text-white text-outline-black font-black tracking-wide';
      case TextStyle.BOX:
        return 'text-white bg-black/70 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm inline-block';
      default:
        // Simple style depends on background brightness
        if (bgMode === BackgroundMode.NORMAL) return 'text-gray-100';
        return 'text-white text-outline-black'; // Default to outline on chroma colors for visibility
    }
  };

  const isEmpty = !text || text.trim().length === 0;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-end items-center p-8 pb-16 overflow-y-auto no-scrollbar scroll-smooth"
    >
      <div className="max-w-[90%] text-center transition-all duration-300 ease-in-out">
        {isEmpty ? (
          <div className={`text-3xl opacity-30 font-semibold ${bgMode === BackgroundMode.NORMAL ? 'text-white' : 'text-black'}`}>
            音声待機中...
          </div>
        ) : (
          <span
            className={`text-5xl md:text-6xl lg:text-7xl leading-tight break-words ${getTextClasses()}`}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
};