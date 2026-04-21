---
name: add-nav-site
description: Doc Nav Extractor Chrome 拡張機能（doc-nav-extractor）に新しい対応サイトを追加するスキル。ユーザーが「新しいサイトを追加したい」「〇〇サイトに対応させたい」「content script を追加したい」と明示的に言った場合のみ起動する。自動起動しない。
---

# Add Nav Site スキル

Doc Nav Extractor に新しいドキュメントサイトのナビゲーション抽出を追加する。

## プロジェクトの場所

現在の作業ディレクトリ（リポジトリルート）がプロジェクトの場所。

変更対象ファイル:
- `content-{site}.js` — 新規作成
- `manifest.json` — `host_permissions` と `content_scripts` に追記
- `popup.js` — `supportedSites` 配列に追記

## ステップ 1: ユーザーへの情報収集

以下の2点を順番に確認する（まとめて聞いても可）:

**① HTML サンプルの保存**

```
Chrome DevTools でナビゲーション要素（サイドバー全体）を右クリック → 
「outerHTML をコピー」して、プロジェクト内の以下のパスに保存してください:

  .claude/tmp/nav-html-samples/{site-name}.html

保存したらパスを教えてください。
```

**② CSS セレクタの確認**

```
getSidenav() 関数でサイドバーのルート要素を特定するための CSS セレクタを教えてください。
DevTools の Console で document.querySelector('{セレクタ}') を試して、
目的の要素が取れることを確認してから教えてください。
```

また同時に確認:
- **サイト名**（例: `godot`, `aws`, `mdn`）— ファイル名 `content-{site}.js` に使う
- **URL パターン**（例: `https://docs.godotengine.org/en/*`）— manifest に追加

## ステップ 2: HTML サンプルの解析

ユーザーが HTML サンプルを保存したら Read ツールで読み込んで以下を調べる:

1. **展開ボタンの特定**: 折りたたまれた子メニューを開くためのクリック要素
   - ボタン/アイコン/div など何がクリック対象か
   - 展開済み vs 折りたたみ状態の違い（クラス名、属性）
2. **リンク要素の特定**: `<a>` タグのセレクタとネスト構造
3. **子コンテナの特定**: 子メニューを含む要素（`ul`, `div` など）
4. **URL の形式**: 相対パスか絶対パスか、ベース URL は固定かバージョン付きか

既存の実装パターンは `references/existing-implementations.md` を参照。

## ステップ 3: content-{site}.js の生成

`references/content-script-template.js` をベースに、解析結果を埋め込んで `content-{site}.js` を作成する。

実装すべき関数:
- `getSidenav()` — ユーザー提供セレクタを使用
- `expandAllMenuItems()` — 折りたたみ要素を検出してクリック（最大10パス）
- `walkItems(container, baseUrl)` — DOM を再帰走査してツリー構築
- `getBaseUrl()` — 相対 href の絶対化に使うベース URL
- `collectNavTree()` — getSidenav + walkItems をつなぐ
- `countNodes(tree)` — ノード総数カウント（全サイト共通ロジック）
- メッセージハンドラ — `expandAndCollect` アクションを処理

## ステップ 4: manifest.json と popup.js の更新

**manifest.json** に追記:
```json
// host_permissions に追加
"https://{domain}/*"

// content_scripts に追加
{
  "matches": ["{URL_PATTERN}"],
  "js": ["content-{site}.js"]
}
```

**popup.js** の `supportedSites` 配列に追加:
```js
// 例
'docs.godotengine.org'
```

## 完了後の確認事項

ユーザーに以下を案内する:

1. Chrome の `chrome://extensions/` でリロード（拡張機能カードの更新ボタン）
2. 対象サイトを開いてポップアップを起動
3. 「全階層を展開してリンクを取得」ボタンをクリックして動作確認
