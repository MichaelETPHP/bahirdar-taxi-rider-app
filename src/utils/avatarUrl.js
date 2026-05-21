import { API_BASE_URL } from '../config/api';

function getApiOrigin() {
  return String(API_BASE_URL || '').replace(/\/api\/v1\/?$/, '');
}

function getImageOrigin() {
  const apiOrigin = getApiOrigin();
  if (!apiOrigin) return '';
  try {
    return new URL(apiOrigin).origin;
  } catch {
    return apiOrigin;
  }
}

export function normalizeAvatarUrl(rawUrl) {
  if (!rawUrl) return null;

  const url = String(rawUrl).trim();
  if (!url) return null;
  if (/^(data:|file:|content:)/i.test(url)) return url;

  const apiOrigin = getApiOrigin();
  const imageOrigin = getImageOrigin();

  try {
    if (url.startsWith('//')) {
      const protocol = imageOrigin ? new URL(imageOrigin).protocol : 'https:';
      return `${protocol}${url}`;
    }

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    if (!imageOrigin) return url;
    if (url.startsWith('/')) return `${imageOrigin}${url}`;
    return new URL(url, `${imageOrigin}/`).toString();
  } catch {
    return imageOrigin ? `${imageOrigin}/${url.replace(/^\/+/, '')}` : url;
  }
}

export function buildAvatarUrl(rawUrl, version) {
  const normalized = normalizeAvatarUrl(rawUrl);
  if (!normalized) return null;
  if (!version || /^(data:|file:|content:)/i.test(normalized)) return normalized;

  const bust = encodeURIComponent(String(version));
  return `${normalized}${normalized.includes('?') ? '&' : '?'}v=${bust}`;
}
