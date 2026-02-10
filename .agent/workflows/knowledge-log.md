---
description: 作業完了時にナレッジを Obsidian Vault に記録する
---

# /knowledge-log ワークフロー

作業完了後に、Vault へナレッジを蓄積するためのワークフロー。

## 手順

1. **変更ログの追記**
   - `Projects/<ProjectName>/changelog.md` を開く
   - ファイルの先頭（YAML frontmatter の直後）に新しいエントリを追加
   - エントリ形式:
     ```markdown
     ## YYYY-MM-DD — [変更のタイトル]
     ### 変更内容
     - 具体的な変更点をリストで記載
     ### 変更理由
     - なぜこの変更を行ったか
     ### 影響範囲
     - 変更が影響するファイル・コンポーネント
     ### 関連
     - [[Issues/xxx]] や [[Learnings/xxx]] へのリンク
     ```

2. **Issue の確認と更新**
   - 作業中に Issue を解決した場合:
     - 該当 Issue ファイルのステータスを `Resolved` に変更
     - 解決策を記述
     - YAML frontmatter の `status/open` を `status/resolved` に変更

3. **新しい Learning があれば記録**
   - 作業中に新しい知見を得た場合は `Learnings/` にファイルを作成
   - ファイル名: `YYYY-MM-DD_<topic>.md`
   - `_templates/learning.md` のフォーマットに従う

4. **ADR が必要であれば記録**
   - 重要な技術選定・設計判断をした場合は `Projects/<ProjectName>/decisions/` にファイルを作成
   - 既存 ADR の番号を確認して連番にする

// turbo-all
5. **Project Index の更新確認**
   - `Projects/<ProjectName>/index.md` にアーキテクチャや技術スタックの変更があれば反映
