# 🚀 LiveTranslator 完全デプロイガイド (Vercel + ローカル VM 構成)

この手順書では、**Vercel（フロントエンド）** と **ローカル VM 上の Node.js + Ollama（バックエンド）** を組み合わせた、完全無料・低遅延な翻訳環境の構築手順を解説します。初めての人でも A to Z でデプロイできることを目指しています。

## 📐 全体アーキテクチャ

```
[ユーザーのブラウザ]
       |  (Vercel でホスティング)
[Vercel フロントエンド]
       | wss:// (WebSocket over TLS)
[Cloudflare Tunnel]  ← インターネット公開の橋渡し
       | HTTP://localhost:3001
[VM: Node.js (server.js)] ← バックエンド (PM2 で常時稼働)
       | HTTP://localhost:11434
[VM: Ollama (gemma2:2b)] ← ローカル AI 翻訳エンジン
```

## 📋 事前準備・必要なもの

| 項目 | 必要なもの | 備考 |
|---|---|---|
| **ホスト PC** | MacBook Pro (Intel, 8GB+ RAM) | UTM で仮想化 |
| **Cloudflare アカウント** | 無料プランでOK | [cloudflare.com](https://cloudflare.com) |
| **Vercel アカウント** | 無料プランでOK | [vercel.com](https://vercel.com) |
| **UTM** (仮想化ソフト) | 最新版 | [mac.getutm.app](https://mac.getutm.app) |
| **Ubuntu Server ISO** | 22.04 LTS | [ubuntu.com](https://ubuntu.com/download/server) |
| **GitHub リポジトリ** | `liveTranslatorV2` のフォーク or クローン | Vercel と連携するため必要 |

---

## 🏗️ ステップ 1: UTM で仮想マシンを作成

### 1.1 UTM の設定 (Intel Mac 向け最適値)

> [!IMPORTANT]
> Intel Mac では必ず **「Virtualization（仮想化）」** を選択してください。「Emulation（エミュレーション）」は数十倍遅くなり実用に耐えません。

| 設定項目 | 推奨値 | 理由 |
|---|---|---|
| **モード** | **Virtualization** | Emulationは極端に遅い |
| **OS** | **Linux** | Ubuntu Server を選択 |
| **CPU コア数** | **4** | ホスト側の安定性とのバランス |
| **メモリ (RAM)** | **8GB** (ホストが16GBの場合) | Ollama の動作に最低 4GB 必要 |
| **ストレージ** | **40GB 以上** | モデルファイルが数GB必要 |
| **アーキテクチャ** | **x86_64** | Intel Mac のネイティブ環境 |

### 1.2 Ubuntu Server 22.04 インストール (A to Z)

1. UTM で VM を起動し、ダウンロードした Ubuntu ISO を選択して起動。
2. **Language**: `English` を選択。
3. **Keyboard Configuration**: `Layout: Japanese` → `Done`。
4. **Network Connections**: `DHCP` で IP 取得を確認して `Done`。
5. **Configure Proxy**: **何も入力せず空欄のまま `Done`**。
6. **Ubuntu Archive Mirror**: デフォルトのまま `Done`。
7. **Storage Config**: `Use an entire disk` → `Done` → `Continue`。
8. **Profile Setup**: 任意のユーザー名とパスワードを設定。
9. **SSH Setup（超重要）**: **`Install OpenSSH server` にチェック（Space キー）** を入れて `Done`。
10. **Featured Server Snaps**: 何も選択せず `Done`。
11. インストール完了後 `Reboot Now` が表示されたら実行。

#### ❗ トラブル: 再起動できない (ISO のアンマウントエラー)
`Reboot` 後に画面が止まる場合:
1. UTM で VM を **強制停止（Stop）**。
2. UTM の VM 設定 → ドライブ → ISO イメージの行で **「消去（Clear）」** をクリック。
3. VM を再起動。

---

## 🛠️ ステップ 2: VM 環境のセットアップ

### 2.1 Mac から SSH 接続する (推奨)

UTM のコンソール画面はクリップボード共有がないため、Mac のターミナルから SSH 接続して作業するのが効率的です。

```bash
# VM の IP アドレス確認 (UTM コンソール内で実行)
hostname -I

# Mac のターミナルから SSH 接続
ssh あなたのユーザー名@VMのIPアドレス
# 例: ssh rsk@192.168.64.3
```

### 2.2 システムの更新

```bash
sudo apt update && sudo apt upgrade -y
```
> [!NOTE]
> アップグレード中に画面が切り替わり UI が表示される場合があります。`GRUB` のデバイス選択では **スペースキーで `[*]` を付けてから Enter**。その他はデフォルトのまま進めてください。

### 2.3 Node.js のインストール (nvm 経由)

```bash
# nvm をインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# シェルの設定を再読み込み
source ~/.bashrc

# Node.js v20 をインストール
nvm install 20

# バージョン確認
node -v   # v20.x.x と表示されればOK
npm -v
```

> [!IMPORTANT]
> nvm 環境では `sudo npm` は使用しないでください。パスの不一致でコマンドが見つかりません。`sudo` なしで `npm install -g` を実行します。

### 2.4 Ollama のインストールとモデルのダウンロード

```bash
# Ollama をインストール
curl -fsSL https://ollama.com/install.sh | sh

# 翻訳モデルをダウンロード (Intel Mac VM の場合 gemma2:2b を推奨)
# ※ ダウンロードに数分かかります
ollama pull gemma2:2b

# 動作確認 (対話モードで起動、Ctrl+D で終了)
ollama run gemma2:2b
```

### 2.5 ソースコードの配置

```bash
# GitHub からクローン (URL はご自身のリポジトリに合わせてください)
git clone https://github.com/merry3Network/liveTranslatorV2.git LiveTranslator
cd LiveTranslator

# 依存関係のインストール
npm install
```

### 2.6 環境変数 (`.env`) の作成

```bash
# .env ファイルを作成
cat <<EOF > .env
PORT=3001
ENABLE_LOCAL_AI=true
OLLAMA_MODEL=gemma2:2b
OLLAMA_URL=http://localhost:11434/api/generate
EOF

# 内容を確認
cat .env
```

以下のように表示されればOKです：
```
PORT=3001
ENABLE_LOCAL_AI=true
OLLAMA_MODEL=gemma2:2b
OLLAMA_URL=http://localhost:11434/api/generate
```

### 2.7 PM2 でサーバーを常時稼働させる

```bash
# PM2 をグローバルにインストール (sudo は不要)
npm install -g pm2

# プロジェクトディレクトリ内からサーバーを起動 (cd を忘れずに！)
cd ~/LiveTranslator
pm2 start server.js --name live-translator

# ログを確認 (以下のメッセージが表示されれば成功)
pm2 logs --lines 10
```

ログに以下が表示されれば正常起動しています：
```
Translation Server running on port 3001
🚀 LOCAL AI MODE ENABLED - Using Ollama (gemma2:2b)
```

```bash
# VM 再起動後も自動起動するように設定
pm2 save
pm2 startup
# ↑ 表示されたコマンドをコピーして実行してください
```

---

## ☁️ ステップ 3: Cloudflare Tunnel でバックエンドを公開

フロントエンド（Vercel, HTTPS）からバックエンドに接続するためには、**セキュアな公開 URL (wss://)** が必要です。Cloudflare Tunnel を使ってポート 3001 をインターネットに公開します。

### 3.1 Cloudflare Tunnel のインストール

[Cloudflare Zero Trust ダッシュボード](https://one.dash.cloudflare.com/) にログイン後:
1. `Networks` → `Tunnels` → **`+ Create a tunnel`** をクリック。
2. `Cloudflared` を選択して `Next`。
3. トンネル名（例: `ubuntu-server`）を入力して `Save tunnel`。
4. **OS: `Debian`**、**Architecture: `64-bit`** を選択。
5. 表示された `curl` コマンドを VM のターミナルで実行。
6. VM が「接続済み」と表示されたら `Next`。

> [!NOTE]
> Ubuntu は Debian ベースのため、インストーラー選択で `Debian` を選ぶのが正解です。

### 3.2 公開 URL の設定（2択）

#### 🅐 独自ドメインをお持ちの場合（恒久設定・推奨）

Cloudflare に登録されたドメインを使って固定 URL を作成します：

1. トンネルの設定画面 → `Public Hostnames` タブ → **`+ Add a public hostname`**。
2. 以下のように設定：
   - **Subdomain**: `api` （任意の名前）
   - **Domain**: ご自身のドメインを選択
   - **Service Type**: `HTTP`、**URL**: `localhost:3001`
3. `Save hostname` をクリック。

→ `https://api.yourdomain.com` で VM のバックエンドにアクセス可能になります。

#### 🅑 ドメインをお持ちでない場合（Quick Tunnel・テスト用）

ドメインなしで即座に一時的な URL を発行できます。**既存のトンネルサービスを停止してから**実行してください：

```bash
# 既存の cloudflared サービスを停止
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared

# Quick Tunnel を起動（ポート 3001 を公開）
cloudflared tunnel --url http://localhost:3001
```

ログに表示される URL（例: `https://driven-lady-sandra-farms.trycloudflare.com`）を控えてください。

> [!WARNING]
> Quick Tunnel の URL は **起動するたびにランダムに変わります**。
> VM を再起動した後は新しい URL を発行し、Vercel の環境変数も更新が必要です。

---

## 🔗 ステップ 4: Vercel の設定と再デプロイ

### 4.1 Vercel 環境変数の設定

[Vercel ダッシュボード](https://vercel.com) → プロジェクト → `Settings` → `Environment Variables`

| Key | Value |
|---|---|
| `VITE_BACKEND_URL` | `wss://your-tunnel-url.trycloudflare.com`（または `wss://api.yourdomain.com`）|

> [!IMPORTANT]
> プロトコルは必ず **`wss://`**（WebSocket Secure）を使用してください。`ws://` や `https://` では接続できません。

### 4.2 フロントエンドを再デプロイ

ローカルのコードに変更があれば git push、なければ Vercel ダッシュボードから `Redeploy` を実行してください。

```bash
# ローカルの変更をコミット＆プッシュ
git add -A
git commit -m "fix: update deployment configuration"
git push origin main
```

---

## ✅ 動作確認

1. Vercel のアプリを **Chrome または Edge** で開く（Web Speech API が必要）。
2. **F12** → `Console` タブを開く。
3. 「翻訳開始」ボタンをクリック。
4. コンソールに `Connecting to translation engine at: wss://...` と表示されることを確認。
5. テストボタン「こんにちは...」を押して翻訳結果が表示されれば **デプロイ完了** です🎉

---

## 🔧 トラブルシューティング

| エラー / 症状 | 原因 | 解決策 |
|---|---|---|
| **再起動できない (ISO アンマウントエラー)** | ISO がドライブに残っている | UTM で VM 停止 → ドライブ設定の ISO を「消去」→ 再起動 |
| **`sudo npm` が見つからない** | nvm 環境での sudo の挙動 | `sudo` を付けずに `npm install -g pm2` を実行 |
| **PM2: `Script not found`** | `pm2 start` を Wrong ディレクトリで実行 | `cd ~/LiveTranslator` で移動してから実行 |
| **接続できない (`api.example.com`)** | ガイドの例示ドメインで実際には存在しない | 自分のドメインを使うか Quick Tunnel を使用 |
| **`DeepL API Key is missing` エラー** | `ENABLE_LOCAL_AI=true` が PM2 に反映されていない | `pm2 delete live-translator && pm2 start server.js --name live-translator` で再作成 |
| **Ollama が `phi` モデルで起動する** | `.env` に `OLLAMA_MODEL` がなくデフォルト値が使われた | `echo "OLLAMA_MODEL=gemma2:2b" >> ~/LiveTranslator/.env` して PM2 再作成 |
| **wss 接続エラー (URLが表示される)** | `VITE_BACKEND_URL` が未設定または誤り | Vercel の環境変数を確認・更新して再デプロイ |

---

## 🛠️ 管理コマンド集

### PM2 (バックエンドプロセス管理)

| コマンド | 内容 |
|---|---|
| `pm2 status` | 全プロセスの稼働状況・CPU/メモリ一覧 |
| `pm2 logs live-translator` | リアルタイムログの表示 |
| `pm2 logs --lines 50` | 最新50行のログを表示 |
| `pm2 restart live-translator` | プロセスの再起動 |
| `pm2 delete live-translator` | プロセスを完全に削除（`.env` 変更後はこちら） |
| `pm2 monit` | グラフィカルなリソースモニター |

### Ollama (翻訳エンジン)

| コマンド | 内容 |
|---|---|
| `ollama list` | インストール済みモデルの一覧 |
| `ollama run gemma2:2b` | モデルを対話モードで起動（テスト用） |
| `ollama ps` | 現在実行中のモデルを確認 |

### システム確認

| コマンド | 内容 |
|---|---|
| `hostname -I` | VM の IP アドレスを確認 |
| `htop` | CPU/RAM のリソース使用状況（`q` で終了） |
| `df -h` | ディスクの空き容量を確認 |
| `sudo systemctl status cloudflared` | Cloudflare Tunnel の状態を確認 |
