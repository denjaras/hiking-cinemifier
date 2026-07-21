# 引き継ぎ書 — hiking-cinemifier 音声トリガー修正

最終更新: 2026-07-21 21:19（Cowork ローカルセッション）→ 次: MBPで作業

## プロジェクト概要

ハイキング中にGPS位置をトリガーに、特定スポットに入ると対応する曲が流れるWebアプリ（素のHTML/JS + Leaflet、ビルドなし）。山中でのフィールド実験用。

- リポジトリ（作業用・公開）: https://github.com/denjaras/hiking-cinemifier
- 元リポジトリ（他人作、権限なし）: https://github.com/WMaranda/nature-music-tracker
- 公開URL（GitHub Pages, main/(root)から自動デプロイ）: https://denjaras.github.io/hiking-cinemifier/

## MBPでの始め方

```bash
git clone https://github.com/denjaras/hiking-cinemifier.git
cd hiking-cinemifier
# Claude Codeを開いて「HANDOVER.mdを読んで」から始める
```

※ このコミットがGitHubにpushされていることが前提。未pushならMBA側から `git push myfork main`。

## 完了済み

1. **状態遷移による音声制御**（app.js）: `currentPoi`/`outroPoi`で管理。
   進入=前の曲を即停止して新しい曲を頭から1回再生（loop無し）／滞在=何もしない（曲が終わってもリピートしない）／退出=曲は最後まで流し切って無音へ。曲終了時に`ended`リスナーでOUTRO→SILENTへ遷移。
2. **ヒステリシス**: 進入30m / 退出45m（`AUDIO_ENTER_RADIUS_M` / `AUDIO_EXIT_RADIUS_M`）。GPSブレによる再トリガー防止。
3. **全曲プリロード**: 起動時にfetch→Blob化＋Cache Storage保存。オフライン再生対応。完了までLocate meボタン無効。
4. **画面内デバッグパネル**: 状態（INSIDE/OUTRO/SILENT）、各POIまでの距離、進入/退出/曲終了のイベントログ。スマホだけで実地デバッグ可能。
5. **Screen Wake Lock**: トラッキング中は画面が自動消灯しない（対応ブラウザ）。タブ復帰時に再取得。
6. **改訂時刻表示**: `index.html`の`<h1>`内に`rev. YYYY-MM-DD HH:MM`。**push前に毎回手動更新すること**（新旧デプロイの判別用）。
7. **本番ルートの曲重複を解消**: 歩行順2・3番目のScenic vista 2箇所が両方Lion Kingだったのを、3番目（48.2649164, 16.3643214）を未使用だったIndiana Jones (Raiders March) に変更。現在の割り当て:
   - Wine bar → La La Land
   - Scenic vista (48.26516, 16.36153) → Lion King
   - Scenic vista (48.26492, 16.36432) → Indiana Jones
   - Town architecture → Interstellar
8. **テスト用POI（TEST 1-3, Westbahnhof）を削除**: `trails/test-westbahnhof.gpx.js`とindex.htmlのscriptタグを除去済み。

## 未確認・残タスク

1. **実機での実地確認**: 状態遷移・プリロード・Wake LockはコードレビューとローカルシミュレーションのみでiPhone実機未検証。特にiOS Safariの自動再生制限（`unlockPoiAudio()`がタップ時に走る設計）。
2. ユーザーが実地テストで見つけた問題があれば、デバッグパネルのログ（rev時刻付きスクショ）で切り分けてから修正。

## 制約・注意点

- **画面ロック中/バックグラウンドでは動かない**（Web/PWAの限界。GPS監視が止まる）。運用は「画面点灯＋ブラウザ前面」。Wake Lockで自動消灯だけは防止済み。
- 音声ファイル名にスペースあり。URLエンコード注意。
- Geolocation APIはHTTPS必須（GitHub Pagesは満たす）。
- `nussberg-nussdorf.gpx.js`内にコメントアウトの旧テスト地点1行あり（触らない）。
- デプロイ確認は公開URLのタイトル横のrev時刻で判別。push後1〜2分でPages再ビルド。
