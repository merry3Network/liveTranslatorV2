---
description: 作業開始前に Obsidian Vault から関連ナレッジを検索する
---

# /knowledge-search ワークフロー

作業開始前に、既存ナレッジを検索して活用するためのワークフロー。

## 手順

// turbo-all

1. **プロジェクト概要の確認**
   - `Projects/<ProjectName>/index.md` を読んで、プロジェクトの現在の状態を把握

2. **変更履歴の確認**
   - `Projects/<ProjectName>/changelog.md` の最新エントリ（上位 3-5 件）を確認
   - 直近の作業内容と変更点を把握

3. **関連 Issue の検索**
   - `Issues/` ディレクトリで関連キーワードを `grep` 検索
   - Open ステータスの Issue がないか確認
   ```bash
   grep -rl "status/open" Issues/ 2>/dev/null
   grep -rl "<検索キーワード>" Issues/ 2>/dev/null
   ```

4. **関連 Runbook の検索**
   - `Runbooks/` ディレクトリで関連手順がないか確認
   ```bash
   grep -rl "<検索キーワード>" Runbooks/ 2>/dev/null
   ```

5. **関連 Learning の検索**
   - `Learnings/` ディレクトリで過去の知見がないか確認
   ```bash
   grep -rl "<検索キーワード>" Learnings/ 2>/dev/null
   ```

6. **ADR の確認**
   - `Projects/<ProjectName>/decisions/` で過去の技術的意思決定を確認
   - 今回の作業に影響する決定がないか確認

7. **結果の報告**
   - 見つかった関連ナレッジをユーザーにまとめて報告
   - 特に注意すべき Issue や tip があれば強調
