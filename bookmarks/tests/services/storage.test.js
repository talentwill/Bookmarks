import { jest, test, expect } from '@jest/globals';
import { createStorageService } from '../../src/services/storage.js';

test('读写配置', async () => {
  const mockChrome = {
    storage: {
      local: {
        get: jest.fn((keys) => Promise.resolve({ apiKey: 'sk-test' })),
        set: jest.fn(() => Promise.resolve()),
      },
    },
  };

  const storage = createStorageService(mockChrome);

  await storage.setConfig({ apiKey: 'sk-new' });
  expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ apiKey: 'sk-new' });

  const config = await storage.getConfig('apiKey');
  expect(config).toBe('sk-test');
});

test('域名文件夹映射读写', async () => {
  const storageData = {};
  const mockChrome = {
    storage: {
      local: {
        get: jest.fn((key) => Promise.resolve({ [key]: storageData[key] })),
        set: jest.fn((items) => {
          Object.assign(storageData, items);
          return Promise.resolve();
        }),
      },
    },
  };

  const storage = createStorageService(mockChrome);

  await storage.setDomainFolder('github.com', 'folder_123');
  const folders = await storage.getDomainFolders();
  expect(folders['github.com']).toBe('folder_123');
});
