import { buildUpsertRequest, buildFetchRequest, syncTagsToSupabase } from '../../src/services/supabase.js';
import { test, expect, jest } from '@jest/globals';

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

test('构建 fetch 请求', () => {
  const request = buildFetchRequest({
    supabaseUrl: 'https://xxx.supabase.co',
    supabaseKey: 'anon-key',
    urlHash: 'abc123',
  });

  expect(request.url).toBe('https://xxx.supabase.co/rest/v1/bookmark_tags?url_hash=eq.abc123');
  expect(request.headers['apikey']).toBe('anon-key');
  expect(request.headers['Authorization']).toBe('Bearer anon-key');
});

test('批量同步标签到 Supabase', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));

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
