// ==========================================
// {SiteName} Doc Nav Extractor
// content-{site}.js
// ==========================================

/**
 * サイドバーコンテナを取得する
 * @returns {Element|null}
 */
function getSidenav() {
  // TODO: ユーザーから渡された CSS セレクタに差し替える
  return document.querySelector('{CSS_SELECTOR}');
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
    // TODO: HTML サンプルを解析して折りたたみ状態の要素セレクタを特定する
    const collapsed = Array.from(sidenav.querySelectorAll('{COLLAPSED_SELECTOR}'))
      .filter(el => {
        // TODO: 折りたたみ状態の判定ロジックを HTML 構造から導出する
        return true; // placeholder
      });
    if (collapsed.length === 0) break;
    collapsed.forEach(el => el.click());
    totalClicked += collapsed.length;
    // TODO: サイトのフレームワーク（React/Vue 等）に応じて調整（目安: React=150ms, Vue=300ms, vanilla=100ms）
    await new Promise(r => setTimeout(r, 200));
  }
  return totalClicked;
}

/**
 * ナビゲーションリストを再帰的に走査してツリーを構築する
 */
function walkItems(container, baseUrl) {
  // TODO: HTML サンプルの構造に合わせて実装する
  // 参考パターン（ul > li > a 構造の場合）:
  return Array.from(container.querySelectorAll(':scope > li'))
    .map(li => {
      const a = li.querySelector(':scope > a');
      if (!a) return null;
      const href = a.getAttribute('href');
      const url = href ? (href.startsWith('http') ? href : baseUrl + href) : null;
      const childContainer = li.querySelector(':scope > ul');
      const children = childContainer ? walkItems(childContainer, baseUrl) : [];
      return { text: a.textContent.trim(), url, children };
    })
    .filter(Boolean);
}

/**
 * ベース URL を返す（相対 href を絶対 URL に変換するために使用）
 */
function getBaseUrl() {
  // TODO: サイトの URL 構造に応じて実装する
  // 固定の場合: return 'https://example.com';
  // バージョン番号付き URL の場合は location.href から正規表現で抽出する
  return 'https://{DOMAIN}';
}

/**
 * サイドバーからナビゲーションツリーを収集する
 */
function collectNavTree() {
  const sidenav = getSidenav();
  if (!sidenav) return [];
  const baseUrl = getBaseUrl();
  return walkItems(sidenav, baseUrl);
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
        sendResponse({ success: true, clickCount, tree, totalCount: countNodes(tree) });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
