// bookmarks/src/background/service-worker.js
import { flattenBookmarks } from './bookmark-listener.js';
import { classify } from '../core/classifier.js';
import { generateTagsForBookmark } from '../core/tag-generator.js';
import { findDuplicates, getDuplicateToRemove } from '../core/duplicate-detector.js';
import { createStorageService } from '../services/storage.js';

// Service Worker 安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('书签智能整理插件已安装');
});

// 实时监听新书签
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark.url) return;
  await organizeBookmark(bookmark);
});

async function organizeBookmark(bookmark) {
  const storage = createStorageService(chrome);
  const config = await storage.getConfig(['deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel']);

  // 分类
  const { cleanedUrl, domain, folderName } = classify(bookmark.url, bookmark.title);

  // 获取或创建域名文件夹
  const folders = await storage.getDomainFolders();
  let folderId = folders[domain];

  if (!folderId) {
    const [parent] = await chrome.bookmarks.getSubTree('1');
    const existing = parent.children.find(c => c.title === folderName && !c.url);
    if (existing) {
      folderId = existing.id;
    } else {
      const newFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: folderName,
      });
      folderId = newFolder.id;
    }
    await storage.setDomainFolder(domain, folderId);
  }

  // 移动书签到域名文件夹
  await chrome.bookmarks.move(bookmark.id, { parentId: folderId });

  // 生成标签（如果有 API Key）
  if (config.deepseekApiKey) {
    const tags = await generateTagsForBookmark({
      title: bookmark.title,
      url: cleanedUrl,
      domain,
    }, {
      apiKey: config.deepseekApiKey,
      baseUrl: config.deepseekBaseUrl || 'https://api.deepseek.com',
      model: config.deepseekModel || 'deepseek-chat',
    });

    // TODO: Store tags to IndexedDB (Task 13+)
  }
}
