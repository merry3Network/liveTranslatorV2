<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LiveTranslator (リアルタイム音声翻訳アプリ)

このプロジェクトは、**ブラウザ標準の音声認識 (Web Speech API)** と **各種AIエンジン (Ollama / Gemini / DeepL)** を組み合わせた、完全無料運用が可能なリアルタイム翻訳ツールです。
OBS のオーバーレイとして配信字幕に使用することを想定していますが、単体のウェブアプリとしても動作します。

## 🌟 主な機能

- **完全無料運用**: ブラウザ標準の Speech API を使用するため、音声認識にコストがかかりません。
- **ローカルAI対応 (Ollama)**: 推論を自宅のPC (Local GPU) で完結させることで、プライバシー保護と低コストを実現。
- **ハイブリッド構成**: クラウド (Gemini/DeepL) とローカル推論を環境に合わせて切り替え可能。
- **高耐久性**: ネットワーク瞬断時などの自動リトライ・再試行ロジックを搭載。
- **OBS 完全対応**: クロマキー背景 (グリーンバック等) や縁取り字幕、フォント変更機能を搭載。

## 🛠 テクノロジースタック

| 役割 | 技術 | 備考 |
|---|---|---|
| **音声認識 (STT)** | **Web Speech API** | ブラウザ内蔵機能。完全無料。 |
| **翻訳エンジン** | **Ollama** / **Gemini** / **DeepL** | ローカル推論とクラウドを選択可能。 |
| **フロントエンド** | React (Vite) / Tailwind CSS | 高速なUIとカスタマイズ性。 |
| **バックエンド** | Node.js (ws) | WebSocket による低遅延メッセージ中継。 |

## 🚀 クイックスタート

### 1. 準備
Node.js (>=18) がインストールされていることを確認してください。

### 2. セットアップ
```bash
npm install
cp .env.example .env
```
`.env` を開き、使用したいエンジンの API キーを設定してください。

### 3. ローカルAI (Ollama) を使用する場合
Ollama をインストールし、モデル（`gemma2:2b` 推奨）をダウンロードしてください。
```bash
brew install ollama
# サービス開始後
ollama pull gemma2:2b
```
`.env` の `ENABLE_LOCAL_AI=true` に設定することで有効になります。

### 4. 実行
```bash
# バックエンドサーバーの起動 (Terminal 1)
npm start

# フロントエンドの開発サーバー起動 (Terminal 2)
npm run dev:frontend
```
ブラウザで `http://localhost:5173` を開いてください。

## 📖 詳細ガイド
- [🔰 セットアップ詳細手順 (SETUP_GUIDE_JA.md)](./SETUP_GUIDE_JA.md)
- [🚀 デプロイガイド (README_DEPLOY.md)](./README_DEPLOY.md)

---
Created by Antigravity (Google DeepMind)

