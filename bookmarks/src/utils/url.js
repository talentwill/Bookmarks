export function removeTrackingParams(urlString, removeList) {
  const url = new URL(urlString);
  for (const param of removeList) {
    url.searchParams.delete(param);
  }
  return url.toString();
}
