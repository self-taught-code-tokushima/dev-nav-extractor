# Doc Nav Extractor

## 📖 概要
この Chrome 拡張機能は、Meta Horizon、Epic Games (Unreal Engine) および Unity の公式ドキュメントサイトにおいて、サイドバーのナビゲーションツリーを **階層構造のまま抽出** します。取得したデータは JSON、Markdown、CSV のいずれかの形式で表示・コピーでき、他のツールやドキュメント生成パイプラインにそのまま流用できます。

## 🌟 主な機能
- 対応サイト
  - `https://developers.meta.com/horizon/documentation/unity/*`
  - `https://dev.epicgames.com/documentation/*`
  - `https://docs.unity3d.com/Manual/*` および `.../Documentation/Manual/*`
- ページ上のサイドバーを自動で **全階層展開** し、すべての項目を取得
- 取得データを **JSON / Markdown / CSV** で出力
- クリップボードへワンクリックでコピー可能

## 🚀 使い方
1. Chrome の拡張機能ページ (`chrome://extensions/`) で **デベロッパーモード** を有効化
2. **パッケージ化されていない拡張機能を読み込む** をクリックし、`doc-nav-extractor` ディレクトリを選択
3. 対応ドキュメントページを開く
4. 拡張機能のポップアップで **「全階層を展開してリンクを取得」** ボタンを押す
5. 取得完了後に表示されるボタンで出力形式を切り替え、テキストエリアに結果が表示されます
6. **「クリップボードにコピー」** ボタンで結果をクリップボードにコピーできます

## 🛠️ 開発・ローカルビルド
```bash
# リポジトリをクローン
git clone https://github.com/self-taught-code-tokushima/doc-nav-extractor.git
cd doc-nav-extractor

# 依存は基本的に Chrome が提供する API のみで npm パッケージは不要です
# 拡張機能をロードする際は、上記の手順で「パッケージ化されていない拡張機能」を読み込んでください
```

## 📂 ディレクトリ構成
```
doc-nav-extractor/
├─ manifest.json            # Chrome Extension の設定
├─ popup.html / popup.js    # ポップアップ UI とロジック
├─ content-meta.js          # Meta Horizon 用コンテントスクリプト
├─ content-epic.js          # Epic Games 用コンテントスクリプト
├─ content-unity.js         # Unity 用コンテントスクリプト
├─ output/                  # 取得サンプル JSON (開発時のデバッグ用)
└─ .gitignore
```
