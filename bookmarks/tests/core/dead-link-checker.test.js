import { checkLink, categorizeStatusCode } from '../../src/core/dead-link-checker.js';
import { jest } from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
});

test('检测 404 链接为失效', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ status: 404 }));

  const result = await checkLink('https://example.com/missing');
  expect(result.isDead).toBe(true);
  expect(result.statusCode).toBe(404);
});

test('200 链接为正常', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));

  const result = await checkLink('https://example.com');
  expect(result.isDead).toBe(false);
  expect(result.statusCode).toBe(200);
});

test('网络错误标记为失效', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

  const result = await checkLink('https://example.com');
  expect(result.isDead).toBe(true);
  expect(result.error).toBe('Network error');
});
