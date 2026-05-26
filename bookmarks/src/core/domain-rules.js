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

export function autoMergeDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}
