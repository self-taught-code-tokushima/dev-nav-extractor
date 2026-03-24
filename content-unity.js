// ==========================================
// Unity Doc Nav Extractor
// content-unity.js
// ==========================================

function getSidenav() {
  const scrollbar = document.getElementById('customScrollbar');
  if (!scrollbar) return null;
  return scrollbar.querySelector(':scope > ul');
}

async function expandAllMenuItems() {
  const sidenav = getSidenav();
  if (!sidenav) throw new Error('ナビゲーションメニューが見つかりません');

  let totalClicked = 0;
  const MAX_PASSES = 10;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const collapsed = Array.from(sidenav.querySelectorAll('div.arrow.collapsed'));
    if (collapsed.length === 0) break;
    collapsed.forEach(div => div.click());
    totalClicked += collapsed.length;
    await new Promise(r => setTimeout(r, 200));
  }
  return totalClicked;
}

function getBaseUrl() {
  // 現在のページURLからベースURLを構築（バージョン付きURLに対応）
  // 例: https://docs.unity3d.com/6000.3/Documentation/Manual/index.html
  //   → https://docs.unity3d.com/6000.3/Documentation/Manual/
  // 例: https://docs.unity3d.com/Manual/index.html
  //   → https://docs.unity3d.com/Manual/
  const match = location.href.match(/(https:\/\/docs\.unity3d\.com\/(?:[\w.-]+\/)?(?:Documentation\/)?Manual\/)/);
  return match ? match[1] : 'https://docs.unity3d.com/Manual/';
}

function walkItems(ul, baseUrl) {
  return Array.from(ul.querySelectorAll(':scope > li'))
    .map(li => {
      const a = li.querySelector(':scope > a');
      if (!a) return null;
      const href = a.getAttribute('href');
      const url = href ? (href.startsWith('http') ? href : baseUrl + href) : null;
      const childUl = li.querySelector(':scope > ul');
      const children = childUl ? walkItems(childUl, baseUrl) : [];
      return { text: a.textContent.trim(), url, children };
    })
    .filter(Boolean);
}

function collectNavTree() {
  const sidenav = getSidenav();
  if (!sidenav) return [];
  const baseUrl = getBaseUrl();
  return walkItems(sidenav, baseUrl);
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
