# 🚀 LiveTranslator 最適デプロイガイド (Vercel + ローカル VM 構成)

この手順書では、**完全無料**かつ**低遅延・高安定**な翻訳環境を構築するための「ローカル VM 集約型」の構成を解説します。

---

## 🏗️ ステップ 1: ローカル VM (UTM) の構築

### 1.1 MacBook Pro 2018 (Intel) 向けの最適設定
Intel Mac で UTM を使用する場合、**「仮想化 (Virtualization)」** を選択することが最も重要です。

| 設定項目 | 推奨値 | 理由 |
|---|---|---|
| **基本設定** | **Virtualization** | 「Emulation」は極端に遅いため必ず仮想化を選択。 |
| **OS** | **Linux (Ubuntu 22.04 LTS)** | 最も情報が多く、安定しています。 |
| **CPU コア数** | **4 Cores** | MBP2018の物理コアを活かしつつ、ホスト側も安定。 |
| **メモリ (RAM)** | **4GB 〜 8GB** | ホストが16GBなら8GB、8GBなら4GBを割り当て。 |
| **アーキテクチャ** | **x86_64** | Intel Mac のネイティブ環境に合わせる。 |

---

### 1.2 Ubuntu Server 22.04 初回インストール手順 (A to Z)

1. **Language**: `English`
2. **Keyboard Configuration**: `Layout: Japanese` -> `Done`。
3. **Network Connections**: `DHCP` で IP 取得を確認して `Done`。
4. **Configure Proxy**: **何も入力せず空欄で `Done`**。
5. **Storage Config**: `Use an entire disk` -> `Done` -> `Continue`。
6. **Profile Setup**: ユーザ名とパスワードを設定。
7. **SSH Setup (超重要)**: **Install OpenSSH server** に **[X]** を入れる。
8. **Installing system**: 完了すると `Reboot Now` が表示されます。

#### ⚠️ トラブル解決：ISO のアンマウントエラー
再起動できない場合は、UTM で VM を一度停止し、ドライブ設定から **ISO イメージを「消去 (Clear)」** してから再度起動してください。

---

## 🛠️ ステップ 2: サーバー環境のセットアップ (VM 内)

### 2.1 SSH 接続による操作 (推奨)
Mac のターミナルから `ssh ユーザー名@IPアドレス` で接続してください（詳細略）。

### 2.2 システム更新、Node.js、Ollama のインストール
```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# Node.js (nvm経由)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull gemma2:2b
```

### 2.3 ソースコードの配置と依存関係のインストール
VM 内でプロジェクトを動かすために、ソースコードをダウンロード（クローン）します。

```bash
# リポジトリのクローン（URLはご自身のものに置き換えてください）
git clone https://github.com/takumit-png/discord-gijiroku-bot.git LiveTranslator
cd LiveTranslator

# 依存関係のインストール
npm install
```

### 2.4 環境変数 (.env) の設定
接続先やローカル AI の使用設定を行います。
```bash
# .env ファイルの作成
cat <<EOF > .env
PORT=3001
ENABLE_LOCAL_AI=true
OLLAMA_HOST=http://localhost:11434
EOF
```

---

## ☁️ ステップ 3: Cloudflare Tunnel でバックエンドを公開

### 3.1 ダッシュボードでの OS/Architecture 選択
1. **Operating System**: **`Debian`**
2. **Architecture**: **`64-bit`**

### 3.2 パブリックホスト名の設定
1. **Public Hostname**: **`api.tbbs.com`**
2. **Service**: `HTTP://localhost:3001`

---

## 🚀 ステップ 4: Vercel 連携 & 常時稼働

### 4.1 Vercel 環境変数の設定
`VITE_BACKEND_URL` に **`wss://api.tbbs.com`** を設定。

### 4.2 バックエンドの常時稼働 (PM2)
**必ずプロジェクトのディレクトリ内で実行してください。**

```bash
cd ~/LiveTranslator
npm install -g pm2
pm2 start server.js --name "live-translator"
pm2 save
pm2 startup
```
