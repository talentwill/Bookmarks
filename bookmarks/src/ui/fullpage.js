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
    const btn = document.getElementById('btn-organize');
    btn.disabled = true;
    btn.textContent = '整理中...';
    try {
      const result = await chrome.runtime.sendMessage({ action: 'organizeAll' });
      if (result.error) {
        btn.textContent = '失败';
      } else {
        btn.textContent = `完成 (${result.organized} 个)`;
      }
      setTimeout(() => { btn.textContent = '⚡ 立即整理'; btn.disabled = false; }, 2000);
      loadStatsAndDomains();
    } catch (e) {
      btn.textContent = '失败';
      setTimeout(() => { btn.textContent = '⚡ 立即整理'; btn.disabled = false; }, 2000);
    }
  });

  // 设置按钮
  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 搜索功能（带防抖）
  const searchInput = document.getElementById('search-input');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => performSearch(), 300);
  });

  // 重复检测
  document.getElementById('btn-find-duplicates').addEventListener('click', () => findDuplicates());

  // 失效链接检测
  document.getElementById('btn-check-dead-links').addEventListener('click', () => checkDeadLinks());

  // 加载数据（合并遍历）
  loadStatsAndDomains();
});

// ==================== 概览 + 域名管理（合并遍历） ====================

async function loadStatsAndDomains() {
  const tree = await chrome.bookmarks.getTree();
  const domainMap = new Map();
  let totalBookmarks = 0;

  function walk(nodes) {
    for (const node of nodes) {
      if (node.url) {
        totalBookmarks++;
        try {
          const host = new URL(node.url).hostname;
          if (!domainMap.has(host)) domainMap.set(host, []);
          domainMap.get(host).push({ id: node.id, title: node.title, url: node.url });
        } catch {}
      }
      if (node.children) walk(node.children);
    }
  }
  walk(tree);

  // 更新概览统计
  document.getElementById('stat-total').textContent = totalBookmarks;
  document.getElementById('stat-domains').textContent = domainMap.size;

  const stored = await chrome.storage.local.get(['stats', 'tagIndex']);
  const s = stored.stats || {};
  const tagIndex = stored.tagIndex || {};
  document.getElementById('stat-tags').textContent = Object.keys(tagIndex).length;
  document.getElementById('stat-duplicates').textContent = s.duplicates || 0;
  document.getElementById('stat-dead').textContent = s.deadLinks || 0;

  // 最近书签
  const recent = await chrome.bookmarks.getRecent(10);
  const recentContainer = document.getElementById('recent-bookmarks');
  if (recent.length === 0) {
    recentContainer.innerHTML = '<p class="empty-hint">暂无书签</p>';
  } else {
    recentContainer.innerHTML = recent.map(b => `
      <div class="bookmark-item">
        <div class="title">${escapeHtml(b.title || '无标题')}</div>
        <div class="url">${escapeHtml(b.url)}</div>
      </div>
    `).join('');
  }

  // 域名管理
  const domainContainer = document.getElementById('domain-list');
  const sorted = [...domainMap.entries()].sort((a, b) => b[1].length - a[1].length);

  if (sorted.length === 0) {
    domainContainer.innerHTML = '<p class="empty-hint">暂无书签</p>';
    return;
  }

  domainContainer.innerHTML = sorted.map(([domain, bookmarks]) => {
    const safeId = 'domain-' + domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `
      <div class="domain-item" data-target="${safeId}">
        <div class="domain-name">${escapeHtml(domain)}</div>
        <div class="domain-count">${bookmarks.length} 个书签</div>
      </div>
      <div class="domain-bookmarks" id="${safeId}" style="display:none;">
        ${bookmarks.map(b => `
          <div class="bookmark-item">
            <div class="title">${escapeHtml(b.title || '无标题')}</div>
            <div class="url">${escapeHtml(b.url)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  domainContainer.querySelectorAll('.domain-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.dataset.target;
      const detail = document.getElementById(targetId);
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });
  });
}

// ==================== 搜索 ====================

async function performSearch() {
  const query = document.getElementById('search-input').value.trim();
  const container = document.getElementById('search-results');

  if (!query) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<p class="empty-hint">搜索中...</p>';

  try {
    const results = await chrome.bookmarks.search(query);
    if (results.length === 0) {
      container.innerHTML = '<p class="empty-hint">未找到匹配的书签</p>';
      return;
    }

    container.innerHTML = results
      .filter(b => b.url)
      .map(b => `
        <div class="bookmark-item">
          <div class="title">${escapeHtml(b.title || '无标题')}</div>
          <div class="url">${escapeHtml(b.url)}</div>
        </div>
      `).join('');
  } catch (err) {
    container.innerHTML = `<p class="empty-hint">搜索出错: ${escapeHtml(err.message)}</p>`;
  }
}

// ==================== 重复检测 ====================

