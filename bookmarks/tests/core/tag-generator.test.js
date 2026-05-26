import { jest } from '@jest/globals';
import { generateTagsForBookmark } from '../../src/core/tag-generator.js';

afterEach(() => {
  global.fetch = undefined;
});

test('为单个书签生成标签', async () => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      choices: [{ message: { content: '["React", "前端", "开源"]' } }],
    }),
  }));

  const tags = await generateTagsForBookmark({
    title: 'React 项目',
    url: 'https://github.com/user/repo',
    domain: 'github.com',
  }, {
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  });

  expect(tags).toEqual(['React', '前端', '开源']);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('API 失败时返回空数组', async () => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: false,
    status: 500,
  }));

  const tags = await generateTagsForBookmark({
    title: 'Test',
    url: 'https://example.com',
    domain: 'example.com',
  }, { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' });

  expect(tags).toEqual([]);
});

test('网络错误时返回空数组', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

  const tags = await generateTagsForBookmark({
    title: 'Test',
    url: 'https://example.com',
    domain: 'example.com',
  }, { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' });

  expect(tags).toEqual([]);
});
