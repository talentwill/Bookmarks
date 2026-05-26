import { findDuplicates, getDuplicateToRemove } from '../../src/core/duplicate-detector.js';

test('检测相同 URL 的重复书签', () => {
  const bookmarks = [
    { id: '1', url: 'https://github.com/repo', title: 'Repo', dateAdded: 1000 },
    { id: '2', url: 'https://github.com/repo', title: 'Repo Copy', dateAdded: 2000 },
    { id: '3', url: 'https://github.com/other', title: 'Other', dateAdded: 1500 },
  ];

  const duplicates = findDuplicates(bookmarks);
  expect(duplicates).toHaveLength(1);
  expect(duplicates[0]).toHaveLength(2);
  expect(duplicates[0].map(b => b.id)).toContain('1');
  expect(duplicates[0].map(b => b.id)).toContain('2');
});

test('无重复时返回空数组', () => {
  const bookmarks = [
    { id: '1', url: 'https://github.com/repo1', title: 'Repo 1', dateAdded: 1000 },
    { id: '2', url: 'https://github.com/repo2', title: 'Repo 2', dateAdded: 2000 },
  ];

  const duplicates = findDuplicates(bookmarks);
  expect(duplicates).toHaveLength(0);
});

test('重复书签保留最新版本', () => {
  const bookmarks = [
    { id: '1', url: 'https://example.com/page', title: 'Old', dateAdded: 1000 },
    { id: '2', url: 'https://example.com/page', title: 'New', dateAdded: 2000 },
    { id: '3', url: 'https://example.com/page', title: 'Middle', dateAdded: 1500 },
  ];

  const duplicates = findDuplicates(bookmarks);
  const toRemove = getDuplicateToRemove(duplicates[0]);

  expect(toRemove).toHaveLength(2);
  expect(duplicates[0][0].id).toBe('2');
  expect(toRemove.map(b => b.id)).toContain('1');
  expect(toRemove.map(b => b.id)).toContain('3');
});
