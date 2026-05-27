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

export function parseTagResponse(response) {
  const content = response.choices?.[0]?.message?.content;
  if (!content) return [];

  const match = content.match(/\[.*?\]/s);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim())
      .slice(0, 4);
  } catch {
    return [];
  }
}