async function findDuplicates() {
  const btn = document.getElementById('btn-find-duplicates');
  const container = document.getElementById('duplicate-list');
  btn.disabled = true;
  btn.textContent = '扫描中...';
  container.innerHTML = '<p class="empty-hint">正在扫描重复书签...</p>';

  try {
    const result = await chrome.runtime.sendMessage({ action: 'findDuplicates' });
    btn.textContent = '扫描重复书签';
    btn.disabled = false;

    if (result.error) {
      container.innerHTML = `<p class="empty-hint">扫描出错: ${escapeHtml(result.error)}</p>`;
      return;
    }

    if (!result.duplicates || result.duplicates.length === 0) {
      container.innerHTML = '<p class="empty-hint">未发现重复书签</p>';
      return;
    }

    container.innerHTML = result.duplicates.map((group, i) => `
      <div class="duplicate-group">
        <div class="duplicate-header">
          <span class="duplicate-label">重复组 ${i + 1}</span>
          <span class="duplicate-count">${group.length} 个</span>
        </div>
        ${group.map(b => `
          <div class="bookmark-item">
            <div class="title">${escapeHtml(b.title || '无标题')}</div>
            <div class="url">${escapeHtml(b.url)}</div>
            <button class="btn btn-danger btn-sm" data-id="${b.id}">删除</button>
          </div>
        `).join('')}
      </div>
    `).join('');

    container.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const res = await chrome.runtime.sendMessage({ action: 'removeBookmark', bookmarkId: id });
          if (res?.error) {
            alert('删除失败: ' + res.error);
            return;
          }
          btn.closest('.bookmark-item').remove();
          loadStatsAndDomains();
        } catch (e) {
          alert('删除失败: ' + e.message);
        }
      });
    });
  } catch (e) {
    btn.textContent = '扫描重复书签';
    btn.disabled = false;
    container.innerHTML = `<p class="empty-hint">扫描出错: ${escapeHtml(e.message)}</p>`;
  }
}

// ==================== 失效链接检测 ====================

async function checkDeadLinks() {
  const btn = document.getElementById('btn-check-dead-links');
  const container = document.getElementById('dead-link-list');
  btn.disabled = true;
  btn.textContent = '检测中...';
  container.innerHTML = '<p class="empty-hint">正在检测失效链接，这可能需要一些时间...</p>';

  try {
    const result = await chrome.runtime.sendMessage({ action: 'checkDeadLinks' });
    btn.textContent = '检测失效链接';
    btn.disabled = false;

    if (result.error) {
      container.innerHTML = `<p class="empty-hint">检测出错: ${escapeHtml(result.error)}</p>`;
      return;
    }

    if (!result.deadLinks || result.deadLinks.length === 0) {
      container.innerHTML = '<p class="empty-hint">所有链接正常</p>';
      return;
    }

    container.innerHTML = result.deadLinks.map(b => `
      <div class="dead-link-item">
        <div class="dead-link-info">
          <div class="title">${escapeHtml(b.title || '无标题')}</div>
          <div class="url">${escapeHtml(b.url)}</div>
        </div>
        <div class="status ${b.isBlocked ? 'blocked' : 'dead'}">${formatStatus(b)}</div>
        <button class="btn btn-danger btn-sm" data-id="${b.id}">删除</button>
        <button class="btn btn-secondary btn-sm" data-url="${escapeHtml(b.url)}" data-action="keep">保留</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const res = await chrome.runtime.sendMessage({ action: 'removeBookmark', bookmarkId: id });
          if (res?.error) {
            alert('删除失败: ' + res.error);
            return;
          }
          btn.closest('.dead-link-item').remove();
          loadStatsAndDomains();
        } catch (e) {
          alert('删除失败: ' + e.message);
        }
      });
    });

    container.querySelectorAll('[data-action="keep"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.url;
        try {
          await chrome.runtime.sendMessage({ action: 'keepDeadLink', url });
          const item = btn.closest('.dead-link-item');
          item.classList.add('force-kept');
          item.querySelector('.status').textContent = '已保留';
          item.querySelector('.status').className = 'status force-kept';
          btn.remove();
          item.querySelector('.btn-danger')?.remove();
        } catch (e) {
          alert('操作失败: ' + e.message);
        }
      });
    });
  } catch (e) {
    btn.textContent = '检测失效链接';
    btn.disabled = false;
    container.innerHTML = `<p class="empty-hint">检测出错: ${escapeHtml(e.message)}</p>`;
  }
}

function formatStatus(b) {
  if (b.statusCode) {
    const statusMap = {
      404: '404 未找到',
      403: '403 禁止访问',
      429: '429 请求过多',
      500: '500 服务器错误',
      502: '502 网关错误',
      503: '503 服务不可用',
    };
    return statusMap[b.statusCode] || `${b.statusCode}`;
  }
  if (b.error === 'timeout') return '超时';
  if (b.error === 'network_error') return '网络错误';
  return b.error || '无法访问';
}

// ==================== 工具函数 ====================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
