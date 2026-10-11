import { beforeEach, expect, mock, test } from 'bun:test';
mock.module('../src/security/sslPinning', () => ({ initSslPinning: async () => {} }));
mock.module('../src/services/searchHistoryService', () => ({ clearSearchHistory: async () => {} }));
mock.module('../src/services/emergencyService', () => ({ clearEmergencyContact: async () => {} }));

const cleared = mock(async () => {});
const disconnected = mock();
const reset = mock();
mock.module('../src/config/api', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
mock.module('zustand', () => ({ create: initializer => {
  let state;
  const set = change => { state = { ...state, ...(typeof change === 'function' ? change(state) : change) }; };
  const get = () => state;
  state = initializer(set, get);
  const store = () => state; store.getState = get; store.setState = set; return store;
} }));
mock.module('../src/utils/tokenStorage', () => ({ clearTokens: cleared, saveTokens: async () => ({ expiresAt: Date.now() }),
  getTokens() {}, updateTokensOnly() {}, getStoredPhone() {} }));
mock.module('../src/utils/sessionManager', () => ({ getSessionStatus() {}, updateLastActivity() {} }));
mock.module('../src/services/socketService', () => ({ disconnectSocket: disconnected }));
mock.module('../src/store/locationStore', () => ({ default: { getState: () => ({ clearPrivateData: reset }) } }));
mock.module('../src/store/rideStore', () => ({ default: { getState: () => ({ reset }) } }));
mock.module('../src/store/maintenanceStore', () => ({ default: { getState: () => ({ setMaintenance() {} }) } }));
mock.module('../src/utils/logoutAlert', () => ({ showSessionExpiredAlert: async callback => callback() }));
const { default: auth } = await import('../src/store/authStore');
const api = await import('../src/lib/apiClient');
const originalFetch = globalThis.fetch;
globalThis.__DEV__ = false;

beforeEach(() => {
  api.finishLogout();
  auth.setState({ token: 'eyJ.access', refreshToken: 'refresh-old', isAuthenticated: true, user: { id: 'rider' } });
  cleared.mockClear(); disconnected.mockClear(); reset.mockClear();
  globalThis.fetch = mock(async () => ({ ok: true, status: 200, json: async () => ({}) }));
});

test('manual logout revokes the backend session before clearing credentials', async () => {
  globalThis.fetch = mock(async (url, options) => {
    expect(url).toEndWith('/auth/logout/refresh');
    expect(JSON.parse(options.body)).toEqual({ refreshToken: 'refresh-old' });
    expect(cleared).not.toHaveBeenCalled();
    return { ok: true, status: 200 };
  });
  await auth.getState().logout();
  expect(cleared).toHaveBeenCalledTimes(1); expect(disconnected).toHaveBeenCalledTimes(1);
  expect(auth.getState().isAuthenticated).toBe(false);
});
test('failed remote revocation preserves credentials so logout can be retried', async () => {
  globalThis.fetch = mock(async () => ({ ok: false, status: 503 }));
  await expect(auth.getState().logout()).rejects.toThrow();
  expect(cleared).not.toHaveBeenCalled(); expect(auth.getState().refreshToken).toBe('refresh-old');
});
test('server-forced logout clears locally without trying to revoke an already revoked session', async () => {
  await auth.getState().logout({ revokeSession: false });
  expect(globalThis.fetch).not.toHaveBeenCalled(); expect(cleared).toHaveBeenCalledTimes(1);
});
test('socket and HTTP refresh share one rotation and logout waits for its new token', async () => {
  let resolve;
  globalThis.fetch = mock(async (url, options) => {
    if (url.endsWith('/auth/rider/refresh')) {
      await new Promise(done => { resolve = done; });
      return { ok: true, status: 200, json: async () => ({ data: { accessToken: 'eyJ.new', refreshToken: 'refresh-new' } }) };
    }
    expect(JSON.parse(options.body).refreshToken).toBe('refresh-new');
    return { ok: true, status: 200 };
  });
  const refresh1 = api.getSharedRefresh(); const refresh2 = api.getSharedRefresh();
  expect(refresh1).toBe(refresh2);
  const logout = auth.getState().logout();
  for (let i = 0; i < 20 && !resolve; i++) await new Promise(done => setTimeout(done, 1));
  expect(typeof resolve).toBe('function');
  resolve();
  await Promise.all([refresh1, refresh2, logout]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(2); expect(cleared).toHaveBeenCalledTimes(1);
});
test('temporary refresh failure does not clear a valid stored session', async () => {
  globalThis.fetch = mock(async () => ({ ok: false, status: 503 }));
  await expect(api.getSharedRefresh()).rejects.toThrow();
  expect(auth.getState().isAuthenticated).toBe(true); expect(cleared).not.toHaveBeenCalled();
});
test('logout guard prevents an unrelated 401 from forcing local credential removal', async () => {
  await api.prepareLogout();
  globalThis.fetch = mock(async () => ({ ok: false, status: 401 }));
  await expect(api.apiRequest('GET', '/riders/me')).rejects.toBeDefined();
  expect(cleared).not.toHaveBeenCalled(); api.finishLogout();
});

process.on('exit', () => { globalThis.fetch = originalFetch; });
