let collectedLinks = [];
document.getElementById('extract-btn').addEventListener('click', async () => {
  const btn = document.getElementById('extract-btn');
  const status = document.getElementById('status');
  btn.disabled = true;
  status.textContent = '⏳ 展開中...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // content.js が対象ページにいるか確認
    if (!tab.url.includes('developers.meta.com/horizon')) {
      status.textContent = '❌ Meta Horizon Unityドキュメントページで実行してください';
      btn.disabled = false;
      return;
    }
    // content.js にメッセージ送信
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'expandAndCollect' });
    if (result.success) {
      collectedLinks = result.links;
      status.textContent =
        `✅ 完了！ ${result.totalCount} 件のリンクを取得（展開ボタン: ${result.clickCount}回）`;
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
function showFormat(format) {
  const output = document.getElementById('output');
  const copyBtn = document.getElementById('copy-btn');
  let text = '';
  if (format === 'json') {
    text = JSON.stringify(collectedLinks, null, 2);
  } else if (format === 'markdown') {
    text = collectedLinks.map(l => {
      const indent = '  '.repeat(l.depth);
      return `${indent}- [${l.text}](${l.absoluteUrl})`;
    }).join('\n');
  } else if (format === 'csv') {
    const header = 'depth,text,url';
    const rows = collectedLinks.map(l =>
      `${l.depth},"${l.text.replace(/"/g, '""')}","${l.absoluteUrl}"`
    );
    text = [header, ...rows].join('\n');
  }
  output.value = text;
  output.style.display = 'block';
  copyBtn.style.display = 'block';
}
