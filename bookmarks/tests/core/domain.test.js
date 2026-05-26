import { extractDomain, mergeSubdomain } from '../../src/utils/domain.js';

test('从 URL 提取主域名', () => {
  expect(extractDomain('https://github.com/user/repo')).toBe('github.com');
  expect(extractDomain('https://www.bilibili.com/video/BV123')).toBe('bilibili.com');
});

test('子域名合并到主域名', () => {
  expect(mergeSubdomain('gist.github.com')).toBe('github.com');
  expect(mergeSubdomain('docs.github.com')).toBe('github.com');
  expect(mergeSubdomain('movie.douban.com')).toBe('douban.com');
  expect(mergeSubdomain('book.douban.com')).toBe('douban.com');
});

test('主域名不合并', () => {
  expect(mergeSubdomain('github.com')).toBe('github.com');
  expect(mergeSubdomain('bilibili.com')).toBe('bilibili.com');
});
