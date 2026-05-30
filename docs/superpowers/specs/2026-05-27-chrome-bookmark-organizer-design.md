# Chrome 书签智能整理插件 - 设计文档

**日期**: 2026-05-27（合并版，取代 2026-04-29 旧设计）
**状态**: 待实施
**架构选择**: 纯 Chrome 扩展（方案 B）

## 背景

本项目从 2026-04-29 的 Python 脚本方案演进而来。旧方案通过解析导出的 Netscape Bookmark HTML 文件进行离线整理，使用预设分类体系（编程开发、AI与机器学习等 10 类）和本地 Ollama AI。

新方案（本文档）改为纯 Chrome 扩展，核心变化：
- **分类方式**：从预设分类 → 域名即分类（每个域名一个文件夹）
- **标签系统**：新增 AI 自动生成标签，用于跨域名聚合
- **AI 服务**：从本地 Ollama → DeepSeek API（可配置端点）
- **运行方式**：从离线脚本 → 实时浏览器扩展
- **同步能力**：新增 Supabase 标签跨浏览器同步

## 目标

开发一个 Chrome 浏览器插件，实现书签的自动整理、分类、标签管理：
- 域名优先分类 + AI 辅助（DeepSeek API）
- 自动打标签，支持按标签搜索
- URL 清理，去除追踪参数
- 重复书签检测、失效链接检测
- 全屏 Tab 导航界面

## 功能需求

### 核心功能

| 功能 | 描述 |
|------|------|
| 一键整理 | 手动触发，整理所有现有书签 |
| 实时分类 | 新增书签时自动分类（静默执行） |
| 域名分类 | **所有书签按域名分组**（如 github.com、bilibili.com 各一个文件夹） |
| 自动打标签 | **AI 自动生成标签**（用户无需手动操作），标签用于跨域名聚合 |
| URL 清理 | 移除追踪参数（utm_*、fbclid 等），保留纯净 URL |
| 重复检测 | 检测重复书签（同域名文件夹内，删除简单无跨文件夹问题） |
| 失效检测 | 定期检查失效链接（HTTP 状态码），支持强制保留 |
| 书签搜索 | 支持按域名、标签搜索（标签可聚合不同域名的相关链接） |

### 设计理念

**域名即分类**：每个域名对应一个书签文件夹，简单直观。
- 用户记忆方式："我要找 GitHub 上的那个项目" → 直接去 github.com 文件夹
- 不需要预设分类，域名自动成为分类

**标签即聚合**：AI 生成的标签用于跨域名关联。
- 例：标签"React"可以聚合 GitHub 的 React 仓库、B站的 React 教程、知乎的 React 讨论
- 标签完全由 AI 生成，用户无需手动管理

**重复即同文件夹**：按域名分类后，重复书签一定在同一个文件夹。
- 删除重复书签时无需考虑跨文件夹问题
- 简化了重复检测和清理逻辑

### 分类体系

**域名即分类**：每个域名对应一个书签文件夹，无需预设分类。

示例：
- `github.com/` - GitHub 相关书签
- `bilibili.com/` - B站相关书签
- `zhihu.com/` - 知乎相关书签
- `notion.so/` - Notion 相关书签

标签用于跨域名聚合，由 AI 自动生成。

## 系统架构

### 技术栈

