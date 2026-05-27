// bookmarks/src/background/service-worker.js
import { flattenBookmarks } from './bookmark-listener.js';
import { classify } from '../core/classifier.js';
import { generateTagsForBookmark } from '../core/tag-generator.js';
import { findDuplicates } from '../core/duplicate-detector.js';
import { checkLink } from '../core/dead-link-checker.js';
import { createStorageService } from '../services/storage.js';

// 点击扩展图标时在新标签页打开全屏 UI
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/fullpage.html') });
});

// Service Worker 安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('书签智能整理插件已安装');
});

// 防止并发整理的锁
let isOrganizing = false;

// 实时监听新书签
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark.url) return;
  try {
    await organizeBookmark(bookmark);
  } catch (e) {
    console.error('[监听] 整理新书签失败:', bookmark.title, e.message);
  }
});

// 处理来自 UI 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'organizeAll') {
    organizeAll().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'findDuplicates') {
    findAllDuplicates().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'checkDeadLinks') {
    checkAllDeadLinks().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'removeBookmark') {
    chrome.bookmarks.remove(message.bookmarkId).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'keepDeadLink') {
    keepDeadLink(message.url).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

// ==================== 一键整理 ====================

async function organizeAll() {
  if (isOrganizing) {
    return { success: false, error: '正在整理中，请稍候' };
  }
  isOrganizing = true;

  try {
    const tree = await chrome.bookmarks.getTree();
    const allBookmarks = flattenBookmarks(tree);
    const storage = createStorageService(chrome);

    // 预加载 config 和 folders，避免每个书签重复读取
    const config = await storage.getConfig(['deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel']);
    const folders = await storage.getDomainFolders();

    let organized = 0;
    for (const bookmark of allBookmarks) {
      try {
        await organizeBookmark(bookmark, storage, config, folders);
        organized++;
      } catch (e) {
        console.error('[整理] 失败:', bookmark.title, e.message);
      }
    }

    await updateStats();
    return { success: true, organized };
  } finally {
    isOrganizing = false;
  }
}

// ==================== 重复检测 ====================

async function findAllDuplicates() {
  const tree = await chrome.bookmarks.getTree();
  const allBookmarks = flattenBookmarks(tree);
  const duplicateGroups = findDuplicates(allBookmarks);

  const storage = createStorageService(chrome);
  const existing = (await storage.getConfig('stats')) || {};
  existing.duplicates = duplicateGroups.length;
  await storage.setConfig({ stats: existing });

  return {
    success: true,
    duplicates: duplicateGroups.map(group => group.map(b => ({
      id: b.id,
      title: b.title,
      url: b.url,
      dateAdded: b.dateAdded,
    }))),
  };
}

// ==================== 失效链接检测 ====================

async function checkAllDeadLinks() {
  const tree = await chrome.bookmarks.getTree();
  const allBookmarks = flattenBookmarks(tree);
  const storage = createStorageService(chrome);
  const keptUrls = (await storage.getConfig('keptDeadLinks')) || [];

  const results = [];
  for (let i = 0; i < allBookmarks.length; i += 5) {
    const batch = allBookmarks.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (b) => {
        const result = await checkLink(b.url, 10000);
        return { ...result, id: b.id, title: b.title };
      })
    );
    results.push(...batchResults);
    if (i + 5 < allBookmarks.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 过滤掉用户已保留的链接
  const deadLinks = results.filter(r => (r.isDead || r.isBlocked) && !keptUrls.includes(r.url));

  const existing = (await storage.getConfig('stats')) || {};
  existing.deadLinks = deadLinks.length;
  await storage.setConfig({ stats: existing });

  return {
    success: true,
    deadLinks: deadLinks.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      statusCode: r.statusCode,
      error: r.error,
      isBlocked: r.isBlocked,
    })),
  };
}

async function keepDeadLink(url) {
  const storage = createStorageService(chrome);
  const kept = (await storage.getConfig('keptDeadLinks')) || [];
  if (!kept.includes(url)) {
    kept.push(url);
    await storage.setConfig({ keptDeadLinks: kept });
  }
  return { success: true };
}

// ==================== 统计更新 ====================

async function updateStats() {
  const tree = await chrome.bookmarks.getTree();
  const allBookmarks = flattenBookmarks(tree);
  const domains = new Set();
  for (const b of allBookmarks) {
    try { domains.add(new URL(b.url).hostname); } catch {}
  }

  const storage = createStorageService(chrome);
  const existing = (await storage.getConfig('stats')) || {};
  existing.totalBookmarks = allBookmarks.length;
  existing.totalDomains = domains.size;
  existing.lastOrganized = Date.now();
  await storage.setConfig({ stats: existing });
}

// ==================== 核心整理逻辑 ====================

async function organizeBookmark(bookmark, storage, config, folders) {
  // 快速跳过非 HTTP URL
  if (!bookmark.url || !bookmark.url.startsWith('http')) return;

  // 延迟初始化（兼容 onCreated 调用路径）
  if (!storage) storage = createStorageService(chrome);
  if (!config) config = await storage.getConfig(['deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel']);
  if (!folders) folders = await storage.getDomainFolders();

  // 分类
  const { cleanedUrl, domain, folderName } = classify(bookmark.url, bookmark.title);
  if (!domain) return; // 无法解析的 URL，跳过

  // 获取或创建域名文件夹
  let folderId = folders[domain];

  if (!folderId) {
    try {
      const [root] = await chrome.bookmarks.getSubTree('1');
      const existing = findFolderByTitle(root, folderName);
      if (existing) {
        folderId = existing.id;
      } else {
        const newFolder = await chrome.bookmarks.create({
          parentId: '1',
          title: folderName,
        });
        folderId = newFolder.id;
      }
      folders[domain] = folderId;
      await storage.setDomainFolder(domain, folderId);
    } catch (e) {
      console.error(`[整理] 创建文件夹失败 [${folderName}]:`, e.message);
      return;
    }
  }

  // 检查是否已在正确的文件夹中
  if (String(bookmark.parentId) === String(folderId)) {
    return;
  }

  // 移动书签
  try {
    await chrome.bookmarks.move(bookmark.id, { parentId: String(folderId) });
  } catch (e) {
    console.error(`[整理] 移动书签失败 [${bookmark.title}]:`, e.message);
    return;
  }

  // 生成标签（如果有 API Key）
  if (config?.deepseekApiKey) {
    try {
      const tags = await generateTagsForBookmark({
        title: bookmark.title,
        url: cleanedUrl,
        domain,
      }, {
        apiKey: config.deepseekApiKey,
        baseUrl: config.deepseekBaseUrl || 'https://api.deepseek.com',
        model: config.deepseekModel || 'deepseek-chat',
      });

      if (tags.length > 0) {
        const storage2 = createStorageService(chrome);
        const tagIndex = (await storage2.getConfig('tagIndex')) || {};
        tagIndex[bookmark.id] = tags;
        await storage2.setConfig({ tagIndex });
      }
    } catch (e) {
      console.error(`[整理] 标签生成失败 [${bookmark.title}]:`, e.message);
    }
  }
}

// 递归查找同名文件夹
function findFolderByTitle(node, title) {
  if (node.title === title && !node.url) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findFolderByTitle(child, title);
      if (found) return found;
    }
  }
  return null;
}
