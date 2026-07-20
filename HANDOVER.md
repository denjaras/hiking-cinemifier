# 引き継ぎ書 — hiking-cinemifier 音声トリガー修正

作成: 2026-07-20 / 前セッション: Cowork（ローカル）→ 次: Claude Code（リモート）

## プロジェクト概要

ハイキング中にGPS位置をトリガーに、特定スポット（半径20m）に入ると対応する曲が流れるWebアプリ（素のHTML/JS + Leaflet、ビルドなし）。山中でのフィールド実験に使う。**明日、別グループで実験があるため今日中に動く状態にする必要がある。**

- リポジトリ（作業用・公開）: https://github.com/denjaras/hiking-cinemifier
- 元リポジトリ（他人作、権限なし）: https://github.com/WMaranda/nature-music-tracker
- 公開URL（GitHub Pages, main/(root)から自動デプロイ）: https://denjaras.github.io/hiking-cinemifier/
- ローカルクローン: `~/KuraClaude/nature-music-tracker`（remote `myfork` = hiking-cinemifier）

## Git状態（2026-07-20 22:40時点）

- GitHub `main` = `20ab607`（状態遷移修正＋テスト地点、**デプロイ済み**）
- ローカルのみ = `d961853`（タイトルに改訂時刻表示を追加、**未push**）
- **最初にやること: ローカルMacから `git push myfork main` するか、リモート側で同等の変更（下記「改訂時刻」参照）を再実装する。**

## 元コードのバグ（修正済みのはず）

1. エリア離脱後も同じ曲が無限リピート（`audioEl.loop = true` ＋ 距離のみの毎回判定が原因）
2. 新エリア到達時に前の曲が止まらず重なる（POIごとに独立判定で「今何が鳴ってるか」を誰も管理していなかった）

## 実装した仕様（app.js）

状態遷移ベースに全面書き換え。キー変数: `currentPoi`（今いるエリア）、`outroPoi`（退出後に流し切り中の曲）。

- **進入（外→内）**: 前の曲を即停止し、新しい曲を頭から1回だけ再生（loop=false）
- **滞在（内→内）**: 何もしない。曲が終わってもリピートしない
- **退出（内→外）**: 曲は打ち切らず最後まで流す。終わったら次の進入まで無音
- **GPSブレ対策**: 進入判定20m / 退出判定35mのヒステリシス（`AUDIO_ENTER_RADIUS_M` / `AUDIO_EXIT_RADIUS_M`）
- **音量**: 常に100%固定。距離連動音量・フェードは廃止（実験仕様）
- **プリロード**: 起動時に全曲をfetch→Blob化して`blob:` URLで再生（オフライン対応）。Cache Storage APIにも保存。失敗時は元URLのストリーミングにフォールバック。プリロード完了まで「Locate me」ボタン無効、ステータスに進捗表示

主な関数: `updatePoiAudio()`（状態遷移本体）、`preloadAllPoiAudio()` / `preloadAudioFile()`、`playPoiAudioOnce()`、`stopPoiAudioHard()`

検証済み: 状態遷移ロジックをモックAudioで単体シミュレーション（ジッターで再トリガーなし／曲終了後リピートなし／退出時流しっぱなし／新エリア進入で前曲即停止）。**実機・実地テストは未実施。**

## テスト地点（追加済み: trails/test-westbahnhof.gpx.js）

西駅近く、ユーザーの自宅圏。2点間約225m。

| 地点 | 座標 | 曲 |
|---|---|---|
| TEST 1: Maria vom Siege | 48.1931875, 16.3378125 | Lion King - This Land |
| TEST 2: Alaturka Mahü | 48.1951875, 16.3373125 | La La Land - Credits |

`index.html` に `<script src="trails/test-westbahnhof.gpx.js">` を追加済み。本番前にこのファイルとscriptタグを消せば元に戻る。

## 改訂時刻の表示（ローカル未pushのd961853）

デプロイ版が新旧どちらかすぐ判別できるよう、`index.html` の `<h1 id="pageTitle">` 内に `<small>rev. YYYY-MM-DD HH:MM</small>` を表示する運用。**以後、変更をpushするたびにこの時刻を手動更新すること。**

## 未着手・次のタスク

1. **画面内デバッグパネル**（着手直前で中断）: 現地でスマホだけでデバッグできるよう、HUDに「現在の状態（INSIDE/OUTRO/SILENT）」「各POIまでの距離」「進入/退出/曲終了イベントの時刻付きログ」を表示するパネルを追加する。コンソールが見られない実地での問題切り分けが目的。
2. **実地テストで報告された問題の修正**: ユーザーは今日のテストで問題を確認しているが、それは旧コード（20ab607反映前）の可能性が高い。新版での症状を画面のrev時刻と合わせて確認してから直すこと。
3. iOSのSafari/Chrome実機での自動再生制限の挙動確認（`unlockPoiAudio()`がボタンタップ時に走る設計だが実機未確認）

## 注意点

- 音声ファイル名にスペースを含む（`audio/01. Lion King - This Land.mp3`等）。URLエンコード注意
- GPS（Geolocation API）はHTTPS必須 → GitHub Pagesは満たす
- `nussberg-nussdorf.gpx.js` 内にコメントアウトされた旧テスト地点あり（触らない）
- 実験本番のPOIは4点（うち2点は同じ曲を共有）
