export function createChromeMock() {
  const storage = {};
  const bookmarks = [];
  let bookmarkIdCounter = 1;

  return {
    bookmarks: {
      getTree: jest.fn(() => Promise.resolve([{ children: [] }])),
      search: jest.fn(() => Promise.resolve(bookmarks)),
      create: jest.fn((details) => {
        const bookmark = {
          id: String(bookmarkIdCounter++),
          title: details.title || '',
          url: details.url,
          parentId: details.parentId,
          dateAdded: Date.now(),
        };
        bookmarks.push(bookmark);
        return Promise.resolve(bookmark);
      }),
      move: jest.fn((id, destination) => Promise.resolve({ id, ...destination })),
      remove: jest.fn((id) => {
        const idx = bookmarks.findIndex(b => b.id === id);
        if (idx >= 0) bookmarks.splice(idx, 1);
        return Promise.resolve();
      }),
      update: jest.fn((id, changes) => Promise.resolve({ id, ...changes })),
      onCreated: { addListener: jest.fn(), removeListener: jest.fn() },
      onMoved: { addListener: jest.fn(), removeListener: jest.fn() },
      onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    storage: {
      local: {
        get: jest.fn((keys) => {
          if (typeof keys === 'string') return Promise.resolve({ [keys]: storage[keys] });
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(k => { if (storage[k] !== undefined) result[k] = storage[k]; });
            return Promise.resolve(result);
          }
          return Promise.resolve({ ...storage });
        }),
        set: jest.fn((items) => {
          Object.assign(storage, items);
          return Promise.resolve();
        }),
        remove: jest.fn((keys) => {
          const arr = typeof keys === 'string' ? [keys] : keys;
          arr.forEach(k => delete storage[k]);
          return Promise.resolve();
        }),
      },
    },
    alarms: {
      create: jest.fn(),
      onAlarm: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    runtime: {
      getURL: jest.fn((path) => `chrome-extension://mock/${path}`),
      onInstalled: { addListener: jest.fn() },
    },
  };
}
