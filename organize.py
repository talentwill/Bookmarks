#!/usr/bin/env python3
"""网络收藏夹整理工具 - 规则 + DeepSeek API 混合分类"""

import json
import os
import re
import sys
import time
from collections import defaultdict
from html import escape
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

# ============================================================
# 配置
# ============================================================
INPUT_FILE = "favorites_4_29_26.html"
OUTPUT_FILE = "bookmarks_organized.html"

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

BATCH_SIZE = 30  # 每批发送给 AI 的书签数
DRY_RUN = "--dry-run" in sys.argv

# 分类定义
CATEGORIES = [
    "编程开发",
    "AI与机器学习",
    "影视娱乐",
    "读书学习",
    "工具效率",
    "工作相关",
    "生活休闲",
    "社交媒体",
    "资讯新闻",
    "未分类",
]

CATEGORY_LIST_STR = "\n".join(f"{i}. {c}" for i, c in enumerate(CATEGORIES))

# 域名 → 分类映射
DOMAIN_RULES = {
    "github.com": "编程开发",
    "gitee.com": "编程开发",
    "stackoverflow.com": "编程开发",
    "stack overflow.com": "编程开发",
    "cnblogs.com": "编程开发",
    "csdn.net": "编程开发",
    "juejin.cn": "编程开发",
    "segmentfault.com": "编程开发",
    "developer.mozilla.org": "编程开发",
    "python.org": "编程开发",
    "pypi.org": "编程开发",
    "npmjs.com": "编程开发",
    "docs.rs": "编程开发",
    "pkg.go.dev": "编程开发",
    "rust-lang.org": "编程开发",
    "leetcode.cn": "编程开发",
    "nowcoder.com": "编程开发",
    "codeforces.com": "编程开发",
    "chromewebstore.google.com": "工具效率",
    "addons.mozilla.org": "工具效率",
    "movie.douban.com": "影视娱乐",
    "bilibili.com": "影视娱乐",
    "douyin.com": "影视娱乐",
    "live.douyin.com": "影视娱乐",
    "iqiyi.com": "影视娱乐",
    "youku.com": "影视娱乐",
    "v.qq.com": "影视娱乐",
    "youtube.com": "影视娱乐",
    "netflix.com": "影视娱乐",
    "imdb.com": "影视娱乐",
    "book.douban.com": "读书学习",
    "weread.qq.com": "读书学习",
    "read.readwise.io": "读书学习",
    "coursera.org": "读书学习",
    "udemy.com": "读书学习",
    "candobear.com": "读书学习",
    "notion.so": "工具效率",
    "notion.site": "工具效率",
    "feishu.cn": "工作相关",
    "mubu.com": "工具效率",
    "dynalist.io": "工具效率",
    "todoist.com": "工具效率",
    "ticktick.com": "工具效率",
    "dida365.com": "工具效率",
    "weibo.com": "社交媒体",
    "zhihu.com": "社交媒体",
    "v2ex.com": "社交媒体",
    "twitter.com": "社交媒体",
    "x.com": "社交媒体",
    "reddit.com": "社交媒体",
    "douban.com": "影视娱乐",
    "bing.com": "资讯新闻",
    "google.com": "资讯新闻",
    "baidu.com": "资讯新闻",
    "ruanyifeng.com": "资讯新闻",
    "nokia.com": "工作相关",
    "nsn-net.net": "工作相关",
    "nsn.com": "工作相关",
    "sharepoint.com": "工作相关",
    "workspaces-emea.int.nokia.com": "工作相关",
    "gerrit.ext.net.nokia.com": "工作相关",
    "gitlabe2.ext.net.nokia.com": "工作相关",
    "jiradc.ext.net.nokia.com": "工作相关",
    "jiradc.int.net.nokia.com": "工作相关",
    "jira.int.net.nokia.com": "工作相关",
    "pronto.int.net.nokia.com": "工作相关",
    "pronto.inside.nsn.com": "工作相关",
    "confluence.int.net.nokia.com": "工作相关",
    "confluence.ext.net.nokia.com": "工作相关",
    "sharenet-ims.int.net.nokia.com": "工作相关",
    "hwapici.emea.nsn-net.net": "工作相关",
    "psweb.nsn-net.net": "工作相关",
    "chat.deepseek.com": "AI与机器学习",
    "chat.openai.com": "AI与机器学习",
    "chatgpt.com": "AI与机器学习",
    "openai.com": "AI与机器学习",
    "anthropic.com": "AI与机器学习",
    "claude.ai": "AI与机器学习",
    "ngrok.com": "编程开发",
    "tingwu.aliyun.com": "AI与机器学习",
    "zhipin.com": "生活休闲",
    "taobao.com": "生活休闲",
    "jd.com": "生活休闲",
    "pinduoduo.com": "生活休闲",
    "dianping.com": "生活休闲",
    "meituan.com": "生活休闲",
    "ctrip.com": "生活休闲",
    "12306.cn": "生活休闲",
}