- **Manifest V3**（Chrome 插件最新规范）
- **Service Worker**（后台处理）
- **Chrome Bookmarks API**（读写书签）
- **Chrome Storage API**（本地存储）
- **IndexedDB**（标签索引、搜索数据）
- **DeepSeek API**（AI 标签生成）
- **Supabase**（标签跨浏览器同步）
- **HTML/CSS/JavaScript**（UI 界面）

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                           │
├─────────────────────────────────────────────────────────────┤
│  Service Worker (Background)                                │
│  ├── Bookmark Event Listener (实时监听新增书签)             │
│  ├── Classification Engine (分类引擎)                       │
│  │   ├── Domain Classifier (域名分类器)                     │
│  │   └── Tag Generator (标签生成器)                         │
│  ├── URL Cleaner (URL 清理器)                               │
│  ├── Duplicate Detector (重复检测器)                        │
│  └── Dead Link Checker (失效链接检测器)                     │
├─────────────────────────────────────────────────────────────┤
│  UI Pages                                                   │
│  ├── Main Page (全屏 Tab 导航界面)                          │
│  │   ├── 概览 Tab (统计概览)                                │
│  │   ├── 搜索 Tab (书签搜索)                                │
│  │   ├── 域名管理 Tab (域名文件夹管理)                      │
│  │   ├── 重复检测 Tab (重复书签处理)                        │
│  │   └── 失效链接 Tab (失效链接处理，显示"强制保留"状态)    │
│  └── Settings Page (设置页面)                               │
│      ├── API Key 配置（DeepSeek + Supabase）                │
│      └── URL 清理规则配置                                   │
├─────────────────────────────────────────────────────────────┤
│  Storage (本地存储)                                         │
│  ├── chrome.storage.local (规则、配置、缓存)                │
│  └── IndexedDB (标签索引、搜索数据)                         │
├─────────────────────────────────────────────────────────────┤
│  Cloud Sync                                                 │
│  ├── Chrome Native Sync (书签同步)                          │
│  └── Supabase (标签跨浏览器同步)                            │
└─────────────────────────────────────────────────────────────┘
```

### 项目目录结构

```
bookmarks/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   ├── service-worker.js      # 入口，事件监听
│   │   ├── bookmark-listener.js   # 书签事件监听
│   │   └── alarm-handler.js       # 定时任务（失效检测等）
│   ├── core/
│   │   ├── classifier.js          # 域名分类器
│   │   ├── tag-generator.js       # AI 标签生成
│   │   ├── url-cleaner.js         # URL 清理
│   │   ├── duplicate-detector.js  # 重复检测
│   │   ├── dead-link-checker.js   # 失效链接检测
│   │   └── domain-rules.js        # 域名规则
│   ├── services/
│   │   ├── storage.js             # chrome.storage 封装
│   │   ├── indexeddb.js           # IndexedDB 封装
│   │   ├── supabase.js            # Supabase 标签同步
│   │   └── deepseek.js            # DeepSeek API 调用
│   ├── utils/
│   │   ├── url.js                 # URL 工具函数
│   │   ├── domain.js              # 域名提取/合并
│   │   └── constants.js           # 常量定义
│   └── ui/
│       ├── fullpage.html          # 全屏主页面
│       ├── fullpage.js            # 主页面逻辑
│       ├── fullpage.css           # 主页面样式
│       ├── settings.html          # 设置页面
│       ├── settings.js
│       └── settings.css
```

## 核心模块设计

### 1. 分类引擎

#### 分类流程

```
新书签 → URL 清理 → 提取域名 → 创建/进入域名文件夹 → AI 打标签
```

**核心逻辑**：
1. 从 URL 提取域名（如 `github.com`）
2. 检查是否已存在该域名的书签文件夹
   - 不存在：创建新文件夹（文件夹名 = 域名）
   - 存在：直接使用
3. 将书签移入该域名文件夹
4. 调用 AI 生成标签（用于跨域名聚合）

#### 域名文件夹结构

```
书签栏/
├── github.com/
│   ├── React 项目 (标签: React, 前端, 开源)
│   ├── Vue 教程 (标签: Vue, 前端, 教程)
│   └── ...
├── bilibili.com/
│   ├── Python 教学视频 (标签: Python, 教程, 视频)
│   └── ...
├── zhihu.com/
│   ├── 如何学习编程 (标签: 编程, 学习, 经验)
│   └── ...
└── ...
```

#### AI 标签生成 Prompt

```
你是一个书签标签生成助手。请根据以下信息生成 2-4 个相关标签。

书签标题：{title}
书签 URL：{url}
域名：{domain}

标签要求：
- 简洁明了（1-2 个词）
- 能够描述书签的主要内容
- 便于跨域名搜索和聚合
- 中英文标签都可以

