# 网络收藏夹整理工具 - 设计文档

**日期**: 2026-04-29
**状态**: 待实施

## 目标

将浏览器导出的 2134 个书签（Netscape Bookmark HTML 格式）进行自动分类整理：
- 基于规则 + 本地 Ollama AI 混合分类
- URL 去重（保留最新记录）
- 生成整理后的 Netscape Bookmark HTML 文件，可直接导入浏览器

## 输入

- `favorites_4_29_26.html`：浏览器导出的收藏夹文件（~1.6MB，2134 个书签，272 个文件夹）

## 分类体系

| 分类 | 说明 |
|------|------|
| 编程开发 | GitHub、Gitee、编程语言文档、技术博客 |
| AI与机器学习 | AI 工具、LLM 相关、AI 课程 |
| 影视娱乐 | 豆瓣电影、B站、视频流媒体 |
| 读书学习 | 豆瓣读书、课程平台、知识管理 |
| 工具效率 | 效率工具、VPN、软件下载 |
| 工作相关 | 公司项目、内部系统 |
| 生活休闲 | 购物、运动、旅行、美食 |
| 社交媒体 | 微博、知乎、V2EX |
| 资讯新闻 | 新闻网站、博客 |
| 未分类 | 规则和 AI 都无法确定的书签 |

## 系统架构

### 流程

```
HTML 文件 → 解析器 → 去重器 → 规则分类器 → AI 分类器 → 结果生成器 → 输出 HTML
```

### 模块

1. **HTML 解析器**：BeautifulSoup 解析 Netscape Bookmark 格式，提取每个书签的 title、url、add_date、icon、original_folder_path
2. **URL 去重器**：基于 URL 去重（忽略 hash 和 trailing slash），相同 URL 只保留 ADD_DATE 最新的
3. **规则分类器**：基于域名 + 标题关键词进行匹配，输出 category 或 "待分类"
4. **AI 分类器**：对 "待分类" 书签调用 Ollama API（批量处理，每批 20-30 条），返回分类结果
5. **结果生成器**：生成 Netscape Bookmark HTML 文件，保持原有 ICON 数据

### 技术栈

- Python 3 单文件脚本
- 依赖：`beautifulsoup4`、`requests`（Ollama API 调用）
- 本地 Ollama 作为 AI 分类服务

### 规则分类策略

基于 URL 域名映射：
- `github.com` → 编程开发
- `gitee.com` → 编程开发
- `movie.douban.com` → 影视娱乐
- `book.douban.com` → 读书学习
- `bilibili.com` → 影视娱乐
- `douyin.com` → 影视娱乐
- `weibo.com` → 社交媒体
- `zhihu.com` → 社交媒体
- `v2ex.com` → 社交媒体
- `notion.so` → 工具效率
- `feishu.cn` / `lark` → 工作相关

基于标题关键词：
- 标题含 `BBP`/`FHS`/`NSB`/`Pronto`/`DEV` → 工作相关
- 标题含 `AI`/`LLM`/`RAG`/`GPT`/`Claude`/`Prompt` → AI与机器学习
- 标题含 `Python`/`Java`/`Go`/`Docker`/`Git`/`编程` → 编程开发

### AI 分类策略

使用 Ollama 本地模型（推荐 llama3 或 qwen2）：
- 将每批书签的标题 + URL 组合成 prompt
- Prompt 中提供分类列表和每类的简要说明
- 模型返回每条书签对应的分类编号
- 解析模型返回结果，分配到对应分类

## 输出

### 文件结构

```
Bookmarks Bar/
├── 编程开发/
├── AI与机器学习/
├── 影视娱乐/
├── 读书学习/
├── 工具效率/
├── 工作相关/
├── 生活休闲/
├── 社交媒体/
├── 资讯新闻/
└── 未分类/
```

每个文件夹内书签按添加时间倒序排列。保留所有书签的 ICON（favicon base64）数据。

### 统计报告

脚本运行完成后打印：
- 总书签数 → 去重后数量
- 每个分类的书签数和占比
- 规则分类覆盖率 vs AI 分类覆盖率
- 未分类数量

## 约束

- 单文件 Python 脚本，不拆分模块
- 必须保留 ICON 数据（浏览器导入后需要显示图标）
- 输出 HTML 必须兼容 Netscape Bookmark 格式（Chrome/Edge 可导入）
- Ollama 服务地址默认 `http://localhost:11434`，可通过命令行参数覆盖
