<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Gemini Live Translator (リアルタイム翻訳アプリ)

このプロジェクトは、Google Gemini 2.0 Flash と Deepgram Nova 2 を組み合わせたリアルタイム音声翻訳アプリです。
OBS のオーバーレイとして使用することを想定していますが、単体のウェブアプリとしても動作します。

## 主な機能
- **超低遅延**の音声認識 (Deepgram) と翻訳 (Gemini)
- **OBS 対応**: 背景透過モード搭載 (グリーン/ブルー/マゼンタバック)
- **字幕スタイル変更**: アウトライン、ボックス、ゴーストなどのスタイル選択
- **双方向性は未実装**: 現状は「入力音声 -> 翻訳字幕」の一方通行です。

## クイックリンク
- [🔰 初心者向けセットアップガイド (SETUP_GUIDE_JA.md)](./SETUP_GUIDE_JA.md) - まずはこちら！
- [🚀 デプロイガイド (README_DEPLOY.md)](./README_DEPLOY.md) - インターネット公開手順
- [AI Studio で見る](https://ai.studio/apps/drive/1fn9tWkEgT4VNMlhRFtS07sORtowt_56U)

## ローカルでの実行方法

**前提条件:** Node.js がインストールされていること

1. 依存関係のインストール:
   ```bash
   npm install
   ```
2. 環境変数の設定:
   - `.env.local` ファイルを作成し、`GEMINI_API_KEY` と `DEEPGRAM_API_KEY` を設定してください。
3. アプリの起動:
   ```bash
   npm run dev
   ```

