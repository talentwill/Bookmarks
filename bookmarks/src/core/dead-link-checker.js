export function categorizeStatusCode(status) {
  if (status >= 200 && status < 300) return 'alive';
  if (status >= 300 && status < 400) return 'alive'; // redirects already followed
  if (status === 404 || status === 410) return 'dead';
  if (status >= 500) return 'dead';
  if (status === 403 || status === 429) return 'blocked'; // likely alive but blocking
  return 'unknown';
}

export async function checkLink(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    // HEAD 不支持时降级为 GET
    if (response.status === 405 || response.status === 400) {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });
    }

    const category = categorizeStatusCode(response.status);
    return {
      url,
      statusCode: response.status,
      isDead: category === 'dead',
      isBlocked: category === 'blocked',
      error: null,
    };
  } catch (error) {
    // 区分网络错误和真正的死链
    const isTimeout = error.name === 'AbortError';
    const isNetworkError = error.name === 'TypeError';
    return {
      url,
      statusCode: null,
      isDead: false, // 网络错误不等于死链
      isBlocked: false,
      error: isTimeout ? 'timeout' : isNetworkError ? 'network_error' : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}
