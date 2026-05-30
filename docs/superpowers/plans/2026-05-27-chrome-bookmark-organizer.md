# Chrome 书签智能整理插件 - TDD 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯 Chrome 扩展，实现书签按域名自动分类、AI 生成标签、URL 清理、重复检测、失效链接检测（支持强制保留），并通过 Supabase 实现标签跨浏览器同步。

**Architecture:** 纯 Chrome 扩展（Manifest V3），Service Worker 处理后台逻辑，全屏 Tab 导航界面。核心逻辑与 Chrome API 解耦，通过依赖注入便于测试。

**Tech Stack:** JavaScript (ES Modules), Jest, Chrome Bookmarks API, Chrome Storage API, IndexedDB, DeepSeek API, Supabase

---

## 文件结构

```
bookmarks/
├── manifest.json
├── package.json
├── jest.config.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   ├── service-worker.js
│   │   ├── bookmark-listener.js
│   │   └── alarm-handler.js
│   ├── core/
│   │   ├── classifier.js
│   │   ├── tag-generator.js
│   │   ├── url-cleaner.js
│   │   ├── duplicate-detector.js
│   │   ├── dead-link-checker.js
│   │   └── domain-rules.js
│   ├── services/
│   │   ├── storage.js
│   │   ├── indexeddb.js
│   │   ├── supabase.js
│   │   └── deepseek.js
│   ├── utils/
│   │   ├── url.js
│   │   ├── domain.js
│   │   └── constants.js
│   └── ui/
│       ├── fullpage.html
│       ├── fullpage.js
│       ├── fullpage.css
│       ├── settings.html
│       ├── settings.js
│       └── settings.css
└── tests/
    ├── core/
    │   ├── url-cleaner.test.js
    │   ├── domain.test.js
    │   ├── classifier.test.js
    │   ├── tag-generator.test.js
    │   ├── duplicate-detector.test.js
    │   └── dead-link-checker.test.js
    ├── services/
    │   ├── storage.test.js
    │   ├── deepseek.test.js
    │   └── supabase.test.js
    └── mocks/
        └── chrome.js
```

---

## Task 1: 项目初始化 + 测试框架

**Files:**
- Create: `bookmarks/package.json`
- Create: `bookmarks/jest.config.js`
- Create: `bookmarks/tests/mocks/chrome.js`

- [ ] **Step 1: 创建项目目录和 package.json**

```bash
mkdir -p bookmarks/src/{background,core,services,utils,ui} bookmarks/tests/{core,services,mocks} bookmarks/icons
```

```json
// bookmarks/package.json
{
  "name": "chrome-bookmark-organizer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/.bin/jest",
    "test:watch": "node --experimental-vm-modules node_modules/.bin/jest --watch"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@jest/globals": "^29.7.0"
  }
}
```

- [ ] **Step 2: 创建 Jest 配置**

```javascript
// bookmarks/jest.config.js
export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
};
```

- [ ] **Step 3: 创建 Chrome API mock**

```javascript
// bookmarks/tests/mocks/chrome.js
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
```

- [ ] **Step 4: 安装依赖并验证测试框架可用**

```bash
cd bookmarks && npm install
npm test
```

Expected: Jest runs, reports 0 tests.

- [ ] **Step 5: Commit**

```bash
git add bookmarks/
git commit -m "chore: init chrome extension project with Jest TDD setup"
```

---

## Task 2: URL 清理器

**Files:**
- Create: `bookmarks/src/utils/constants.js`
- Create: `bookmarks/src/utils/url.js`
- Create: `bookmarks/src/core/url-cleaner.js`
- Create: `bookmarks/tests/core/url-cleaner.test.js`

- [ ] **Step 1: 写失败测试 - 移除 utm 参数**

```javascript
// bookmarks/tests/core/url-cleaner.test.js
import { cleanUrl } from '../../src/core/url-cleaner.js';

test('移除 utm_source 和 utm_medium 参数', () => {
  const input = 'https://example.com/article?utm_source=twitter&utm_medium=social&page=2';
  const result = cleanUrl(input);
  expect(result).toBe('https://example.com/article?page=2');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test
```

Expected: FAIL - "Cannot find module '../../src/core/url-cleaner.js'"

- [ ] **Step 3: 创建常量和最小实现**

```javascript
// bookmarks/src/utils/constants.js
export const REMOVE_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid',
  'ref', 'source', 'spm', 'from', 'isappinstalled',
  'scene', 'clickid', 'share_source', 'share_medium',
  'pk_campaign', 'pk_kwd', 'pk_source', 'pk_medium',
  'mc_cid', 'mc_eid',
  'session_id', 'sid', 'token',
];

export const KEEP_PARAMS = [
  'page', 'p', 'q', 'query', 'search', 'keyword',
  'id', 'uid', 'user_id', 'item_id', 'product_id',
  'lang', 'locale', 'hl',
  'tab', 'type', 'sort', 'order', 'filter',
];
```

