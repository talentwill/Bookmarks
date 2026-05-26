export function createStorageService(chrome) {
  return {
    async getConfig(key) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    },

    async setConfig(items) {
      await chrome.storage.local.set(items);
    },

    async removeConfig(keys) {
      await chrome.storage.local.remove(keys);
    },

    async getDomainFolders() {
      const result = await chrome.storage.local.get('domainFolders');
      return result.domainFolders || {};
    },

    async setDomainFolder(domain, folderId) {
      const folders = await this.getDomainFolders();
      folders[domain] = folderId;
      await chrome.storage.local.set({ domainFolders: folders });
    },
  };
}
