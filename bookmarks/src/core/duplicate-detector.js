import { cleanUrl } from './url-cleaner.js';

export function findDuplicates(bookmarks) {
  const urlMap = new Map();

  for (const bookmark of bookmarks) {
    const clean = cleanUrl(bookmark.url);
    if (!urlMap.has(clean)) {
      urlMap.set(clean, []);
    }
    urlMap.get(clean).push(bookmark);
  }

  const duplicates = [];
  for (const group of urlMap.values()) {
    if (group.length > 1) {
      group.sort((a, b) => b.dateAdded - a.dateAdded);
      duplicates.push(group);
    }
  }

  return duplicates;
}

export function getDuplicateToRemove(duplicateGroup) {
  return duplicateGroup.slice(1);
}