```javascript
// bookmarks/src/utils/url.js
export function removeTrackingParams(urlString, removeList) {
  const url = new URL(urlString);
  for (const param of removeList) {
    url.searchParams.delete(param);
  }
  return url.toString();
}
```

```javascript
// bookmarks/src/core/url-cleaner.js
import { REMOVE_PARAMS } from '../utils/constants.js';
import { removeTrackingParams } from '../utils/url.js';

export function cleanUrl(url) {
  return removeTrackingParams(url, REMOVE_PARAMS);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 移除 fbclid 参数**

```javascript
// bookmarks/tests/core/url-cleaner.test.js (追加)
test('移除 fbclid 参数', () => {
  const input = 'https://example.com/video?id=123&fbclid=abc123&share_source=copy';
  const result = cleanUrl(input);
  expect(result).toBe('https://example.com/video?id=123');
});
```

- [ ] **Step 6: 运行测试确认通过（已有实现覆盖）**

```bash
cd bookmarks && npm test
```

Expected: PASS（因为 removeTrackingParams 已处理所有 REMOVE_PARAMS）

- [ ] **Step 7: 写失败测试 - 保留重要参数**

```javascript
test('保留 page、id 等重要参数', () => {
  const input = 'https://example.com/search?q=react&page=3&lang=zh';
  const result = cleanUrl(input);
  expect(result).toBe('https://example.com/search?q=react&page=3&lang=zh');
});
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test
```

Expected: PASS

- [ ] **Step 9: 写失败测试 - 无参数 URL 不变**

```javascript
test('无参数 URL 保持不变', () => {
  const input = 'https://github.com/user/repo';
  const result = cleanUrl(input);
  expect(result).toBe('https://github.com/user/repo');
});
```

- [ ] **Step 10: 运行测试确认通过**

```bash
cd bookmarks && npm test
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add bookmarks/src/utils/ bookmarks/src/core/url-cleaner.js bookmarks/tests/core/url-cleaner.test.js
git commit -m "feat: add URL cleaner with tracking param removal"
```

---

## Task 3: 域名提取与合并

**Files:**
- Create: `bookmarks/src/core/domain-rules.js`
- Create: `bookmarks/src/utils/domain.js`
- Create: `bookmarks/tests/core/domain.test.js`

- [ ] **Step 1: 写失败测试 - 提取主域名**

```javascript
// bookmarks/tests/core/domain.test.js
import { extractDomain, mergeSubdomain } from '../../src/utils/domain.js';

test('从 URL 提取主域名', () => {
  expect(extractDomain('https://github.com/user/repo')).toBe('github.com');
  expect(extractDomain('https://www.bilibili.com/video/BV123')).toBe('bilibili.com');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/domain.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/utils/domain.js
export function extractDomain(urlString) {
  const url = new URL(urlString);
  let hostname = url.hostname;
  // 移除 www. 前缀
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }
  return hostname;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/domain.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 子域名合并到主域名**

```javascript
test('子域名合并到主域名', () => {
  expect(mergeSubdomain('gist.github.com')).toBe('github.com');
  expect(mergeSubdomain('docs.github.com')).toBe('github.com');
  expect(mergeSubdomain('movie.douban.com')).toBe('douban.com');
  expect(mergeSubdomain('book.douban.com')).toBe('douban.com');
});
```

- [ ] **Step 6: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/domain.test.js
```

Expected: FAIL - "mergeSubdomain is not a function"

- [ ] **Step 7: 创建域名规则并实现合并**

```javascript
// bookmarks/src/core/domain-rules.js
// 子域名 → 主域名映射
export const SUBDOMAIN_MAP = {
  'gist.github.com': 'github.com',
  'docs.github.com': 'github.com',
  'raw.githubusercontent.com': 'github.com',
  'movie.douban.com': 'douban.com',
  'book.douban.com': 'douban.com',
  'music.douban.com': 'douban.com',
  'docs.google.com': 'google.com',
  'drive.google.com': 'google.com',
  'mail.google.com': 'google.com',
  'translate.google.com': 'google.com',
  'gist.github.com': 'github.com',
  'learn.microsoft.com': 'microsoft.com',
  'docs.microsoft.com': 'microsoft.com',
  'developer.mozilla.org': 'mozilla.org',
};

// 自动合并规则：N 级子域名 → 主域名（保留最后两段）
export function autoMergeDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}
```

```javascript
// bookmarks/src/utils/domain.js (更新)
import { SUBDOMAIN_MAP, autoMergeDomain } from '../core/domain-rules.js';

export function extractDomain(urlString) {
  const url = new URL(urlString);
  let hostname = url.hostname;
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }
  return hostname;
}

