import { SUBDOMAIN_MAP, autoMergeDomain } from '../core/domain-rules.js';

export function extractDomain(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  let hostname = url.hostname;
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }
  return hostname;
}

export function mergeSubdomain(hostname) {
  if (!hostname) return null;
  if (SUBDOMAIN_MAP[hostname]) {
    return SUBDOMAIN_MAP[hostname];
  }
  return autoMergeDomain(hostname);
}
