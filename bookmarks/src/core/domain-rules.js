export const SUBDOMAIN_MAP = {
  'gist.github.com': 'github.com',
  'docs.github.com': 'github.com',
  'raw.githubusercontent.com': 'github.com',
  'movie.douban.com': 'douban.com',
  'book.douban.com': 'douban.com',
  'music.douban.com': 'douban.com',
  'docs.google.com': 'google.com',
  'drive.google.com': 'google.com',
  'mail.google.com': 'google.com',
  'translate.google.com': 'google.com',
  'learn.microsoft.com': 'microsoft.com',
  'docs.microsoft.com': 'microsoft.com',
  'developer.mozilla.org': 'mozilla.org',
};

// 公共后缀列表（常见多级 TLD）
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.cn', 'org.cn', 'net.cn', 'ac.cn',
  'com.au', 'org.au', 'net.au',
  'co.jp', 'ne.jp', 'or.jp',
  'co.kr', 'ne.kr', 'or.kr',
  'com.br', 'org.br',
  'co.in', 'org.in',
  'com.sg', 'org.sg',
  'co.nz', 'org.nz',
  'com.tw', 'org.tw',
  'co.za', 'org.za',
]);

export function autoMergeDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;

  // 检查是否匹配多级公共后缀
  const lastTwo = parts.slice(-2).join('.');
  if (parts.length >= 3 && MULTI_PART_TLDS.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }

  // 默认取最后两段
  return parts.slice(-2).join('.');
}
