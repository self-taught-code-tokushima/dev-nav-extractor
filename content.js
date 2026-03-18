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
 * サイドバーから全リンクを収集する
 * @returns {Array<{text: string, href: string, depth: number, absoluteUrl: string}>}
 */
function collectAllLinks() {
  const sidenav = getSidenav();
  if (!sidenav) return [];

  const baseUrl = 'https://developers.meta.com';
  const seen = new Set();

  return Array.from(sidenav.querySelectorAll('a[href]:not([href="#"])'))
    .map(a => {
      // IDパターン（例: "カテゴリ-2_1-0_2-3"）からネスト深度を計算
      const closestId = a.closest('[id]')?.id || '';
      const depth = (closestId.match(/_\d+-/g) || []).length;
      const href = a.getAttribute('href');
      const absoluteUrl = href.startsWith('http') ? href : baseUrl + href;
      const text = a.textContent.trim();
      return { text, href, absoluteUrl, depth };
    })
    .filter(link => {
      // 重複除去（同じURLが複数存在する場合がある）
      if (seen.has(link.absoluteUrl)) return false;
      seen.add(link.absoluteUrl);
      return true;
    });
}

/**
 * 収集したリンクをJSON形式に整形する
 */
function formatAsJson(links) {
  return JSON.stringify(links, null, 2);
}

/**
 * 収集したリンクをMarkdown形式に整形する
 */
function formatAsMarkdown(links) {
  return links.map(link => {
    const indent = '  '.repeat(link.depth);
    return `${indent}- [${link.text}](${link.absoluteUrl})`;
  }).join('\n');
}

/**
 * 収集したリンクをCSV形式に整形する
 */
function formatAsCsv(links) {
  const header = 'depth,text,url';
  const rows = links.map(l =>
    `${l.depth},"${l.text.replace(/"/g, '""')}","${l.absoluteUrl}"`
  );
  return [header, ...rows].join('\n');
}

// Chrome Extension のメッセージハンドラ
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'expandAndCollect') {
    (async () => {
      try {
        // Step 1: 全階層を展開
        const clickCount = await expandAllMenuItems();
        // Step 2: 全リンクを収集
        const links = collectAllLinks();
        sendResponse({
          success: true,
          clickCount,
          links,
          totalCount: links.length
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // 非同期レスポンスのために必要
  }
});
