import { REMOVE_PARAMS } from '../utils/constants.js';
import { removeTrackingParams } from '../utils/url.js';

export function cleanUrl(url) {
  const cleaned = removeTrackingParams(url, REMOVE_PARAMS);
  return cleaned.replace(/^(https?:\/\/)www\./, '$1');
}