export function mergeSubdomain(hostname) {
  // 先查精确映射
  if (SUBDOMAIN_MAP[hostname]) {
    return SUBDOMAIN_MAP[hostname];
  }
  // 再用自动合并规则
  return autoMergeDomain(hostname);
}
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/domain.test.js
```

Expected: PASS

- [ ] **Step 9: 写失败测试 - 已是主域名不合并**

```javascript
test('主域名不合并', () => {
  expect(mergeSubdomain('github.com')).toBe('github.com');
  expect(mergeSubdomain('bilibili.com')).toBe('bilibili.com');
});
```

- [ ] **Step 10: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/domain.test.js
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add bookmarks/src/utils/domain.js bookmarks/src/core/domain-rules.js bookmarks/tests/core/domain.test.js
git commit -m "feat: add domain extraction and subdomain merging"
```

---

## Task 4: 域名分类器

**Files:**
- Create: `bookmarks/src/core/classifier.js`
- Create: `bookmarks/tests/core/classifier.test.js`

- [ ] **Step 1: 写失败测试 - 根据域名分类书签**

```javascript
// bookmarks/tests/core/classifier.test.js
import { classify } from '../../src/core/classifier.js';

test('根据域名返回文件夹名', () => {
  const result = classify('https://github.com/user/repo', 'React 项目');
  expect(result.domain).toBe('github.com');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/classifier.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/core/classifier.js
import { extractDomain, mergeSubdomain } from '../utils/domain.js';
import { cleanUrl } from './url-cleaner.js';

export function classify(url, title) {
  const cleanedUrl = cleanUrl(url);
  const rawDomain = extractDomain(cleanedUrl);
  const domain = mergeSubdomain(rawDomain);

  return {
    cleanedUrl,
    domain,
    folderName: domain,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/classifier.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - URL 清理后再提取域名**

```javascript
test('清理 URL 后再提取域名', () => {
  const result = classify('https://www.github.com/user/repo?utm_source=twitter', '项目');
  expect(result.cleanedUrl).toBe('https://github.com/user/repo');
  expect(result.domain).toBe('github.com');
});
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/classifier.test.js
```

Expected: PASS

- [ ] **Step 7: 写失败测试 - 子域名合并**

```javascript
test('子域名合并到主域名', () => {
  const result = classify('https://gist.github.com/user/123', '代码片段');
  expect(result.domain).toBe('github.com');
  expect(result.folderName).toBe('github.com');
});
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/classifier.test.js
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add bookmarks/src/core/classifier.js bookmarks/tests/core/classifier.test.js
git commit -m "feat: add domain classifier"
```

---

## Task 5: DeepSeek API 服务

**Files:**
- Create: `bookmarks/src/services/deepseek.js`
- Create: `bookmarks/tests/services/deepseek.test.js`

- [ ] **Step 1: 写失败测试 - 构建正确的 API 请求**

```javascript
// bookmarks/tests/services/deepseek.test.js
import { buildTagRequest } from '../../src/services/deepseek.js';

