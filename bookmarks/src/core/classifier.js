import { extractDomain, mergeSubdomain } from '../utils/domain.js';
import { cleanUrl } from './url-cleaner.js';

export function classify(url, title) {
  const cleanedUrl = cleanUrl(url);
  const rawDomain = extractDomain(cleanedUrl);
  const domain = mergeSubdomain(rawDomain);

  return {
    cleanedUrl,
    domain,
    folderName: domain,
  };
}