示例：
- GitHub React 项目 → ["React", "前端", "开源"]
- B站 Python 教程 → ["Python", "教程", "视频"]
- 知乎编程讨论 → ["编程", "学习", "经验"]

请返回 JSON 数组：
["标签1", "标签2", "标签3"]
```

### 2. URL 清理器

#### 清理规则

```javascript
// 移除的追踪参数
const REMOVE_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid',
  'ref', 'source', 'spm', 'from', 'isappinstalled',
  'scene', 'clickid', 'share_source', 'share_medium',
  'pk_campaign', 'pk_kwd', 'pk_source', 'pk_medium',
  'mc_cid', 'mc_eid',
  'session_id', 'sid', 'token',
];

// 保留的重要参数
const KEEP_PARAMS = [
  'page', 'p', 'q', 'query', 'search', 'keyword',
  'id', 'uid', 'user_id', 'item_id', 'product_id',
  'lang', 'locale', 'hl',
  'tab', 'type', 'sort', 'order', 'filter',
];
```

#### 清理示例

```
输入: https://example.com/article?utm_source=twitter&utm_medium=social&page=2
输出: https://example.com/article?page=2

输入: https://example.com/video?id=123&fbclid=abc123&share_source=copy
输出: https://example.com/video?id=123
```

### 3. 标签生成器

#### 设计原则

- **完全由 AI 生成**：用户无需手动打标签
- **用于跨域名聚合**：标签的主要价值是关联不同域名的相关内容
- **批量处理**：首次整理时批量生成，新增书签时实时生成

#### 标签生成策略

1. **AI 批量生成**（首次整理）
   - 每批 20-30 个书签
   - 调用 DeepSeek API 生成标签
   - 返回 JSON 数组格式

2. **AI 实时生成**（新增书签）
   - 每个新书签单独调用 API
   - 快速返回标签

#### 标签存储

```javascript
// 标签索引（用于搜索和聚合）
{
  "tags": {
    "React": ["bookmark_1", "bookmark_15", "bookmark_23"],
    "Python": ["bookmark_2", "bookmark_8", "bookmark_31"],
    "教程": ["bookmark_3", "bookmark_12", "bookmark_45"]
  }
}
```

#### 标签应用场景

1. **搜索聚合**
   - 搜索"React" → 显示 GitHub 的 React 项目、B站的 React 教程、知乎的 React 讨论
   
2. **相关推荐**
   - 查看某个书签时，显示相同标签的其他书签

3. **标签云**
   - 在 UI 中展示热门标签，点击快速筛选

### 4. 重复检测器

#### 设计优势

由于所有书签按域名分组，**重复书签一定在同一个文件夹内**：
- 无需跨文件夹检测
- 删除操作简单直接
- 不会出现误删其他分类的问题

#### 检测策略

1. **URL 完全匹配**（清理后）
   - 移除追踪参数后比较
   - 最准确的重复检测方式

2. **标题相似度 > 80%**（编辑距离算法）
   - 同域名下标题相似的书签
   - 处理 URL 不同但内容相同的情况

#### 处理方式

- 自动保留最新版本（按添加时间）
- 或标记为重复，由用户确认删除
- 在"重复检测"Tab 中显示重复列表
- 用户可以一键清理所有重复项

### 5. 失效链接检测器

#### 检测策略

- 定期检查（默认每周一次，可配置）
- HTTP 状态码检测（404, 500, timeout）
- 批量检测，避免请求过于频繁（每秒最多 5 个请求）

#### 处理方式

- 标记为失效，不自动删除
- 在"失效链接"Tab 中显示失效列表
- 用户可以选择：
  - **删除**：移除该书签
  - **强制保留**：标记为"已失效（用户保留）"，后续检测跳过
- UI 显示状态：正常书签、已失效、已失效（用户保留）

## UI 设计

### 界面风格

**Tab 导航风格**：顶部 Tab 切换不同功能模块，简洁现代。

### 页面布局

#### 主页面（全屏）

```
┌─────────────────────────────────────────────────────────────┐
│  📚 书签智能整理                [🟢 实时监控中]  [⚡ 立即整理]  [⚙️ 设置] │
├─────────────────────────────────────────────────────────────┤
│  [📊 概览] [🔍 搜索] [🌐 域名管理] [🔗 重复检测] [⚠️ 失效链接]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  统计卡片区域                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ 总书签  │ │ 域名数  │ │ 标签数  │ │ 重复    │ │ 失效    │   │
│  │  489   │ │   45   │ │  128   │ │  12    │ │   5    │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                              │
│  主内容区域（根据 Tab 切换）                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 概览 Tab

