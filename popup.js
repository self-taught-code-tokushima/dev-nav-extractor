let collectedTree = [];
document.getElementById('extract-btn').addEventListener('click', async () => {
  const btn = document.getElementById('extract-btn');
  const status = document.getElementById('status');
  btn.disabled = true;
  status.textContent = '⏳ 展開中...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // content.js が対象ページにいるか確認
    const supportedSites = [
      'developers.meta.com/horizon',
      'dev.epicgames.com/documentation',
      'docs.unity3d.com'
    ];
    if (!supportedSites.some(site => tab.url.includes(site))) {
      status.textContent = '❌ 対応サイトのドキュメントページで実行してください';
      btn.disabled = false;
      return;
    }
    // content.js にメッセージ送信
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'expandAndCollect' });
    if (result.success) {
      collectedTree = result.tree;
      status.textContent =
        `✅ 完了！ ${result.totalCount} 件のアイテムを取得（展開ボタン: ${result.clickCount}回）`;
      document.getElementById('format-btns').style.display = 'flex';
      showFormat('json');
    } else {
      status.textContent = `❌ エラー: ${result.error}`;
    }
  } catch (err) {
    status.textContent = `❌ エラー: ${err.message}`;
  }
  btn.disabled = false;
});
document.getElementById('copy-btn').addEventListener('click', () => {
  const output = document.getElementById('output');
  navigator.clipboard.writeText(output.value).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✅ コピーしました！';
    setTimeout(() => { btn.textContent = '📋 クリップボードにコピー'; }, 2000);
  });
});
// フォーマット切り替えボタンのイベントリスナー
document.getElementById('format-btns').addEventListener('click', (e) => {
  const format = e.target.dataset.format;
  if (format) showFormat(format);
});

/**
 * ツリーをMarkdown形式のインデント付きリストに変換する
 */
function treeToMarkdown(nodes, depth) {
  return nodes.map(node => {
    const indent = '  '.repeat(depth);
    const label = node.url ? `[${node.text}](${node.url})` : node.text;
    const line = `${indent}- ${label}`;
    if (node.children.length > 0) {
      return line + '\n' + treeToMarkdown(node.children, depth + 1);
    }
    return line;
  }).join('\n');
}

/**
 * ツリーをフラットなCSV行に変換する
 */
function treeToCSVRows(nodes, depth) {
  const rows = [];
  for (const node of nodes) {
    const url = node.url || '';
    rows.push(`${depth},"${node.text.replace(/"/g, '""')}","${url}"`);
    if (node.children.length > 0) {
      rows.push(...treeToCSVRows(node.children, depth + 1));
    }
  }
  return rows;
}

function showFormat(format) {
  const output = document.getElementById('output');
  const copyBtn = document.getElementById('copy-btn');
  let text = '';
  if (format === 'json') {
    text = JSON.stringify(collectedTree, null, 2);
  } else if (format === 'markdown') {
    text = treeToMarkdown(collectedTree, 0);
  } else if (format === 'csv') {
    const header = 'depth,text,url';
    const rows = treeToCSVRows(collectedTree, 0);
    text = [header, ...rows].join('\n');
  }
  output.value = text;
  output.style.display = 'block';
  copyBtn.style.display = 'block';
}
