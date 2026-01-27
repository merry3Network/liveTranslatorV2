# デプロイガイド (公開手順)

このプロジェクトをインターネット上で公開するための手順です。

## 1. 事前準備
- **GitHub アカウント**
- **Vercel アカウント** (フロントエンド用)
- **Render アカウント** (バックエンド用)
- **Google Gemini API キー**
- **Deepgram API キー**

## 2. バックエンドのデプロイ (Render)
Node.js サーバー (`server.js`) を動かすために Render を使います。

1. このリポジトリを自分の GitHub にフォーク (コピー) してください。
2. [Render](https://render.com) にログインします。
3. **New +** ボタンから **Web Service** を選択します。
4. GitHub のリポジトリを連携・選択します。
5. 設定項目:
    - **Runtime**: Node
    - **Build Command**: `npm install`
    - **Start Command**: `node server.js`
6. **Environment Variables (環境変数)** の設定:
    - `API_KEY`: あなたの Google Gemini API キー
    - `DEEPGRAM_API_KEY`: あなたの Deepgram API キー
7. **Create Web Service** をクリックします。
8. デプロイ完了後、**Service URL** (例: `https://gemini-live-translator-backend.onrender.com`) をコピーしておきます。

## 3. フロントエンドのデプロイ (Vercel)
React アプリ画面を Vercel で公開します。

1. [Vercel](https://vercel.com) にログインします。
2. **Add New** -> **Project** をクリックします。
3. 同じ GitHub リポジトリをインポートします。
4. **Environment Variables (環境変数)** の設定:
    - `VITE_BACKEND_URL`: 先ほどコピーした Render の URL を貼り付けます。
      - **重要**: 先頭の `https://` を `wss://` に書き換えてください。
      - 例: `wss://gemini-live-translator-backend.onrender.com`
5. **Deploy** をクリックします。

## 4. 動作確認
1. Vercel で生成された URL を開きます。
2. 初回「Connect」ボタンを押して、翻訳機能が動くか確認してください。
