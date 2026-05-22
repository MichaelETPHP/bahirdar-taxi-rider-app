import { env } from '../config/env';

export const checkMaintenanceStatus = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const baseUrl = env.apiUrl.includes('/api/v1')
      ? env.apiUrl.replace('/api/v1', '')
      : env.apiUrl;
    const response = await fetch(`${baseUrl}/api/v1/maintenance/status`, {
      signal: controller.signal,
    });
    if (!response.ok) return { maintenance: false };
    return await response.json();
  } catch {
    return { maintenance: false };
  } finally {
    clearTimeout(timer);
  }
};
