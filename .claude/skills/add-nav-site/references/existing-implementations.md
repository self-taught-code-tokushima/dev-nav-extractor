# 既存の content script 実装例

このファイルは、HTML 解析時の参考として既存の実装パターンを示す。
新サイトの `walkItems` / `expandAllMenuItems` を実装するときに参照すること。

## パターン比較

| サイト | `getSidenav` セレクタ | 展開トリガー | 折りたたみ判定 | 待機時間 |
|---|---|---|---|---|
| Meta | `#dmc-sidenav-scroll-container` (fallback: `#dmc-sidenav-container`) | `a[href="#"]` | 親コンテナの `display:none` / `offsetHeight` / `maxHeight` | 150ms |
| Epic | `ul.contents-table-list` | `button.btn-expander` | `i.icon-expander` に `.is-rotated` がないか | 300ms |
| Unity | `#customScrollbar > ul` | `div.arrow.collapsed` | `.collapsed` クラスの有無 | 200ms |

## Meta Horizon の実装（DOM が複雑な例）

```js
// 折りたたみ判定が特殊（CSS 計算値を使う）
const getCollapsedButtons = () =>
  Array.from(sidenav.querySelectorAll('a[href="#"]')).filter(a => {
    const titleDiv = a.closest('[id]');
    const contentDiv = titleDiv?.parentElement?.children[1];
    if (!contentDiv) return false;
    const style = window.getComputedStyle(contentDiv);
    return style.display === 'none'
      || contentDiv.offsetHeight === 0
      || style.maxHeight === '0px';
  });

// walkItems が2パターンの li を処理（ID あり=リーフ、IDなし=親ノード）
function walkItems(container) {
  return Array.from(container.children).map(item => {
    if (item.id) {
      // リーフノード
      const a = item.querySelector('a');
      if (!a) return null;
      return { text: a.textContent.trim(), url: toAbsoluteUrl(a.getAttribute('href')), children: [] };
    } else {
      // 親ノード（href="#" の開閉ボタン + 子コンテナ）
      const titleDiv = item.children[0];
      const contentDiv = item.children[1];
      const a = titleDiv?.querySelector('a');
      if (!a) return null;
      const innerWrapper = contentDiv?.children?.[0];
      const children = innerWrapper ? walkItems(innerWrapper) : [];
      return { text: a.textContent.trim(), url: null, children };
    }
  }).filter(Boolean);
}
```

## Epic Games の実装（シンプルな ul > li 構造）

```js
// getSidenav
return document.querySelector('ul.contents-table-list');

// expandAllMenuItems: is-rotated クラスの有無で判定
const collapsed = Array.from(sidenav.querySelectorAll('button.btn-expander'))
  .filter(btn => {
    const icon = btn.querySelector('i.icon-expander');
    return icon && !icon.classList.contains('is-rotated');
  });

// walkItems
function walkItems(ul) {
  return Array.from(ul.querySelectorAll(':scope > li.contents-table-item'))
    .map(li => {
      const a = li.querySelector(':scope > div.contents-table-el > a.contents-table-link');
      if (!a) return null;
      const href = a.getAttribute('href');
      const url = href ? (href.startsWith('http') ? href : 'https://dev.epicgames.com' + href) : null;
      const childUl = li.querySelector(':scope > ul.contents-table-list');
      const children = childUl ? walkItems(childUl) : [];
      return { text: a.textContent.trim(), url, children };
    }).filter(Boolean);
}
```

## Unity の実装（バージョン付き URL 対応）

```js
// getSidenav
const scrollbar = document.getElementById('customScrollbar');
if (!scrollbar) return null;
return scrollbar.querySelector(':scope > ul');

// getBaseUrl: バージョン番号付き URL から動的に生成
function getBaseUrl() {
  const match = location.href.match(
    /(https:\/\/docs\.unity3d\.com\/(?:[\w.-]+\/)?(?:Documentation\/)?Manual\/)/
  );
  return match ? match[1] : 'https://docs.unity3d.com/Manual/';
}

// expandAllMenuItems
const collapsed = Array.from(sidenav.querySelectorAll('div.arrow.collapsed'));
```