- 统计卡片（总书签、域名数、标签数、重复、失效）
- 最近整理的书签列表
- 域名分布图表（Top 10 域名）
- 热门标签云

#### 搜索 Tab

- 搜索栏（支持按域名、标签搜索）
- **标签聚合搜索**：搜索"React"时，显示所有域名下带"React"标签的书签
- 搜索结果列表（显示域名、标签、URL）
- 点击标签可快速筛选相关书签

#### 域名管理 Tab

- 域名文件夹列表（显示每个域名的书签数量）
- 支持重命名域名文件夹
- 支持合并相似域名（如 github.com + gist.github.com）
- 域名统计（Top 20 域名）

#### 重复检测 Tab

- 重复书签分组列表
- 每组显示相似书签
- 操作按钮（保留、删除）

#### 失效链接 Tab

- 失效链接列表
- 状态码显示
- 操作按钮（访问、删除、强制保留）
- 状态标识：正常 / 已失效 / 已失效（用户保留）

### 设置页面

- DeepSeek API Key 配置
- Supabase 配置（URL + Key，用于标签跨浏览器同步）
- URL 清理规则配置
- 检测频率配置

## 数据存储

### chrome.storage.local

```javascript
{
  // API 配置
  "deepseekApiKey": "sk-xxx",
  "deepseekBaseUrl": "https://api.deepseek.com",
  "deepseekModel": "deepseek-chat",

  // Supabase 配置（标签跨浏览器同步）
  "supabaseUrl": "https://xxx.supabase.co",
  "supabaseKey": "xxx",

  // 域名文件夹映射
  "domainFolders": {
    "github.com": "folder_id_1",
    "bilibili.com": "folder_id_2",
    "zhihu.com": "folder_id_3"
    // ...
  },

  // URL 清理规则
  "removeParams": ["utm_source", "utm_medium", ...],
  "keepParams": ["page", "q", "id", ...],

  // 检测配置
  "deadLinkCheckFrequency": "weekly",  // daily, weekly, monthly
  "lastDeadLinkCheck": 1716835200000,
  "lastDuplicateCheck": 1716835200000,

  // 统计数据
  "stats": {
    "totalBookmarks": 489,
    "totalDomains": 45,
    "totalTags": 128,
    "duplicates": 12,
    "deadLinks": 5,
    "lastOrganized": 1716835200000
  }
}
```

### IndexedDB

```javascript
// 书签索引（支持按标签、域名搜索）
{
  "bookmarkId": "123",
  "url": "https://github.com/user/project",
  "title": "React 项目",
  "domain": "github.com",
  "tags": ["React", "前端", "开源"],
  "addDate": 1716835200000,
  "lastChecked": 1716835200000,
  "isDead": false,
  "forceKeep": false,  // 用户强制保留失效链接
  "duplicateGroup": null
}

// 标签索引（用于快速聚合搜索）
{
  "tagIndex": {
    "React": ["bookmark_1", "bookmark_15", "bookmark_23"],
    "Python": ["bookmark_2", "bookmark_8", "bookmark_31"],
    "教程": ["bookmark_3", "bookmark_12", "bookmark_45"]
  }
}
```

### Supabase（标签跨浏览器同步）