test('构建标签生成请求体', () => {
  const request = buildTagRequest({
    title: 'React 项目',
    url: 'https://github.com/user/repo',
    domain: 'github.com',
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  });

  expect(request.url).toBe('https://api.deepseek.com/v1/chat/completions');
  expect(request.headers['Authorization']).toBe('Bearer sk-test');
  expect(request.body.model).toBe('deepseek-chat');
  expect(request.body.messages[1].content).toContain('React 项目');
  expect(request.body.messages[1].content).toContain('github.com');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/services/deepseek.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/services/deepseek.js
export function buildTagRequest({ title, url, domain, apiKey, baseUrl, model }) {
  const prompt = `你是一个书签标签生成助手。请根据以下信息生成 2-4 个相关标签。

书签标题：${title}
书签 URL：${url}
域名：${domain}

标签要求：
- 简洁明了（1-2 个词）
- 能够描述书签的主要内容
- 便于跨域名搜索和聚合
- 中英文标签都可以

请返回 JSON 数组：
["标签1", "标签2", "标签3"]`;

  return {
    url: `${baseUrl}/v1/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: {
      model,
      messages: [
        { role: 'system', content: '你是一个书签标签生成助手。只返回 JSON 数组，不要其他内容。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/deepseek.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 解析 API 响应提取标签**

```javascript
test('从 API 响应中提取标签数组', () => {
  const response = {
    choices: [{ message: { content: '["React", "前端", "开源"]' } }],
  };
  const tags = parseTagResponse(response);
  expect(tags).toEqual(['React', '前端', '开源']);
});
```

- [ ] **Step 6: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/services/deepseek.test.js
```

Expected: FAIL - "parseTagResponse is not a function"

- [ ] **Step 7: 实现解析函数**

```javascript
// bookmarks/src/services/deepseek.js (追加)
export function parseTagResponse(response) {
  const content = response.choices[0].message.content;
  // 提取 JSON 数组（兼容 markdown 代码块）
  const match = content.match(/\[.*\]/s);
  if (match) {
    return JSON.parse(match[0]);
  }
  return [];
}
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/deepseek.test.js
```

Expected: PASS

- [ ] **Step 9: 写失败测试 - 响应包含 markdown 代码块**

```javascript
test('解析包含 markdown 代码块的响应', () => {
  const response = {
    choices: [{ message: { content: '```json\n["Python", "教程", "视频"]\n```' } }],
  };
  const tags = parseTagResponse(response);
  expect(tags).toEqual(['Python', '教程', '视频']);
});
```

- [ ] **Step 10: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/deepseek.test.js
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add bookmarks/src/services/deepseek.js bookmarks/tests/services/deepseek.test.js
git commit -m "feat: add DeepSeek API service for tag generation"
```

---

## Task 6: 标签生成器

**Files:**
- Create: `bookmarks/src/core/tag-generator.js`
- Create: `bookmarks/tests/core/tag-generator.test.js`

- [ ] **Step 1: 写失败测试 - 单个书签生成标签**

```javascript
// bookmarks/tests/core/tag-generator.test.js
import { generateTagsForBookmark } from '../../src/core/tag-generator.js';

test('为单个书签生成标签', async () => {
  // Mock fetch
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/tag-generator.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/core/tag-generator.js
import { buildTagRequest, parseTagResponse } from '../services/deepseek.js';

export async function generateTagsForBookmark(bookmark, config) {
  const request = buildTagRequest({
    title: bookmark.title,
    url: bookmark.url,
    domain: bookmark.domain,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
  });

  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    });

    if (!response.ok) {
      console.error('Tag generation failed:', response.status);
      return [];
    }

    const data = await response.json();
    return parseTagResponse(data);
  } catch (error) {
    console.error('Tag generation error:', error);
    return [];
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/tag-generator.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - API 失败时返回空数组**

```javascript
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
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/tag-generator.test.js
```

Expected: PASS

- [ ] **Step 7: 写失败测试 - 网络错误时返回空数组**

```javascript
test('网络错误时返回空数组', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

  const tags = await generateTagsForBookmark({
    title: 'Test',
    url: 'https://example.com',
    domain: 'example.com',
  }, { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' });

  expect(tags).toEqual([]);
});
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/tag-generator.test.js
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add bookmarks/src/core/tag-generator.js bookmarks/tests/core/tag-generator.test.js
git commit -m "feat: add tag generator with error handling"
```

---

## Task 7: 重复检测器

**Files:**
- Create: `bookmarks/src/core/duplicate-detector.js`
- Create: `bookmarks/tests/core/duplicate-detector.test.js`

- [ ] **Step 1: 写失败测试 - 检测相同 URL 的重复书签**

```javascript
// bookmarks/tests/core/duplicate-detector.test.js
import { findDuplicates } from '../../src/core/duplicate-detector.js';

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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/duplicate-detector.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/core/duplicate-detector.js
import { cleanUrl } from './url-cleaner.js';

export function findDuplicates(bookmarks) {
  const urlMap = new Map();

  for (const bookmark of bookmarks) {
    const clean = cleanUrl(bookmark.url);
    if (!urlMap.has(clean)) {
      urlMap.set(clean, []);
    }
    urlMap.get(clean).push(bookmark);
  }

  const duplicates = [];
  for (const group of urlMap.values()) {
    if (group.length > 1) {
      // 按 dateAdded 降序，保留最新的
      group.sort((a, b) => b.dateAdded - a.dateAdded);
      duplicates.push(group);
    }
  }

  return duplicates;
}

export function getDuplicateToRemove(duplicateGroup) {
  // 保留第一个（最新的），返回要删除的
  return duplicateGroup.slice(1);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/duplicate-detector.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 无重复时返回空数组**

```javascript
test('无重复时返回空数组', () => {
  const bookmarks = [
    { id: '1', url: 'https://github.com/repo1', title: 'Repo 1', dateAdded: 1000 },
    { id: '2', url: 'https://github.com/repo2', title: 'Repo 2', dateAdded: 2000 },
  ];

  const duplicates = findDuplicates(bookmarks);
  expect(duplicates).toHaveLength(0);
});
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/duplicate-detector.test.js
```

Expected: PASS

- [ ] **Step 7: 写失败测试 - 保留最新版本**

```javascript
test('重复书签保留最新版本', () => {
  const bookmarks = [
    { id: '1', url: 'https://example.com/page', title: 'Old', dateAdded: 1000 },
    { id: '2', url: 'https://example.com/page', title: 'New', dateAdded: 2000 },
    { id: '3', url: 'https://example.com/page', title: 'Middle', dateAdded: 1500 },
  ];

  const duplicates = findDuplicates(bookmarks);
  const toRemove = getDuplicateToRemove(duplicates[0]);

  expect(toRemove).toHaveLength(2);
  expect(duplicates[0][0].id).toBe('2'); // 最新的在第一个
  expect(toRemove.map(b => b.id)).toContain('1');
  expect(toRemove.map(b => b.id)).toContain('3');
});
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/duplicate-detector.test.js
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add bookmarks/src/core/duplicate-detector.js bookmarks/tests/core/duplicate-detector.test.js
git commit -m "feat: add duplicate detector"
```

---

## Task 8: 失效链接检测器

**Files:**
- Create: `bookmarks/src/core/dead-link-checker.js`
- Create: `bookmarks/tests/core/dead-link-checker.test.js`

- [ ] **Step 1: 写失败测试 - 检测 404 链接**

```javascript
// bookmarks/tests/core/dead-link-checker.test.js
import { checkLink, categorizeStatusCode } from '../../src/core/dead-link-checker.js';

test('检测 404 链接为失效', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ status: 404 }));

  const result = await checkLink('https://example.com/missing');
  expect(result.isDead).toBe(true);
  expect(result.statusCode).toBe(404);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/dead-link-checker.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/core/dead-link-checker.js
export function categorizeStatusCode(status) {
  if (status >= 200 && status < 400) return 'alive';
  if (status === 404) return 'dead';
  if (status >= 500) return 'dead';
  return 'unknown';
}

export async function checkLink(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    const category = categorizeStatusCode(response.status);
    return {
      url,
      statusCode: response.status,
      isDead: category === 'dead',
      error: null,
    };
  } catch (error) {
    return {
      url,
      statusCode: null,
      isDead: true,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/dead-link-checker.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 200 链接为正常**

```javascript
test('200 链接为正常', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));

  const result = await checkLink('https://example.com');
  expect(result.isDead).toBe(false);
  expect(result.statusCode).toBe(200);
});
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/dead-link-checker.test.js
```

Expected: PASS

- [ ] **Step 7: 写失败测试 - 网络错误为失效**

```javascript
test('网络错误标记为失效', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

  const result = await checkLink('https://example.com');
  expect(result.isDead).toBe(true);
  expect(result.error).toBe('Network error');
});
```

- [ ] **Step 8: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/dead-link-checker.test.js
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add bookmarks/src/core/dead-link-checker.js bookmarks/tests/core/dead-link-checker.test.js
git commit -m "feat: add dead link checker"
```

---

## Task 9: Storage 服务

**Files:**
- Create: `bookmarks/src/services/storage.js`
- Create: `bookmarks/tests/services/storage.test.js`

- [ ] **Step 1: 写失败测试 - 读写配置**

```javascript
// bookmarks/tests/services/storage.test.js
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/services/storage.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/services/storage.js
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/storage.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 域名文件夹映射**

```javascript
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
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/storage.test.js
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add bookmarks/src/services/storage.js bookmarks/tests/services/storage.test.js
git commit -m "feat: add storage service"
```

---

## Task 10: Supabase 同步服务

**Files:**
- Create: `bookmarks/src/services/supabase.js`
- Create: `bookmarks/tests/services/supabase.test.js`

- [ ] **Step 1: 写失败测试 - 构建同步请求**

```javascript
// bookmarks/tests/services/supabase.test.js
import { buildUpsertRequest, buildFetchRequest } from '../../src/services/supabase.js';

test('构建 upsert 请求', () => {
  const request = buildUpsertRequest({
    supabaseUrl: 'https://xxx.supabase.co',
    supabaseKey: 'anon-key',
    records: [{
      url_hash: 'abc123',
      url: 'https://github.com/repo',
      title: 'Repo',
      domain: 'github.com',
      tags: ['React', '前端'],
    }],
  });

  expect(request.url).toBe('https://xxx.supabase.co/rest/v1/bookmark_tags');
  expect(request.headers['apikey']).toBe('anon-key');
  expect(request.headers['Prefer']).toBe('resolution=merge-duplicates');
  expect(request.body).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/services/supabase.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/services/supabase.js
export function buildUpsertRequest({ supabaseUrl, supabaseKey, records }) {
  return {
    url: `${supabaseUrl}/rest/v1/bookmark_tags`,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: records,
  };
}

export function buildFetchRequest({ supabaseUrl, supabaseKey, urlHash }) {
  return {
    url: `${supabaseUrl}/rest/v1/bookmark_tags?url_hash=eq.${urlHash}`,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/supabase.test.js
```

Expected: PASS

- [ ] **Step 5: 写失败测试 - 批量同步标签**

```javascript
test('批量同步标签到 Supabase', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));

  const { syncTagsToSupabase } = await import('../../src/services/supabase.js');

  await syncTagsToSupabase({
    supabaseUrl: 'https://xxx.supabase.co',
    supabaseKey: 'anon-key',
    records: [
      { url_hash: 'abc', url: 'https://a.com', title: 'A', domain: 'a.com', tags: ['tag1'] },
      { url_hash: 'def', url: 'https://b.com', title: 'B', domain: 'b.com', tags: ['tag2'] },
    ],
  });

  expect(fetch).toHaveBeenCalledTimes(1);
  const call = fetch.mock.calls[0];
  expect(call[0]).toContain('bookmark_tags');
});
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/services/supabase.test.js
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add bookmarks/src/services/supabase.js bookmarks/tests/services/supabase.test.js
git commit -m "feat: add Supabase sync service"
```

---

## Task 11: Chrome Bookmarks API 集成

**Files:**
- Create: `bookmarks/src/background/bookmark-listener.js`
- Create: `bookmarks/tests/core/bookmark-listener.test.js`

- [ ] **Step 1: 写失败测试 - 获取所有书签**

```javascript
// bookmarks/tests/core/bookmark-listener.test.js
import { flattenBookmarks } from '../../src/background/bookmark-listener.js';

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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd bookmarks && npm test tests/core/bookmark-listener.test.js
```

Expected: FAIL - "Cannot find module"

- [ ] **Step 3: 最小实现**

```javascript
// bookmarks/src/background/bookmark-listener.js
export function flattenBookmarks(tree) {
  const result = [];

  function walk(nodes) {
    for (const node of nodes) {
      if (node.url) {
        result.push({
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
          parentId: node.parentId,
        });
      }
      if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd bookmarks && npm test tests/core/bookmark-listener.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bookmarks/src/background/bookmark-listener.js bookmarks/tests/core/bookmark-listener.test.js
git commit -m "feat: add bookmark tree flattener"
```

---

## Task 12: manifest.json + Service Worker 入口

**Files:**
- Create: `bookmarks/manifest.json`
- Create: `bookmarks/src/background/service-worker.js`

- [ ] **Step 1: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "书签智能整理",
  "version": "0.1.0",
  "description": "按域名自动分类书签，AI 生成标签，跨浏览器同步",
  "permissions": [
    "bookmarks",
    "storage",
    "alarms",
    "activeTab"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_title": "书签智能整理"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: 创建 Service Worker 入口**

```javascript
// bookmarks/src/background/service-worker.js
import { flattenBookmarks } from './bookmark-listener.js';
import { classify } from '../core/classifier.js';
import { generateTagsForBookmark } from '../core/tag-generator.js';
import { findDuplicates, getDuplicateToRemove } from '../core/duplicate-detector.js';
import { createStorageService } from '../services/storage.js';

// Service Worker 安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('书签智能整理插件已安装');
});

// 实时监听新书签
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark.url) return;
  await organizeBookmark(bookmark);
});

async function organizeBookmark(bookmark) {
  const storage = createStorageService(chrome);
  const config = await storage.getConfig(['deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel']);

  // 分类
  const { cleanedUrl, domain, folderName } = classify(bookmark.url, bookmark.title);

  // 获取或创建域名文件夹
  const folders = await storage.getDomainFolders();
  let folderId = folders[domain];

  if (!folderId) {
    const [parent] = await chrome.bookmarks.getSubTree('1'); // 1 = 书签栏
    const existing = parent.children.find(c => c.title === folderName && !c.url);
    if (existing) {
      folderId = existing.id;
    } else {
      const newFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: folderName,
      });
      folderId = newFolder.id;
    }
    await storage.setDomainFolder(domain, folderId);
  }

  // 移动书签到域名文件夹
  await chrome.bookmarks.move(bookmark.id, { parentId: folderId });

  // 生成标签（如果有 API Key）
  if (config.deepseekApiKey) {
    const tags = await generateTagsForBookmark({
      title: bookmark.title,
      url: cleanedUrl,
      domain,
    }, {
      apiKey: config.deepseekApiKey,
      baseUrl: config.deepseekBaseUrl || 'https://api.deepseek.com',
      model: config.deepseekModel || 'deepseek-chat',
    });

    // 存储标签到 IndexedDB
    // TODO: Task 13 实现
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add bookmarks/manifest.json bookmarks/src/background/service-worker.js
git commit -m "feat: add manifest.json and service worker entry"
```

---

## Task 13: 全屏 UI 界面

**Files:**
- Create: `bookmarks/src/ui/fullpage.html`
- Create: `bookmarks/src/ui/fullpage.css`
- Create: `bookmarks/src/ui/fullpage.js`

- [ ] **Step 1: 创建全屏 HTML 框架**

```html
<!-- bookmarks/src/ui/fullpage.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>书签智能整理</title>
  <link rel="stylesheet" href="fullpage.css">
</head>
<body>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1>📚 书签智能整理</h1>
        <span class="status-badge" id="status">🟢 实时监控中</span>
      </div>
      <div class="header-right">
        <button id="btn-organize" class="btn btn-primary">⚡ 立即整理</button>
        <button id="btn-settings" class="btn btn-secondary">⚙️ 设置</button>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs">
      <button class="tab active" data-tab="overview">📊 概览</button>
      <button class="tab" data-tab="search">🔍 搜索</button>
      <button class="tab" data-tab="domains">🌐 域名管理</button>
      <button class="tab" data-tab="duplicates">🔗 重复检测</button>
      <button class="tab" data-tab="dead-links">⚠️ 失效链接</button>
    </nav>

    <!-- Tab Content -->
    <main class="content">
      <!-- 概览 Tab -->
      <section id="tab-overview" class="tab-content active">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">总书签</div>
            <div class="stat-value" id="stat-total">-</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">域名数</div>
            <div class="stat-value" id="stat-domains">-</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">标签数</div>
            <div class="stat-value" id="stat-tags">-</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-label">重复</div>
            <div class="stat-value" id="stat-duplicates">-</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-label">失效</div>
            <div class="stat-value" id="stat-dead">-</div>
          </div>
        </div>
        <div class="section">
          <h3>最近整理的书签</h3>
          <div id="recent-bookmarks" class="bookmark-list"></div>
        </div>
      </section>

      <!-- 搜索 Tab -->
      <section id="tab-search" class="tab-content">
        <div class="search-bar">
          <input type="text" id="search-input" placeholder="搜索书签、标签、域名...">
          <select id="search-domain-filter">
            <option value="">全部域名</option>
          </select>
          <select id="search-tag-filter">
            <option value="">全部标签</option>
          </select>
          <button id="btn-search" class="btn btn-primary">搜索</button>
        </div>
        <div id="search-results" class="bookmark-list"></div>
      </section>

      <!-- 域名管理 Tab -->
      <section id="tab-domains" class="tab-content">
        <div id="domain-list" class="domain-list"></div>
      </section>

      <!-- 重复检测 Tab -->
      <section id="tab-duplicates" class="tab-content">
        <button id="btn-find-duplicates" class="btn btn-primary">扫描重复书签</button>
        <div id="duplicate-list" class="duplicate-list"></div>
      </section>

      <!-- 失效链接 Tab -->
      <section id="tab-dead-links" class="tab-content">
        <button id="btn-check-dead-links" class="btn btn-primary">检测失效链接</button>
        <div id="dead-link-list" class="dead-link-list"></div>
      </section>
    </main>
  </div>

  <script src="fullpage.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: 创建样式文件**

```css
/* bookmarks/src/ui/fullpage.css */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #1a1a2e;
  min-height: 100vh;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 { font-size: 24px; }

.status-badge {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
}

.header-right { display: flex; gap: 12px; }

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 0;
}

.tab {
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-radius: 8px 8px 0 0;
  font-size: 14px;
  cursor: pointer;
  color: #666;
}

.tab.active {
  background: #667eea;
  color: white;
}

.content { padding: 24px 0; }

.tab-content { display: none; }
.tab-content.active { display: block; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.stat-card.warning .stat-value { color: #ff9800; }
.stat-card.danger .stat-value { color: #f44336; }

.stat-label { font-size: 12px; color: #666; margin-bottom: 8px; }
.stat-value { font-size: 32px; font-weight: 600; }

.search-bar {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.search-bar input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

.search-bar select {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  min-width: 120px;
}

.bookmark-list { display: flex; flex-direction: column; gap: 12px; }

.bookmark-item {
  display: flex;
  align-items: center;
  padding: 14px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.bookmark-item .domain-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  margin-right: 12px;
}

.bookmark-item .tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  margin-left: 6px;
}

.bookmark-item .title { flex: 1; font-size: 14px; font-weight: 500; }
.bookmark-item .url { font-size: 12px; color: #666; }
.bookmark-item .date { font-size: 12px; color: #999; margin-left: 12px; }

.domain-list { display: flex; flex-direction: column; gap: 8px; }

.domain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.dead-link-item {
  display: flex;
  align-items: center;
  padding: 14px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.dead-link-item.force-kept {
  border-left: 4px solid #ff9800;
  background: #fff8e1;
}

.dead-link-item .status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.dead-link-item .status.dead { background: #fce4ec; color: #c62828; }
.dead-link-item .status.force-kept { background: #fff3e0; color: #e65100; }
```

- [ ] **Step 3: 创建 UI 交互逻辑**

```javascript
// bookmarks/src/ui/fullpage.js
document.addEventListener('DOMContentLoaded', () => {
  // Tab 切换
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // 立即整理按钮
  document.getElementById('btn-organize').addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'organizeAll' });
  });

  // 加载统计数据
  loadStats();
});

async function loadStats() {
  const stats = await chrome.storage.local.get('stats');
  if (stats.stats) {
    document.getElementById('stat-total').textContent = stats.stats.totalBookmarks || 0;
    document.getElementById('stat-domains').textContent = stats.stats.totalDomains || 0;
    document.getElementById('stat-tags').textContent = stats.stats.totalTags || 0;
    document.getElementById('stat-duplicates').textContent = stats.stats.duplicates || 0;
    document.getElementById('stat-dead').textContent = stats.stats.deadLinks || 0;
  }
}
```

- [ ] **Step 4: 更新 manifest.json 添加 fullpage 页面**

```json
{
  "manifest_version": 3,
  "name": "书签智能整理",
  "version": "0.1.0",
  "description": "按域名自动分类书签，AI 生成标签，跨浏览器同步",
  "permissions": ["bookmarks", "storage", "alarms", "activeTab"],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_title": "书签智能整理",
    "default_popup": "src/ui/fullpage.html"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add bookmarks/src/ui/ bookmarks/manifest.json
git commit -m "feat: add full-screen tab UI"
```

---

## Task 14: 设置页面

**Files:**
- Create: `bookmarks/src/ui/settings.html`
- Create: `bookmarks/src/ui/settings.js`
- Create: `bookmarks/src/ui/settings.css`

- [ ] **Step 1: 创建设置页面 HTML**

```html
<!-- bookmarks/src/ui/settings.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>设置 - 书签智能整理</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div class="settings">
    <h2>⚙️ 设置</h2>

    <section class="section">
      <h3>DeepSeek API 配置</h3>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="deepseek-key" placeholder="sk-xxx">
      </div>
      <div class="form-group">
        <label>API 端点</label>
        <input type="text" id="deepseek-url" placeholder="https://api.deepseek.com">
      </div>
      <div class="form-group">
        <label>模型</label>
        <input type="text" id="deepseek-model" placeholder="deepseek-chat">
      </div>
    </section>

    <section class="section">
      <h3>Supabase 配置（标签跨浏览器同步）</h3>
      <div class="form-group">
        <label>Supabase URL</label>
        <input type="text" id="supabase-url" placeholder="https://xxx.supabase.co">
      </div>
      <div class="form-group">
        <label>Supabase Key</label>
        <input type="password" id="supabase-key" placeholder="anon-key">
      </div>
    </section>

    <section class="section">
      <h3>失效链接检测</h3>
      <div class="form-group">
        <label>检测频率</label>
        <select id="dead-link-frequency">
          <option value="daily">每天</option>
          <option value="weekly" selected>每周</option>
          <option value="monthly">每月</option>
        </select>
      </div>
    </section>

    <button id="btn-save" class="btn btn-primary">保存设置</button>
    <span id="save-status"></span>
  </div>

  <script src="settings.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: 创建设置页面 CSS**

```css
/* bookmarks/src/ui/settings.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; }
.settings { max-width: 600px; margin: 40px auto; padding: 24px; }
h2 { margin-bottom: 24px; }
.section { background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
h3 { margin-bottom: 16px; font-size: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #666; margin-bottom: 6px; }
.form-group input, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; }
.btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
#save-status { margin-left: 12px; font-size: 13px; color: #4caf50; }
```

- [ ] **Step 3: 创建设置页面 JS**

```javascript
// bookmarks/src/ui/settings.js
document.addEventListener('DOMContentLoaded', async () => {
  // 加载现有配置
  const config = await chrome.storage.local.get([
    'deepseekApiKey', 'deepseekBaseUrl', 'deepseekModel',
    'supabaseUrl', 'supabaseKey',
    'deadLinkCheckFrequency',
  ]);

  if (config.deepseekApiKey) document.getElementById('deepseek-key').value = config.deepseekApiKey;
  if (config.deepseekBaseUrl) document.getElementById('deepseek-url').value = config.deepseekBaseUrl;
  if (config.deepseekModel) document.getElementById('deepseek-model').value = config.deepseekModel;
  if (config.supabaseUrl) document.getElementById('supabase-url').value = config.supabaseUrl;
  if (config.supabaseKey) document.getElementById('supabase-key').value = config.supabaseKey;
  if (config.deadLinkCheckFrequency) document.getElementById('dead-link-frequency').value = config.deadLinkCheckFrequency;

  // 保存
  document.getElementById('btn-save').addEventListener('click', async () => {
    await chrome.storage.local.set({
      deepseekApiKey: document.getElementById('deepseek-key').value,
      deepseekBaseUrl: document.getElementById('deepseek-url').value || 'https://api.deepseek.com',
      deepseekModel: document.getElementById('deepseek-model').value || 'deepseek-chat',
      supabaseUrl: document.getElementById('supabase-url').value,
      supabaseKey: document.getElementById('supabase-key').value,
      deadLinkCheckFrequency: document.getElementById('dead-link-frequency').value,
    });

    document.getElementById('save-status').textContent = '✓ 已保存';
    setTimeout(() => {
      document.getElementById('save-status').textContent = '';
    }, 2000);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add bookmarks/src/ui/settings.html bookmarks/src/ui/settings.js bookmarks/src/ui/settings.css
git commit -m "feat: add settings page"
```

---

## 最终验证

- [ ] **运行所有测试**

```bash
cd bookmarks && npm test
```

Expected: All tests PASS

- [ ] **加载扩展到 Chrome**

1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `bookmarks/` 目录

- [ ] **测试基本功能**

1. 点击扩展图标，应显示全屏 Tab 界面
2. 添加一个新书签，应自动分类到对应域名文件夹
3. 进入设置页面，配置 DeepSeek API Key
4. 再次添加书签，应自动生成标签
