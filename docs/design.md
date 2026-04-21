# Doc Nav Extractor — 設計・拡張ガイド

## 目次

1. [概要とゴール](#概要とゴール)
2. [アーキテクチャ全体像](#アーキテクチャ全体像)
3. [データフロー](#データフロー)
4. [コンポーネント詳細](#コンポーネント詳細)
   - [manifest.json](#manifestjson)
   - [popup.html / popup.js](#popuphtml--popupjs)
   - [コンテントスクリプト（共通パターン）](#コンテントスクリプト共通パターン)
5. [出力データ構造](#出力データ構造)
6. [サイト別実装の差分](#サイト別実装の差分)
7. [新しいサイトを追加する手順](#新しいサイトを追加する手順)
8. [設計上のトレードオフ](#設計上のトレードオフ)
9. [既知の制約と注意点](#既知の制約と注意点)

---

## 概要とゴール

**Doc Nav Extractor** は、技術ドキュメントサイトのサイドバーナビゲーションを **階層ツリー構造のまま** 丸ごと抽出する Chrome 拡張機能です。

主なユースケース:
- ドキュメント全体の目次マップを作る
- AI / LLM へのコンテキストとして「何のページが存在するか」を渡す
- jq などで後処理して特定セクションだけ抽出する

---

## アーキテクチャ全体像

```
┌─────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)             │
│                                             │
│  ┌──────────┐   メッセージ    ┌───────────┐ │
│  │ popup.js │ ────────────▶ │ content-  │ │
│  │ (UI制御) │ ◀──────────── │ *.js      │ │
│  └──────────┘   結果ツリー   └───────────┘ │
│       │                          │         │
│  popup.html                  対象ページの   │
│  (380px幅のUI)                DOM を操作    │
└─────────────────────────────────────────────┘
```

拡張機能は **バックグラウンドサービスワーカーを持たない** シンプルな構成で、`popup ↔ content script` の2層のみで動作します。

---

## データフロー

```
ユーザーがボタンをクリック
        │
        ▼
popup.js: chrome.tabs.sendMessage({ action: 'expandAndCollect' })
        │
        ▼
content-*.js: expandAllMenuItems()
  └─ 折りたたまれているメニューを検出してクリック（最大10パス）
  └─ React/Vue の状態更新を await で待機
        │
        ▼
content-*.js: collectNavTree()
  └─ walkItems() で DOM を再帰走査
  └─ { text, url, children[] } ツリーを構築
        │
        ▼
popup.js: result.tree を受け取る
  └─ JSON / Markdown / CSV に変換して表示
  └─ クリップボードにコピー可能
```

---

## コンポーネント詳細

### manifest.json

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "clipboardWrite"],
  "host_permissions": [ /* 対象ドメイン */ ],
  "content_scripts": [ /* URL パターンとスクリプトの対応 */ ]
}
```

**ポイント:**
- `clipboardWrite` は popup でのクリップボードコピーに必要
- `scripting` は将来的に `chrome.scripting.executeScript` を使う場合に備えているが、現状は `content_scripts` の静的注入のみ使用
- バックグラウンドスクリプト（`background.js`）は不要なため宣言していない

---

### popup.html / popup.js

popup.js の責務は **UI 制御と出力フォーマット変換のみ** で、DOM 操作の詳細を知らない。

```
popup.js の主な処理:
  1. 対応サイト判定（URLに含まれる文字列マッチ）
  2. content script へのメッセージ送信
  3. 受け取ったツリーを3形式に変換
     - JSON: JSON.stringify(tree, null, 2)
     - Markdown: 再帰的にインデント付きリスト生成
     - CSV: depth, text, url の3カラム
```

**フォーマット変換関数:**

| 関数 | 入力 | 出力 |
|---|---|---|
| `treeToMarkdown(nodes, depth)` | ノード配列 + 深さ | インデント付き Markdown リスト |
| `treeToCSVRows(nodes, depth)` | ノード配列 + 深さ | CSV 行の配列 |

---

### コンテントスクリプト（共通パターン）

3つのコンテントスクリプト（`content-meta.js`, `content-epic.js`, `content-unity.js`）は **同一のインターフェイスを実装** しています。

```
必須関数:
  getSidenav()          → Element|null   サイドバーのルート要素を返す
  expandAllMenuItems()  → Promise<number> 全項目を展開し、クリック数を返す
  walkItems(container)  → Array<Node>    DOM を再帰走査してツリーを構築
  collectNavTree()      → Array<Node>    ツリー全体を収集して返す
  countNodes(tree)      → number         ノード総数をカウント

メッセージハンドラ:
  chrome.runtime.onMessage.addListener で 'expandAndCollect' を受け付ける
  → { success, clickCount, tree, totalCount } を sendResponse
```

`countNodes` はサイト間で完全に同一のコードです（後述の「設計上のトレードオフ」参照）。

---

## 出力データ構造

収集されるツリーは以下の再帰的な Node 型です。

```typescript
type NavNode = {
  text: string;       // ナビゲーション項目のラベル
  url: string | null; // リンク先URL（展開専用の親ノードは null）
  children: NavNode[];
}

type NavTree = NavNode[];
```

**例（JSON出力）:**
```json
[
  {
    "text": "Get Started",
    "url": "https://dev.epicgames.com/documentation/...",
    "children": [
      {
        "text": "Installation",
        "url": "https://dev.epicgames.com/documentation/...",
        "children": []
      }
    ]
  }
]
```

---

## サイト別実装の差分

各サイトは DOM 構造が異なるため、以下の部分が異なります。

| 項目 | Meta Horizon | Epic Games | Unity |
|---|---|---|---|
| **サイドバー取得** | `#dmc-sidenav-scroll-container` または `#dmc-sidenav-container` | `ul.contents-table-list` | `#customScrollbar > ul` |
| **折りたたみ状態の検出** | `a[href="#"]` の親コンテナの `display:none` / `offsetHeight` / `maxHeight` | `button.btn-expander` 内の `i.icon-expander` に `is-rotated` クラスがあるか | `div.arrow.collapsed` の存在 |
| **展開トリガー** | `a[href="#"]` をクリック | `button.btn-expander` をクリック | `div.arrow.collapsed` をクリック |
| **ページ待機時間** | 150ms | 300ms（Vue更新が遅め） | 200ms |
| **リンク要素** | `a` タグ（id付き要素内） | `a.contents-table-link` | `li > a` |
| **ベースURL構築** | ハードコード `https://developers.meta.com` | ハードコード `https://dev.epicgames.com` | 現在のページURLから正規表現で動的生成 |

### ベースURL構築の違い

Unity のみ、バージョン番号付き URL（例: `/6000.3/Documentation/Manual/`）に対応するため、現在の `location.href` から動的にベース URL を取り出す実装になっています。

```js
// content-unity.js
const match = location.href.match(
  /(https:\/\/docs\.unity3d\.com\/(?:[\w.-]+\/)?(?:Documentation\/)?Manual\/)/
);
return match ? match[1] : 'https://docs.unity3d.com/Manual/';
```

---

## 新しいサイトを追加する手順

新しいドキュメントサイト（例: `docs.example.com`）に対応させる場合の手順です。

### ステップ 1: コンテントスクリプトを作成

`content-example.js` を作成し、以下のテンプレートに沿って実装します。

```js
// ==========================================
// Example Doc Nav Extractor
// content-example.js
// ==========================================

function getSidenav() {
  // TODO: サイドバーのルートコンテナを返す CSS セレクタを調整
  return document.querySelector('nav.sidebar-nav');
}

async function expandAllMenuItems() {
  const sidenav = getSidenav();
  if (!sidenav) throw new Error('ナビゲーションメニューが見つかりません');

  let totalClicked = 0;
  const MAX_PASSES = 10;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // TODO: 折りたたまれているボタンを特定するセレクタと条件を調整
    const collapsed = Array.from(sidenav.querySelectorAll('button.expand'))
      .filter(btn => !btn.classList.contains('is-open'));
    if (collapsed.length === 0) break;
    collapsed.forEach(btn => btn.click());
    totalClicked += collapsed.length;
    // TODO: サイトのフレームワーク（React/Vue 等）に合わせて待機時間を調整
    await new Promise(r => setTimeout(r, 200));
  }
  return totalClicked;
}

function walkItems(ul) {
  // TODO: li/a の構造に合わせて実装
  return Array.from(ul.querySelectorAll(':scope > li'))
    .map(li => {
      const a = li.querySelector(':scope > a');
      if (!a) return null;
      const href = a.getAttribute('href');
      const url = href ? (href.startsWith('http') ? href : 'https://docs.example.com' + href) : null;
      const childUl = li.querySelector(':scope > ul');
      const children = childUl ? walkItems(childUl) : [];
      return { text: a.textContent.trim(), url, children };
    })
    .filter(Boolean);
}

function collectNavTree() {
  const sidenav = getSidenav();
  if (!sidenav) return [];
  return walkItems(sidenav);
}

function countNodes(tree) {
  return tree.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'expandAndCollect') {
    (async () => {
      try {
        const clickCount = await expandAllMenuItems();
        const tree = collectNavTree();
        sendResponse({ success: true, clickCount, tree, totalCount: countNodes(tree) });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
```

### ステップ 2: manifest.json を更新

`host_permissions` と `content_scripts` に新しいサイトを追加します。

```json
{
  "host_permissions": [
    "https://developers.meta.com/*",
    "https://dev.epicgames.com/*",
    "https://docs.unity3d.com/*",
    "https://docs.example.com/*"   // 追加
  ],
  "content_scripts": [
    // ... 既存エントリ ...
    {
      "matches": ["https://docs.example.com/manual/*"],  // 追加
      "js": ["content-example.js"]
    }
  ]
}
```

### ステップ 3: popup.js の対応サイトリストを更新

```js
// popup.js
const supportedSites = [
  'developers.meta.com/horizon',
  'dev.epicgames.com/documentation',
  'docs.unity3d.com',
  'docs.example.com'  // 追加
];
```

### ステップ 4: 動作確認チェックリスト

- [ ] `getSidenav()` が正しい要素を返すか（DevTools で確認）
- [ ] 折りたたみ状態の判定が正しく機能するか
- [ ] `expandAllMenuItems()` 後に全階層が展開されているか
- [ ] `walkItems()` がすべてのノードを取得できているか
- [ ] 相対 URL が絶対 URL に正しく変換されているか

---

## 設計上のトレードオフ

### サイト別ファイル分割 vs 設定ベースの統合

**現状の設計:** サイトごとにコンテントスクリプトを分離（`content-meta.js`, `content-epic.js`, `content-unity.js`）

| 観点 | 現状（分離） | 統合（設定ファイル駆動） |
|---|---|---|
| 可読性 | ◎ 各サイトの実装が独立して読みやすい | △ 抽象化レイヤーが増えて複雑 |
| 追加のしやすさ | ◎ コピーして編集するだけ | ◯ 設定ファイルに追記するだけ |
| 重複コード | △ `countNodes` 等が各ファイルに存在 | ◎ 共通ロジックを1箇所に集約 |
| サイト間の干渉 | ◎ 完全に独立 | △ バグが全サイトに影響する可能性 |
| ファイル数 | △ サイトが増えると比例して増加 | ◎ 設定と本体の2ファイル |

**現状の判断:** 対応サイト数が少なく（3サイト）、各サイトの DOM 構造が大きく異なるため、分離のシンプルさを優先。対応サイトが5〜6以上に増えた場合は統合を検討する価値がある。

### 展開ループの上限（MAX_PASSES = 10）

無限ループを防ぐためのハードリミット。深くネストしたナビゲーション（10階層以上）では一部が展開されない可能性があるが、実際の技術ドキュメントでこれほどの深さは稀。

### 展開後の固定待機時間

React/Vue の状態更新完了を `setTimeout` で待つ実装は、ネットワーク状況やマシン性能によって失敗する可能性がある（150〜300ms では不足するケース）。`MutationObserver` で DOM 変化の完了を検知する方が堅牢だが、実装複雑度とのトレードオフで現状は固定待機を採用。

---

## 既知の制約と注意点

1. **サイトの DOM 変更への脆弱性**  
   CSS クラス名や要素構造が変更されると動作しなくなる。定期的にサイトの変更を確認する必要がある。

2. **非常に大きなナビゲーション**  
   数千件のノードを持つサイドバーでは、展開アニメーションや DOM 走査に時間がかかる場合がある。

3. **認証が必要なページ**  
   ログインが必要なドキュメントサイトには未対応（`host_permissions` の追加と認証状態の考慮が必要）。

4. **動的ローディング（遅延読み込み）**  
   スクロール連動でナビゲーション項目が動的に追加されるサイトには対応できない。現状の実装は初期 DOM に存在する項目のみを対象とする。
