import { REMOVE_PARAMS } from '../utils/constants.js';
import { removeTrackingParams } from '../utils/url.js';

export function cleanUrl(url) {
  return removeTrackingParams(url, REMOVE_PARAMS);
}
