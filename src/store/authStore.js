import { create } from 'zustand';
import { saveTokens, getTokens, clearTokens, updateTokensOnly } from '../utils/tokenStorage';
import { getSessionStatus, updateLastActivity } from '../utils/sessionManager';
import { fetchProfile, refreshTokens } from '../services/authService';
import useLocationStore from './locationStore';
import useRideStore from './rideStore';

const useAuthStore = create((set, get) => ({
  user: null,
  phone: '',
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isNewUser: false,
  sessionExpiresAt: null,

  setPhone: (phone) => set({ phone }),

  setUser: (user) => set({ user }),

  /**
   * Persist both tokens to AsyncStorage with 30-day session expiration.
   * Tokens are automatically refreshed before expiry.
   */
  setTokens: async (accessToken, refreshToken, expiresIn = 3600) => {
    const session = await saveTokens(accessToken, refreshToken, expiresIn);
    set({
      token: accessToken,
      refreshToken,
      sessionExpiresAt: new Date(session.expiresAt),
    });
  },

  setAuthenticated: (isAuthenticated, isNewUser = false) =>
    set({ isAuthenticated, isNewUser }),

  updateUser: (updates) =>
    set((state) => ({ user: { ...state.user, ...updates } })),

  /**
   * Fetch full profile from API and merge into user state.
   * Call this right after login or on app resume when already authenticated.
   */
  loadProfile: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetchProfile(token);
      const u = res?.data;
      if (!u) return;
      set((state) => ({
        user: {
          ...state.user,
          id:          u.id ?? state.user?.id,
          phone:       u.phone ?? state.user?.phone,
          role:        u.role ?? state.user?.role,
          fullName:    u.full_name    || u.fullName    || state.user?.fullName,
          email:       u.email        ?? state.user?.email,
          gender:      u.gender       ?? state.user?.gender,
          dateOfBirth: u.date_of_birth ?? state.user?.dateOfBirth,
          avatarUrl:   u.avatar_url   ?? state.user?.avatarUrl,
          isVerified:  u.is_verified  ?? state.user?.isVerified,
        },
      }));
    } catch (_) {}
  },

  /**
   * Called on app launch — restores 30-day session from storage.
   * Returns true if valid session was found.
   */
  loadTokens: async () => {
    try {
      const status = await getSessionStatus();

      if (status.status === 'no_session') {
        return false;
      }

      if (status.status === 'error') {
        return false;
      }

      // Session is active - check if tokens need refresh
      if (status.needsRefresh && status.refreshToken) {
        try {
          const refreshed = await refreshTokens(status.refreshToken);
          if (refreshed?.data?.accessToken) {
            await updateTokensOnly(
              refreshed.data.accessToken,
              refreshed.data.refreshToken,
              3600
            );
            set({
              token: refreshed.data.accessToken,
              refreshToken: refreshed.data.refreshToken,
              isAuthenticated: true,
              sessionExpiresAt: new Date(status.expiresAt),
            });
          }
        } catch (err) {
          console.error('Token refresh failed:', err);
          // If refresh fails, try with existing tokens
          set({
            token: status.accessToken,
            refreshToken: status.refreshToken,
            isAuthenticated: true,
            sessionExpiresAt: new Date(status.expiresAt),
          });
        }
      } else {
        set({
          token: status.accessToken,
          refreshToken: status.refreshToken,
          isAuthenticated: true,
          sessionExpiresAt: new Date(status.expiresAt),
        });
      }

      // Load user profile
      await get().loadProfile();
      return true;
    } catch (err) {
      console.error('Failed to load tokens:', err);
      return false;
    }
  },

  /**
   * Update last activity timestamp (call when app comes to foreground)
   */
  updateActivity: async () => {
    await updateLastActivity();
  },

  /**
   * Check session validity and auto-logout if expired
   */
  validateSession: async () => {
    const status = await getSessionStatus();

    if (status.status === 'no_session' || status.status === 'error') {
      // Session expired or invalid - logout
      if (get().isAuthenticated) {
        await get().logout();
      }
      return false;
    }

    return true;
  },

  logout: async () => {
    await clearTokens();
    useLocationStore.getState().clearAll();
    useRideStore.getState().reset();
    useRideStore.setState((s) => ({
      selectedCategoryId: s.categories[0]?.id ?? null,
    }));
    set({
      user: null,
      phone: '',
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isNewUser: false,
      sessionExpiresAt: null,
    });
  },

  deleteAccount: async () => {
    await clearTokens();
    useLocationStore.getState().clearAll();
    useRideStore.getState().reset();
    useRideStore.setState((s) => ({
      selectedCategoryId: s.categories[0]?.id ?? null,
    }));
    set({
      user: null,
      phone: '',
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isNewUser: false,
      sessionExpiresAt: null,
    });
  },
}));

export default useAuthStore;
