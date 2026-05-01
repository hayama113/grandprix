# Grand Prix Quiz v1

F1創世記から近年までをテーマにした、非公式ファン向けクイズアプリのスターター版です。

## 中身

- `index.html`：アプリ画面
- `style.css`：デザイン
- `app.js`：クイズ処理
- `questions.json`：問題データ
- `question-data.js`：ローカル表示用の予備データ
- `manifest.json`：PWA設定
- `service-worker.js`：オフラインキャッシュ
- `question_template.csv`：問題追加用テンプレート

## 使い方

1. ZIPを解凍
2. GitHub Pagesなどにアップロード
3. `index.html`を開く
4. iPhone / Android のブラウザで「ホーム画面に追加」

## 問題を増やす方法

`questions.json`に以下の形式で追加してください。

```json
{
  "id": "gpq_99999",
  "category": "F1マシン・技術",
  "difficulty": 2,
  "question": "問題文",
  "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
  "answer": 0,
  "explanation": "解説文",
  "era": "2020s",
  "tags": ["technology"]
}
```

`answer` は 0 始まりです。

- 0 = 1番
- 1 = 2番
- 2 = 3番
- 3 = 4番

## 注意

このアプリは非公式ファン向けです。

- 公式ロゴは使わない
- 公式写真は使わない
- 公式動画は使わない
- 公式・公認と誤認される表現は使わない
- ゴシップ系は断定調を避ける
- 追加問題は公式結果・FIA文書・信頼できる記録で確認する

## 今後の拡張案

- 1,000問版
- 10,000問版
- 問題検索
- CSVインポート
- ランキング
- 称号追加
- 問題ごとの出典URL管理
- 最新シーズンだけ差し替えできる `season_latest.json` 分離