# 标题关键词 → 分类映射
TITLE_KEYWORD_RULES = [
    (r"\b(BBP|FHS|NSB|Pronto|DEV-|VSP|LFS|OBSAI|SCM|HWAPI)\b", "工作相关"),
    (r"\b(AI|LLM|GPT|Claude|Prompt|RAG|大模型|深度学习|机器学习|神经网络)\b", "AI与机器学习"),
    (r"\b(Python|Java\b|Golang|JavaScript|TypeScript|Docker|Kubernetes|React|Vue|Flutter|Rust|C\+\+|Shell|Lua|git\b|nginx|Redis|Spark|ZeroMQ)\b", "编程开发"),
    (r"(编程|开发|代码|算法|数据结构|前端|后端|全栈|部署|测试|调试|API|SDK)", "编程开发"),
    (r"(电影|电视剧|综艺|动漫|纪录片|影视|豆瓣|观影|导演|演员)", "影视娱乐"),
    (r"(读书|阅读|书单|课程|学习|笔记|知识管理|效率|自律|习惯|方法论)", "读书学习"),
    (r"(VPN|代理|翻墙|工具|软件|下载|插件|扩展|效率|生产力)", "工具效率"),
    (r"(招聘|求职|简历|面试|职场|薪资|offer)", "生活休闲"),
]


# ============================================================
# 1. HTML 解析
# ============================================================
def parse_bookmarks(html_path):
    """解析 Netscape Bookmark HTML，提取所有书签（基于正则，兼容各种嵌套结构）"""
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    bookmarks = []
    folder_stack = []

    for line in content.splitlines():
        stripped = line.strip()

        # 检测 </DL> 关闭当前层级（必须先检测，在检测 H3 之前）
        if "</DL>" in stripped:
            if folder_stack:
                folder_stack.pop()
            # 不 continue，一行中可能同时有 </DL> 和其他内容

        # 检测文件夹开始 <H3>...</H3>
        h3_match = re.match(r"<DT><H3[^>]*>([^<]+)</H3>", stripped)
        if h3_match:
            folder_stack.append(h3_match.group(1))
            continue

        # 检测书签 <A HREF="...">
        a_match = re.match(r'<DT><A\s+HREF="([^"]+)"[^>]*ADD_DATE="([^"]*)"[^>]*>([^<]*)</A>', stripped)
        if not a_match:
            a_match = re.match(r'<DT><A\s+HREF="([^"]+)"[^>]*>([^<]*)</A>', stripped)
            if a_match:
                url, title, add_date = a_match.group(1), a_match.group(2), "0"
            else:
                continue
        else:
            url, add_date, title = a_match.group(1), a_match.group(2), a_match.group(3)

        if not url.startswith(("http://", "https://")):
            continue

        icon_match = re.search(r'ICON="([^"]*)"', stripped)
        icon = icon_match.group(1) if icon_match else ""

        bookmarks.append({
            "title": title or url,
            "url": url,
            "add_date": add_date,
            "icon": icon,
            "folder": list(folder_stack),
        })

    return bookmarks


