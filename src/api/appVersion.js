import { Platform } from 'react-native';
import { env } from '../config/env';

/**
 * Force-update gate check — same shape/timeout/fail-open pattern as
 * checkMaintenanceStatus. A failed check (offline, backend down) must never
 * block the app, so it resolves to "no gate" rather than throwing.
 */
export const checkAppVersion = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const baseUrl = env.apiUrl.includes('/api/v1')
      ? env.apiUrl.replace('/api/v1', '')
      : env.apiUrl;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const response = await fetch(
      `${baseUrl}/api/v1/app/version-check?app=rider&platform=${platform}`,
      { signal: controller.signal },
    );
    if (!response.ok) return { minVersionCode: 0, minBuildNumber: 0, updateUrl: null };
    return await response.json();
  } catch {
    return { minVersionCode: 0, minBuildNumber: 0, updateUrl: null };
  } finally {
    clearTimeout(timer);
  }
};
