export function removeTrackingParams(urlString, removeList) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return urlString;
  }
  for (const param of removeList) {
    url.searchParams.delete(param);
  }
  return url.toString();
}
