import { cleanUrl } from '../../src/core/url-cleaner.js';

test('移除 utm_source 和 utm_medium 参数', () => {
  const input = 'https://example.com/article?utm_source=twitter&utm_medium=social&page=2';
  const result = cleanUrl(input);
  expect(result).toBe('https://example.com/article?page=2');
});

test('移除 fbclid 参数', () => {
  const input = 'https://example.com/video?id=123&fbclid=abc123&share_source=copy';
  const result = cleanUrl(input);
  expect(result).toBe('https://example.com/video?id=123');
});

test('保留 page、id 等重要参数', () => {
  const input = 'https://example.com/search?q=react&page=3&lang=zh';
  const result = cleanUrl(input);
  expect(result).toBe('https://example.com/search?q=react&page=3&lang=zh');
});

test('无参数 URL 保持不变', () => {
  const input = 'https://github.com/user/repo';
  const result = cleanUrl(input);
  expect(result).toBe('https://github.com/user/repo');
});
