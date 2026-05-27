import { cleanUrl } from './url-cleaner.js';

export function findDuplicates(bookmarks) {
  const urlMap = new Map();

  for (const bookmark of bookmarks) {
    if (!bookmark.url) continue;
    let clean;
    try {
      clean = cleanUrl(bookmark.url);
    } catch {
      continue;
    }
    if (!urlMap.has(clean)) {
      urlMap.set(clean, []);
    }
    urlMap.get(clean).push(bookmark);
  }

  const duplicates = [];
  for (const group of urlMap.values()) {
    if (group.length > 1) {
      group.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
      duplicates.push(group);
    }
  }

  return duplicates;
}

// 保留第一个（最新的），返回要删除的列表
export function getDuplicateToRemove(duplicateGroup) {
  if (!Array.isArray(duplicateGroup) || duplicateGroup.length <= 1) return [];
  const sorted = [...duplicateGroup].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
  return sorted.slice(1);
}
