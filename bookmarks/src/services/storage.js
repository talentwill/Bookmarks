export function createStorageService(chrome) {
  // 缓存 domainFolders 避免重复读取
  let _foldersCache = null;

  return {
    async getConfig(key) {
      const result = await chrome.storage.local.get(key);
      if (Array.isArray(key)) {
        return result;
      }
      return result[key];
    },

    async setConfig(items) {
      await chrome.storage.local.set(items);
    },

    async removeConfig(keys) {
      await chrome.storage.local.remove(keys);
    },

    async getDomainFolders() {
      if (_foldersCache) return _foldersCache;
      const result = await chrome.storage.local.get('domainFolders');
      _foldersCache = result.domainFolders || {};
      return _foldersCache;
    },

    async setDomainFolder(domain, folderId) {
      const folders = await this.getDomainFolders();
      folders[domain] = folderId;
      _foldersCache = folders;
      await chrome.storage.local.set({ domainFolders: folders });
    },

    invalidateCache() {
      _foldersCache = null;
    },
  };
}
