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
