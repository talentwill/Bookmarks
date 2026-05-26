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

export async function syncTagsToSupabase({ supabaseUrl, supabaseKey, records }) {
  const request = buildUpsertRequest({ supabaseUrl, supabaseKey, records });

  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    throw new Error(`Supabase sync failed: ${response.status}`);
  }

  return response;
}
