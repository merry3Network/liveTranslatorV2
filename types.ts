export enum BackgroundMode {
  NORMAL = 'normal',
  GREEN = 'green',
  BLUE = 'blue',
  MAGENTA = 'magenta'
}

export enum TextStyle {
  SIMPLE = 'simple',
  OUTLINE = 'outline',
  BOX = 'box'
}

export enum Persona {
  NONE = 'none',
  SAMURAI = 'samurai',
  TSUNDERE = 'tsundere',
  CAT = 'cat',
  BUTLER = 'butler'
}

export enum FontFamily {
  DEFAULT = 'sans-serif',
  NOTO_SANS = '"Noto Sans JP", sans-serif',
  ZEN_KAKU = '"Zen Kaku Gothic New", sans-serif',
  HINA_MINCHO = '"Hina Mincho", serif',
  KAISEI_DECOL = '"Kaisei Decol", serif',
  MPLUS_ROUNDED = '"M PLUS Rounded 1c", sans-serif',
  YUJI_SYUKU = '"Yuji Syuku", serif'
}

export interface TranslationConfig {
  sourceLang: string;
  targetLang: string;
  persona: Persona;
}

export interface LiveState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  currentText: string;
  history: string[];
}