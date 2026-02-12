# 🚀 最強最善・デプロイ完全ガイド

このドキュメントでは、本プロジェクトを「世界中どこからでも・リアルタイムに」利用可能にするための、最も安定して効率的なデプロイ手順を解説します。

## 🏛️ アーキテクチャ構成
本アプリは、以下の 2 つのサービスを組み合わせて公開します。

- **Frontend: [Vercel](https://vercel.com)**
  - **理由**: 静的配信に特化しており非常に高速。GitHub との連携が完璧で、変更をプッシュするだけで自動更新されます。
- **Backend: [Render](https://render.com)**
  - **理由**: 本アプリの核となる **WebSocket (リアルタイム通信)** を維持するために必要です。Vercel（Serverless）では WebSocket を長時間維持できないため、常時稼働型の Render Web Service を採用します。

---

## 🛠️ デプロイ手順 (5 ステップ)

### 1. GitHub リポジトリの準備
まず、コードをクラウドにアップロードする必要があります。
1. あなたの GitHub アカウントに、このプロジェクトを **Public または Private** でプッシュしてください。
   - **理由**: すべてのデプロイサービスは GitHub を「ソース」として動作するためです。

### 2. バックエンドのデプロイ (Render)
WebSocket サーバーを公開します。
1. [Render](https://render.com) にログインし、**"New" -> "Web Service"** を選択。
2. GitHub のリポジトリを選択。
3. **設定項目**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js` (または `npm start`)
4. **Environment Variables (最重要)**:
   - `API_KEY`: Gemini API キー
   - `DEEPL_API_KEY`: DeepL API キー
   - `PORT`: `10000` (Render のデフォルトポート)

> [!NOTE]
> デプロイが完了すると `https://xxx.onrender.com` という URL が発行されます。これをコピーしておいてください。

### 3. フロントエンドのデプロイ (Vercel)
アプリの画面を公開します。
1. [Vercel](https://vercel.com) にログインし、**"Add New" -> "Project"**。
2. GitHubリポジトリをインポート。
3. **設定項目**:
   - Framework Preset は `Vite` が自動選択されます。
4. **Environment Variables**:
   - `VITE_BACKEND_URL`: ステップ 2 でコピーした Render の URL。
   - **重要**: 先頭を `https://` ではなく `wss://` に変更してください。
     - 例: `wss://your-backend.onrender.com`

---

### 4. WebSocket 通信の疎通確認
なぜ `wss://` に書き換えるのか？
- **理由**: ブラウザのセキュリティ上、`https` ページから `ws` (暗号化なし) への通信はブロックされます。Render は SSL をサポートしているため、セキュアな WebSocket である `wss` を指定する必要があります。

### 5. 動作確認 & トラブルシューティング
1. Vercel の公開 URL にアクセス。
2. **ブラウザのデベロッパーツール (F12)** を開き、Console に `Connected to WebSocket` と出れば成功です。
3. もし `Forbidden` と出る場合は、DeepL の API キーが `.env` 通りに設定されているか再確認してください。

---

## 💎 この手順が「最強」である理由
- **コストゼロ**: どちらのサービスも無料枠内で開始できます。
- **スケーラビリティ**: アクセスが増えても、設定を変えるだけで上位プランに移行可能です。
- **自動化 (CI/CD)**: コードを修正して `git push` するだけで、バックエンドもフロントエンドも数分で自動更新されます。
