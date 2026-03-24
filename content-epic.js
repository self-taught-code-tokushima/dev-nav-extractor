// ==========================================
// Epic Games UE Doc Nav Extractor
// content-epic.js
// ==========================================

/**
 * サイドバーコンテナを取得する
 * @returns {Element|null}
 */
function getSidenav() {
  return document.querySelector('ul.contents-table-list');
}

/**
 * サイドバーの全展開ボタンをクリックして全階層を開く
 * @returns {Promise<number>} 展開したボタン数
 */
async function expandAllMenuItems() {
  const sidenav = getSidenav();
  if (!sidenav) throw new Error('ナビゲーションメニューが見つかりません');

  let totalClicked = 0;
  const MAX_PASSES = 10;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // is-rotated なし = 未展開（aria-label は言語依存のため避ける）
    const collapsed = Array.from(
      sidenav.querySelectorAll('button.btn-expander')
    ).filter(btn => {
      const icon = btn.querySelector('i.icon-expander');
      return icon && !icon.classList.contains('is-rotated');
    });
    if (collapsed.length === 0) break;
    collapsed.forEach(btn => btn.click());
    totalClicked += collapsed.length;
    await new Promise(r => setTimeout(r, 300)); // Vue更新待ち
  }
  return totalClicked;
}

/**
 * ul 要素内の li を再帰的に走査してツリーを構築する
 * @param {Element} ul - ul.contents-table-list 要素
 * @returns {Array<{text: string, url: string|null, children: Array}>}
 */
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
    })
    .filter(Boolean);
}

/**
 * サイドバーからナビゲーションツリーを収集する
 * @returns {Array<{text: string, url: string|null, children: Array}>}
 */
function collectNavTree() {
  const sidenav = getSidenav();
  if (!sidenav) return [];
  return walkItems(sidenav);
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
        const clickCount = await expandAllMenuItems();
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
