document.addEventListener('DOMContentLoaded', () => {
  // Tab 切换
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // 立即整理按钮
  document.getElementById('btn-organize').addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'organizeAll' });
  });

  // 设置按钮
  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 加载统计数据
  loadStats();
});

async function loadStats() {
  const stats = await chrome.storage.local.get('stats');
  if (stats.stats) {
    document.getElementById('stat-total').textContent = stats.stats.totalBookmarks || 0;
    document.getElementById('stat-domains').textContent = stats.stats.totalDomains || 0;
    document.getElementById('stat-tags').textContent = stats.stats.totalTags || 0;
    document.getElementById('stat-duplicates').textContent = stats.stats.duplicates || 0;
    document.getElementById('stat-dead').textContent = stats.stats.deadLinks || 0;
  }
}
