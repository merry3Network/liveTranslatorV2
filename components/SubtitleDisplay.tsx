import React, { useEffect, useRef } from 'react';
import { BackgroundMode, TextStyle, FontFamily } from '../types';

interface SubtitleDisplayProps {
  text: string;
  inputText?: string;
  interimText?: string;
  isListening?: boolean;
  bgMode: BackgroundMode;
  textStyle: TextStyle;
  outlineColor: string;
  sourceFont: FontFamily;
  targetFont: FontFamily;
}

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ text, inputText, interimText, isListening, bgMode, textStyle, outlineColor, sourceFont, targetFont }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom if text gets too long
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, inputText, interimText]);

  // Generate dynamic text shadow based on outline color
  const getOutlineStyle = () => {
    return {
      textShadow: `
        3px 3px 0 ${outlineColor},
        -1px -1px 0 ${outlineColor},  
        1px -1px 0 ${outlineColor},
        -1px 1px 0 ${outlineColor},
        1px 1px 0 ${outlineColor}
      `
    };
  };

  // Determine text color and rendering classes based on style
  const getTextClasses = () => {
    switch (textStyle) {
      case TextStyle.OUTLINE:
        return 'text-white font-black tracking-wide';
      case TextStyle.BOX:
        return 'text-white bg-black/70 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm inline-block';
      default:
        // Simple style depends on background brightness
        if (bgMode === BackgroundMode.NORMAL) return 'text-gray-100';
        return 'text-white'; // Default to outline on chroma colors for visibility
    }
  };

  // Helper to determine if we should apply outline to a specific element
  const shouldApplyOutline = (isMainText: boolean) => {
    if (textStyle === TextStyle.OUTLINE) return true;
    if (textStyle === TextStyle.BOX && !isMainText) return false; // Box style usually only applies to main text or wraps it

    // For simple style, only apply outline if in chroma mode to ensure visibility against bright colors
    if (textStyle === TextStyle.SIMPLE && bgMode !== BackgroundMode.NORMAL) return true;

    return false;
  };

  const isEmpty = (!text || text.trim().length === 0) && (!inputText || inputText.trim().length === 0) && (!interimText || interimText.trim().length === 0);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-end items-center p-8 pb-16 overflow-y-auto no-scrollbar scroll-smooth"
    >
      <div className="max-w-[90%] text-center transition-all duration-300 ease-in-out flex flex-col gap-4">
        {isEmpty ? (
          <div className={`text-3xl font-semibold flex items-center justify-center gap-3 ${bgMode === BackgroundMode.NORMAL ? 'text-white' : 'text-black'}`}>
            {isListening ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="opacity-50">音声を聞いています...</span>
              </>
            ) : (
              <span className="opacity-30">音声待機中...</span>
            )}
          </div>
        ) : (
          <>
            {/* Input Text (Source) — confirmed recognition */}
            {inputText && (
              <div
                className={`text-2xl md:text-3xl lg:text-4xl opacity-80 mb-2 ${bgMode === BackgroundMode.NORMAL ? 'text-gray-400' : 'text-white'}`}
                style={{
                  fontFamily: sourceFont,
                  ...(bgMode !== BackgroundMode.NORMAL ? getOutlineStyle() : {})
                }}
              >
                {inputText}
              </div>
            )}

            {/* Interim Text — currently being spoken (real-time feedback) */}
            {interimText && (
              <div
                className={`text-xl md:text-2xl lg:text-3xl opacity-40 italic ${bgMode === BackgroundMode.NORMAL ? 'text-gray-500' : 'text-white'}`}
                style={{
                  fontFamily: sourceFont,
                  ...(bgMode !== BackgroundMode.NORMAL ? getOutlineStyle() : {})
                }}
              >
                {interimText}...
              </div>
            )}

            {/* Translated Text (Target) */}
            {text && (
              <div
                className={`text-5xl md:text-6xl lg:text-7xl leading-tight break-words ${getTextClasses()}`}
                style={{
                  fontFamily: targetFont,
                  ...(shouldApplyOutline(true) ? getOutlineStyle() : {})
                }}
              >
                {text}
              </div>
            )}
          </>
        )}
      </div>

      {/* Listening indicator when text is showing */}
      {!isEmpty && isListening && (
        <div className="mt-4 flex items-center gap-2 opacity-50">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className={`text-xs ${bgMode === BackgroundMode.NORMAL ? 'text-gray-400' : 'text-white'}`}>
            リスニング中
          </span>
        </div>
      )}
    </div>
  );
};