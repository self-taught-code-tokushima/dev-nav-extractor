// ==========================================
// Meta Horizon Unity Nav Extractor
// content.js
// ==========================================

/**
 * サイドバーコンテナを取得する
 * @returns {Element|null}
 */
function getSidenav() {
  return document.getElementById('dmc-sidenav-scroll-container')
    || document.getElementById('dmc-sidenav-container');
}

/**
 * サイドバーの全展開ボタンをクリックして全階層を開く
 * @returns {Promise<number>} 展開したボタン数
 */
async function expandAllMenuItems() {
  const sidenav = getSidenav();
  if (!sidenav) throw new Error('サイドバーが見つかりません');

  // 折りたたまれているコンテナを持つ展開ボタンのみを取得
  const getCollapsedButtons = () =>
    Array.from(sidenav.querySelectorAll('a[href="#"]')).filter(a => {
      // 親のコンテンツコンテナが折りたたみ状態かを確認
      const titleDiv = a.closest('[id]');
      const contentDiv = titleDiv?.parentElement?.children[1];
      if (!contentDiv) return false;
      // 安定した判定: 非表示(display:none) または高さ0の子コンテナ
      const style = window.getComputedStyle(contentDiv);
      return style.display === 'none'
        || contentDiv.offsetHeight === 0
        || style.maxHeight === '0px';
    });

  let totalClicked = 0;
  const MAX_PASSES = 10; // 無限ループ防止

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const collapsed = getCollapsedButtons();
    if (collapsed.length === 0) break;

    // 全て一括クリック
    collapsed.forEach(btn => btn.click());
    totalClicked += collapsed.length;

    // Reactのstate更新とアニメーションを待つ
    await new Promise(r => setTimeout(r, 150));

    // 新しく展開された子に折りたたみ項目がないか再チェック
    const stillCollapsed = getCollapsedButtons();
    if (stillCollapsed.length === 0) break;
  }

  return totalClicked;
}

/**
 * 相対URLを絶対URLに変換する
 * @param {string} href
 * @returns {string}
 */
function toAbsoluteUrl(href) {
  if (!href || href === '#') return null;
  const baseUrl = 'https://developers.meta.com';
  return href.startsWith('http') ? href : baseUrl + href;
}

/**
 * サイドバーのDOM構造を再帰的に走査してツリーを構築する
 * @param {Element} container - 子アイテムを含むコンテナ要素
 * @returns {Array<{text: string, url: string|null, children: Array}>}
 */
function walkItems(container) {
  return Array.from(container.children).map(item => {
    if (item.id) {
      // リーフノード: IDあり、実リンクあり
      const a = item.querySelector('a');
      if (!a) return null;
      return {
        text: a.textContent.trim(),
        url: toAbsoluteUrl(a.getAttribute('href')),
        children: []
      };
    } else {
      // 親ノード: IDなし、href="#" の開閉ボタン + 子コンテナ
      const titleDiv = item.children[0];
      const contentDiv = item.children[1];
      const a = titleDiv?.querySelector('a');
      if (!a) return null;
      const innerWrapper = contentDiv?.children?.[0];
      const children = innerWrapper ? walkItems(innerWrapper) : [];
      return {
        text: a.textContent.trim(),
        url: null,
        children
      };
    }
  }).filter(Boolean);
}

/**
 * サイドバーからナビゲーションツリーを収集する
 * @returns {Array<{text: string, url: string|null, children: Array}>}
 */
function collectNavTree() {
  const sidenav = getSidenav();
  if (!sidenav) return [];
  const rootContainer = sidenav.children[0];
  if (!rootContainer) return [];
  return walkItems(rootContainer);
}

/**
 * ツリーのノード数を再帰的にカウントする
 */
function countNodes(tree) {
  return tree.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

// Chrome Extension のメッセージハンドラ
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'expandAndCollect') {
    (async () => {
      try {
        // Step 1: 全階層を展開
        const clickCount = await expandAllMenuItems();
        // Step 2: ツリー構造で収集
        const tree = collectNavTree();
        sendResponse({
          success: true,
          clickCount,
          tree,
          totalCount: countNodes(tree)
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // 非同期レスポンスのために必要
  }
});