```sql
-- bookmark_tags 表
CREATE TABLE bookmark_tags (
  url_hash TEXT PRIMARY KEY,      -- URL 的 SHA-256 哈希（去重键）
  url TEXT NOT NULL,               -- 原始 URL
  title TEXT,                      -- 书签标题
  domain TEXT NOT NULL,            -- 域名
  tags TEXT[] NOT NULL DEFAULT '{}', -- 标签数组
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT                   -- 设备标识
);

-- 索引
CREATE INDEX idx_bookmark_tags_domain ON bookmark_tags(domain);
CREATE INDEX idx_bookmark_tags_tags ON bookmark_tags USING GIN(tags);
```

**同步策略**：
- 书签通过 Chrome 原生同步（Chrome Sync）
- 标签通过 Supabase 同步（支持 Chrome + Edge）
- 同步键：URL 的 SHA-256 哈希
- 冲突处理：以 `updated_at` 较新的为准

## 错误处理

### API 调用失败

- 网络错误：重试 3 次，间隔 1 秒
- API 限流：等待 60 秒后重试
- API Key 无效：提示用户检查配置
- 标签生成失败：标记为"无标签"，不影响书签分类

### 书签操作失败

- 权限不足：提示用户授权
- 书签不存在：跳过并记录日志
- 操作超时：重试 2 次

### 检测失败

- 网络超时：标记为"检测失败"，下次继续
- 状态码异常：记录状态码，由用户决定

## 安全考虑

### API Key 存储

- 使用 chrome.storage.local 存储（加密可选）
- 不在日志中输出完整 API Key
- 支持用户手动清除 API Key

### 权限最小化

- 只请求必要的权限：
  - `bookmarks`：读写书签
  - `storage`：本地存储
  - `alarms`：定时任务
  - `activeTab`：获取当前标签页（可选）

### 数据隐私

- 书签数据只在本地处理
- 只有需要 AI 生成标签时才调用外部 API
- 不收集用户数据

## 测试策略

### 单元测试

- URL 清理器测试
- 域名提取器测试
- AI 标签生成器测试
- 重复检测器测试

### 集成测试

- 域名分类完整流程测试
- 书签事件监听测试
- 存储读写测试
- 标签索引构建测试

### 端到端测试

- 一键整理功能测试
- 实时分类功能测试
- 标签聚合搜索测试
- 重复/失效检测功能测试

## 实现阶段

### 阶段 1：基础框架 + 工具函数

- manifest.json 配置
- Service Worker 基础结构
- URL 清理器（url-cleaner.js）
- 域名提取/合并工具（domain.js、domain-rules.js）
- 常量定义（constants.js）

### 阶段 2：核心分类逻辑

- 域名分类器（classifier.js）
- DeepSeek API 集成（deepseek.js）
- AI 标签生成器（tag-generator.js）
- Storage 封装（storage.js、indexeddb.js）

### 阶段 3：书签整理功能

- 一键整理（批量分类 + 标签生成）
- 实时分类（新增书签自动整理）
- 重复检测器
- Chrome Bookmarks API 集成

### 阶段 4：UI 界面

- 全屏 Tab 导航界面（fullpage.html/js/css）
- 概览 Tab（统计卡片、最近书签）
- 搜索 Tab（按域名、标签搜索）
- 域名管理 Tab
- 设置页面

### 阶段 5：高级功能

- 失效链接检测器（支持强制保留）
- 重复/失效检测 Tab
- Supabase 标签同步
- Alarm 定时任务

### 阶段 6：优化完善

- 性能优化
- 错误处理完善
- UI/UX 优化

## 约束

- 使用 Manifest V3（Chrome 最新规范）
- 遵循 Chrome 插件安全最佳实践
- 书签数据只在本地处理（除 AI 标签生成外）
- 支持 Chrome 88+ 版本
- 插件大小 < 5MB（不含依赖）
- 域名文件夹名使用原始域名（如 github.com）
- 标签完全由 AI 生成，用户无需手动管理

## 参考

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Bookmarks API](https://developer.chrome.com/docs/extensions/reference/bookmarks/)
- [DeepSeek API 文档](https://platform.deepseek.com/api-docs)
- [Supabase 文档](https://supabase.com/docs)
