import { create } from 'zustand';
import { saveTokens, getTokens, clearTokens, updateTokensOnly, getStoredPhone } from '../utils/tokenStorage';
import { getSessionStatus, updateLastActivity } from '../utils/sessionManager';
import { fetchProfile, refreshTokens } from '../services/authService';
import useLocationStore from './locationStore';
import useRideStore from './rideStore';

// Don't use persist middleware for auth - session is managed via sessionManager
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
    const currentPhone = get().phone;
    const currentUser = get().user;
    const session = await saveTokens(accessToken, refreshToken, expiresIn, currentPhone, currentUser);
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

    // Skip API call for locally-generated mock tokens — they are not real JWTs
    // Real RS256 JWTs always start with 'eyJ' (base64 for '{"alg"')
    if (!token.startsWith('eyJ')) {
      console.log('[loadProfile] Skipping API call: local mock token detected.');
      return;
    }

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
          avatarUrl:   u.avatar_url   || u.profileImage || state.user?.avatarUrl,
          preferredLang: u.preferred_lang || state.user?.preferredLang,
          isVerified:  u.is_verified  ?? state.user?.isVerified,
        },
      }));
    } catch (_) {}
  },

  /**
   * Called on app launch — restores 30-day session from storage.
   * Returns true if valid session was found and restored.
   */
  loadTokens: async () => {
    try {
      const status = await getSessionStatus();

      // No session or session has expired
      if (status.status === 'no_session' || status.status === 'error') {
        console.log('[loadTokens] No valid session:', status.status);
        // Ensure clean state
        set({
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          sessionExpiresAt: null,
          phone: '',
        });
        return false;
      }

      // Session is active - restore phone number first
      console.log('[loadTokens] Session found, expires in', status.daysRemaining, 'days');
      const storedPhone = await getStoredPhone();
      if (storedPhone) {
        set({ phone: storedPhone });
        console.log('[loadTokens] Phone number restored:', storedPhone);
      }

      // Check if tokens need refresh before using them
      if (status.needsRefresh && status.refreshToken) {
        try {
          console.log('[loadTokens] Token needs refresh, attempting refresh...');
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
                user: status.user, // Restore user info immediately
                isAuthenticated: true,
                sessionExpiresAt: new Date(status.expiresAt),
              });
              console.log('[loadTokens] Token refreshed successfully');
            }
          } catch (err) {
            console.warn('[loadTokens] Token refresh failed, using existing tokens:', err.message);
            // If refresh fails, continue with existing valid tokens
            set({
              token: status.accessToken,
              refreshToken: status.refreshToken,
              user: status.user, // Restore user info immediately
              isAuthenticated: true,
              sessionExpiresAt: new Date(status.expiresAt),
            });
          }
        } else {
          // Tokens are still fresh, use them directly
          set({
            token: status.accessToken,
            refreshToken: status.refreshToken,
            user: status.user, // Restore user info immediately
            isAuthenticated: true,
            sessionExpiresAt: new Date(status.expiresAt),
          });
        }

      // Load user profile in background (non-blocking)
      get().loadProfile().catch((err) => {
        console.warn('[loadTokens] Failed to load profile:', err.message);
      });

      return true;
    } catch (err) {
      console.error('[loadTokens] Fatal error:', err);
      // Ensure clean state on error
      set({
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        sessionExpiresAt: null,
        phone: '',
      });
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
