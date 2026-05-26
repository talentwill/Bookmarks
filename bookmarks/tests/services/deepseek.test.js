import { buildTagRequest, parseTagResponse } from '../../src/services/deepseek.js';

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

test('从 API 响应中提取标签数组', () => {
  const response = {
    choices: [{ message: { content: '["React", "前端", "开源"]' } }],
  };
  const tags = parseTagResponse(response);
  expect(tags).toEqual(['React', '前端', '开源']);
});

test('解析包含 markdown 代码块的响应', () => {
  const response = {
    choices: [{ message: { content: '```json\n["Python", "教程", "视频"]\n```' } }],
  };
  const tags = parseTagResponse(response);
  expect(tags).toEqual(['Python', '教程', '视频']);
});
