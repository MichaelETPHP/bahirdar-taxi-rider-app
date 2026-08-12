import { apiRequest } from '../lib/apiClient';

export function getNotifications({ limit = 20, offset = 0 } = {}) {
  return apiRequest('GET', `/notifications?limit=${limit}&offset=${offset}`);
}

export function getUnreadNotificationCount() {
  return apiRequest('GET', '/notifications/unread-count');
}

export function markNotificationRead(notifId) {
  return apiRequest('PATCH', `/notifications/${notifId}/read`);
}

export function markAllNotificationsRead() {
  return apiRequest('POST', '/notifications/read-all');
}
