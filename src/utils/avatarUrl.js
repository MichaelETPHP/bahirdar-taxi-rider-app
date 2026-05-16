export function buildAvatarUrl(rawUrl, version) {
  if (!rawUrl) return null;

  const url = String(rawUrl).trim();
  if (!url) return null;

  if (!version) return url;

  if (/^(data:|file:|content:)/i.test(url)) {
    return url;
  }

  const bust = encodeURIComponent(String(version));
  return `${url}${url.includes('?') ? '&' : '?'}v=${bust}`;
}
