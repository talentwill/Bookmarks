import { classify } from '../../src/core/classifier.js';

test('根据域名返回文件夹名', () => {
  const result = classify('https://github.com/user/repo', 'React 项目');
  expect(result.domain).toBe('github.com');
});

test('清理 URL 后再提取域名', () => {
  const result = classify('https://www.github.com/user/repo?utm_source=twitter', '项目');
  expect(result.cleanedUrl).toBe('https://github.com/user/repo');
  expect(result.domain).toBe('github.com');
});

test('子域名合并到主域名', () => {
  const result = classify('https://gist.github.com/user/123', '代码片段');
  expect(result.domain).toBe('github.com');
  expect(result.folderName).toBe('github.com');
});
