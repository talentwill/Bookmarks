export function categorizeStatusCode(status) {
  if (status >= 200 && status < 400) return 'alive';
  if (status === 404) return 'dead';
  if (status >= 500) return 'dead';
  return 'unknown';
}

export async function checkLink(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

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
  } finally {
    clearTimeout(timer);
  }
}
