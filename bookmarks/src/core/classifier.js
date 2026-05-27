import { extractDomain, mergeSubdomain } from '../utils/domain.js';
import { cleanUrl } from './url-cleaner.js';

export function classify(url, title) {
  const cleanedUrl = cleanUrl(url);
  const rawDomain = extractDomain(cleanedUrl);
  if (!rawDomain) {
    return { cleanedUrl, domain: null, folderName: null };
  }
  const domain = mergeSubdomain(rawDomain);
  if (!domain) {
    return { cleanedUrl, domain: rawDomain, folderName: rawDomain };
  }
  return {
    cleanedUrl,
    domain,
    folderName: domain,
  };
}