# ============================================================
# 2. URL 去重
# ============================================================
def normalize_url(url):
    """规范化 URL 用于去重比较"""
    parsed = urlparse(url)
    normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    normalized = normalized.rstrip("/")
    if normalized.startswith("http://"):
        normalized = "https://" + normalized[7:]
    return normalized.lower()


def deduplicate(bookmarks):
    """去重，保留 ADD_DATE 最新的"""
    seen = {}
    for bm in bookmarks:
        key = normalize_url(bm["url"])
        if key not in seen or int(bm["add_date"]) > int(seen[key]["add_date"]):
            seen[key] = bm
    return list(seen.values())


# ============================================================
# 3. 规则分类
# ============================================================
def classify_by_rules(url, title):
    """基于域名和标题关键词进行分类"""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    # 去掉 www. 前缀
    domain_no_www = re.sub(r"^www\.", "", domain)

    # 域名匹配
    for rule_domain, category in DOMAIN_RULES.items():
        if domain_no_www == rule_domain or domain_no_www.endswith("." + rule_domain):
            return category

    # 标题关键词匹配
    for pattern, category in TITLE_KEYWORD_RULES:
        if re.search(pattern, title, re.IGNORECASE):
            return category

    return None


# ============================================================
# 4. DeepSeek API 分类
# ============================================================
def classify_batch_ai(bookmarks_batch):
    """调用 DeepSeek API 对一批书签进行分类"""
    items = []
    for i, bm in enumerate(bookmarks_batch):
        items.append(f"{i}. [{bm['title']}] ({bm['url']})")

    prompt = f"""你是一个书签分类助手。请将以下书签分到最合适的类别中。

可选类别：
{CATEGORY_LIST_STR}

请只回复一个 JSON 数组，每个元素是对应序号书签的类别编号（0-{len(CATEGORIES) - 1}）。
不要有任何其他文字。

书签列表：
{chr(10).join(items)}"""

    try:
        resp = requests.post(
            f"{DEEPSEEK_BASE_URL}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 2048,
            },
            timeout=60,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()

        # 提取 JSON 数组
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            indices = json.loads(match.group())
            results = []
            for idx in indices:
                if isinstance(idx, int) and 0 <= idx < len(CATEGORIES):
                    results.append(CATEGORIES[idx])
                else:
                    results.append("未分类")
            return results
    except Exception as e:
        print(f"  [AI 错误] {e}")

    return ["未分类"] * len(bookmarks_batch)


# ============================================================
# 5. 生成 HTML
# ============================================================
def generate_html(categorized):
    """生成 Netscape Bookmark HTML 文件"""
    lines = [
        '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
        '<!-- This is an automatically generated file.',
        '     It will be read and overwritten.',
        '     DO NOT EDIT! -->',
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        '<TITLE>Bookmarks</TITLE>',
        '<H1>Bookmarks</H1>',
        '<DL><p>',
        '    <DT><H3 ADD_DATE="0" LAST_MODIFIED="0">Bookmarks Bar</H3>',
        '    <DL><p>',
    ]

    for cat in CATEGORIES:
        bms = categorized.get(cat, [])
        if not bms:
            continue
        # 按添加时间倒序
        bms.sort(key=lambda x: int(x.get("add_date", "0")), reverse=True)
        lines.append(f'        <DT><H3 ADD_DATE="0" LAST_MODIFIED="0">{escape(cat)}</H3>')
        lines.append("        <DL><p>")
        for bm in bms:
            icon_attr = f' ICON="{escape(bm["icon"])}"' if bm["icon"] else ""
            lines.append(
                f'            <DT><A HREF="{escape(bm["url"])}"'
                f' ADD_DATE="{bm["add_date"]}"'
                f'{icon_attr}>{escape(bm["title"])}</A>'
            )
        lines.append("        </DL><p>")

    lines.append("    </DL><p>")
    lines.append("</DL><p>")

    return "\n".join(lines) + "\n"


