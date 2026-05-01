# Grand Prix Quiz v1.4.2 Clean

500問版と紛らわしい古いCSVを削除したクリーン版です。

## 問題数

- questions.json: 1000問
- question-data.js: 1000問
- questions_starter_1000.csv: 1000問

## 重要

GitHubにアップロードするときは、ZIPそのものではなく、このフォルダ内のファイルをリポジトリ直下へ置いてください。

## 必須ファイル

- index.html
- style.css
- app.js
- questions.json
- question-data.js
- manifest.json
- service-worker.js

## キャッシュ対策

v1.4.2では、CSS/JSに `?v=1.4.1` を付け、service-workerのキャッシュ名も更新しています。


## v1.4.2修正

- ホーム画面の固定表示を「1,000問収録」に修正
- CSS/JSのキャッシュ番号を `?v=1.4.2` に更新
- service-workerのキャッシュ名を `grand-prix-quiz-v1-4-2` に更新

もしアプリ上でまだ500問表示の場合、GitHub Pagesが古い `index.html` / `questions.json` / `question-data.js` を配信している、またはSafari/PWAキャッシュが残っています。
