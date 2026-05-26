import { flattenBookmarks } from '../../src/background/bookmark-listener.js';
import { test, expect } from '@jest/globals';

test('将书签树展平为列表', () => {
  const tree = [{
    id: '0',
    title: 'Root',
    children: [
      {
        id: '1',
        title: 'Folder',
        children: [
          { id: '2', title: 'Bookmark A', url: 'https://a.com', dateAdded: 1000 },
          { id: '3', title: 'Bookmark B', url: 'https://b.com', dateAdded: 2000 },
        ],
      },
      { id: '4', title: 'Bookmark C', url: 'https://c.com', dateAdded: 1500 },
    ],
  }];

  const flat = flattenBookmarks(tree);
  expect(flat).toHaveLength(3);
  expect(flat.map(b => b.id)).toContain('2');
  expect(flat.map(b => b.id)).toContain('3');
  expect(flat.map(b => b.id)).toContain('4');
});