# ============================================================
# 6. 主流程
# ============================================================
def main():
    if not os.path.exists(INPUT_FILE):
        print(f"错误: 找不到 {INPUT_FILE}")
        sys.exit(1)

    # 解析
    print(f"📖 正在解析 {INPUT_FILE} ...")
    bookmarks = parse_bookmarks(INPUT_FILE)
    print(f"   解析到 {len(bookmarks)} 条书签")

    # 去重
    print("🔍 正在去重...")
    bookmarks = deduplicate(bookmarks)
    print(f"   去重后 {len(bookmarks)} 条")

    # 规则分类
    print("📋 正在进行规则分类...")
    categorized = defaultdict(list)
    need_ai = []

    for bm in bookmarks:
        cat = classify_by_rules(bm["url"], bm["title"])
        if cat:
            categorized[cat].append(bm)
        else:
            need_ai.append(bm)

    rule_count = sum(len(v) for v in categorized.values())
    total = len(bookmarks) or 1
    print(f"   规则分类覆盖: {rule_count}/{len(bookmarks)} ({100 * rule_count / total:.1f}%)")
    print(f"   需要 AI 分类: {len(need_ai)} 条")

    # AI 分类
    if need_ai and not DRY_RUN:
        if not DEEPSEEK_API_KEY:
            print("\n⚠️  未设置 DEEPSEEK_API_KEY 环境变量，跳过 AI 分类")
            print("   请设置: export DEEPSEEK_API_KEY=your-key")
            for bm in need_ai:
                categorized["未分类"].append(bm)
        else:
            print(f"🤖 正在调用 DeepSeek API 分类 ({len(need_ai)} 条, 批次大小 {BATCH_SIZE})...")
            total_batches = (len(need_ai) + BATCH_SIZE - 1) // BATCH_SIZE
            for i in range(0, len(need_ai), BATCH_SIZE):
                batch = need_ai[i : i + BATCH_SIZE]
                batch_num = i // BATCH_SIZE + 1
                print(f"   批次 {batch_num}/{total_batches} ({len(batch)} 条)...", end=" ", flush=True)
                results = classify_batch_ai(batch)
                for bm, cat in zip(batch, results):
                    categorized[cat].append(bm)
                print("✓")
                if i + BATCH_SIZE < len(need_ai):
                    time.sleep(1)
    elif need_ai and DRY_RUN:
        print("🤖 [DRY RUN] 跳过 AI 分类")
        for bm in need_ai:
            categorized["未分类"].append(bm)

    # 统计报告
    print("\n" + "=" * 50)
    print("📊 分类统计报告")
    print("=" * 50)
    print(f"{'分类':<12} {'数量':>6} {'占比':>8}")
    print("-" * 30)
    for cat in CATEGORIES:
        count = len(categorized.get(cat, []))
        pct = 100 * count / len(bookmarks) if bookmarks else 0
        print(f"{cat:<12} {count:>6} {pct:>7.1f}%")
    print("-" * 30)
    print(f"{'总计':<12} {len(bookmarks):>6}")

    ai_count = sum(1 for bm in need_ai for c in [categorized]
                   if any(bm in categorized[cat] for cat in ["编程开发", "AI与机器学习", "影视娱乐",
                     "读书学习", "工具效率", "工作相关", "生活休闲", "社交媒体", "资讯新闻"]))
    print(f"\n规则分类: {rule_count} | AI分类: {ai_count} | 未分类: {len(categorized.get('未分类', []))}")

    # 生成输出
    print(f"\n📝 正在生成 {OUTPUT_FILE} ...")
    html = generate_html(categorized)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ 完成! 输出文件: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
