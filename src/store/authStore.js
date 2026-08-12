import { create } from 'zustand';
import { saveTokens, getTokens, clearTokens, updateTokensOnly, getStoredPhone } from '../utils/tokenStorage';
import { getSessionStatus, updateLastActivity } from '../utils/sessionManager';
import { fetchProfile, refreshTokens, deleteAccount as deleteAccountApi } from '../services/authService';
import useLocationStore from './locationStore';
import useRideStore from './rideStore';
import { initApiClient } from '../lib/apiClient';
import { showSessionExpiredAlert } from '../utils/logoutAlert';
import useMaintenanceStore from './maintenanceStore';

const useAuthStore = create((set, get) => ({
  user: null,
  phone: '',
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isNewUser: false,
  sessionExpiresAt: null,
  // True for one HomeScreen mount right after a successful login (phone OTP,
  // Google, or finishing ProfileSetup) — the welcome banner reads this once,
  // then clears it, so it never reappears on a later app reopen/refresh.
  justAuthenticated: false,
  // Name/email/photo from a completed Google sign-in on the login screen —
  // phone verification is still required, this only prefills ProfileSetup
  // for brand-new accounts. Cleared once consumed there, or on logout.
  googleProfile: null,

  setPhone: (phone) => set({ phone }),
  setUser: (user) => set({ user }),
  setGoogleProfile: (googleProfile) => set({ googleProfile }),

  setTokens: async (accessToken, refreshToken, expiresIn = 3600, user = null) => {
    const currentPhone = get().phone;
    const currentUser = user || get().user;
    const session = await saveTokens(accessToken, refreshToken, expiresIn, currentPhone, currentUser);
    set({
      token: accessToken,
      refreshToken,
      user: currentUser,
      sessionExpiresAt: new Date(session.expiresAt),
    });
  },

  setAuthenticated: (isAuthenticated, isNewUser = false) =>
    set({ isAuthenticated, isNewUser, justAuthenticated: isAuthenticated }),

  clearJustAuthenticated: () => set({ justAuthenticated: false }),

  updateUser: (updates) =>
    set((state) => ({ user: { ...state.user, ...updates } })),

  loadProfile: async () => {
    const token = get().token;
    if (!token || !token.startsWith('eyJ')) return;

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
          createdAt:   u.created_at    ?? state.user?.createdAt,
          avatarUpdatedAt: u.updated_at ?? state.user?.avatarUpdatedAt ?? state.user?.updated_at,
          avatarUrl:   u.avatar_url || u.avatarUrl || u.profileImage || state.user?.avatarUrl,
          preferredLang: u.preferred_lang || state.user?.preferredLang,
          isVerified:  u.is_verified  ?? state.user?.isVerified,
          walletBalance: u.wallet_balance ?? state.user?.walletBalance,
        },
      }));
    } catch (_) {}
  },

  loadTokens: async () => {
    try {
      const status = await getSessionStatus();

      if (status.status === 'no_session' || status.status === 'error') {
        get().logout();
        return false;
      }

      const storedPhone = await getStoredPhone();
      if (storedPhone) set({ phone: storedPhone });

      if (status.needsRefresh && status.refreshToken) {
        try {
          const refreshed = await refreshTokens(status.refreshToken);
          if (refreshed?.data?.accessToken) {
            await updateTokensOnly(refreshed.data.accessToken, refreshed.data.refreshToken, 3600);
            set({
              token: refreshed.data.accessToken,
              refreshToken: refreshed.data.refreshToken,
              user: status.user,
              isAuthenticated: true,
              sessionExpiresAt: new Date(status.expiresAt),
            });
          }
        } catch (err) {
          // 401/403 means the refresh token was revoked (another device logged in).
          // Force logout so the user sees the login screen immediately.
          const httpStatus = err?.status ?? err?.response?.status;
          if (httpStatus === 401 || httpStatus === 403) {
            await get().logout();
            return false;
          }
          // Network error / server down — keep the existing token so the user
          // isn't kicked out just because they're temporarily offline.
          set({
            token: status.accessToken,
            refreshToken: status.refreshToken,
            user: status.user,
            isAuthenticated: true,
            sessionExpiresAt: new Date(status.expiresAt),
          });
        }
      } else {
        set({
          token: status.accessToken,
          refreshToken: status.refreshToken,
          user: status.user,
          isAuthenticated: true,
          sessionExpiresAt: new Date(status.expiresAt),
        });
      }

      get().loadProfile().catch(() => {});
      return true;
    } catch (err) {
      get().logout();
      return false;
    }
  },

  logout: async () => {
    await clearTokens();
    useLocationStore.getState().clearAll();
    useRideStore.getState().reset();
    set({
      user: null,
      phone: '',
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isNewUser: false,
      sessionExpiresAt: null,
      justAuthenticated: false,
      googleProfile: null,
    });
  },

  deleteAccount: async (reason = '') => {
    const token = get().token;
    // Call the API — 204 means success; anything else throws
    await deleteAccountApi(reason, token);
    // Wipe local state and stored tokens exactly like logout
    await clearTokens();
    useLocationStore.getState().clearAll();
    useRideStore.getState().reset();
    set({
      user: null,
      phone: '',
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isNewUser: false,
      sessionExpiresAt: null,
      justAuthenticated: false,
      googleProfile: null,
    });
  },
}));

// ── Initialize API Client with Store Callbacks ──────────────────────
initApiClient({
  getToken: () => useAuthStore.getState().token,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onRefreshed: async (newToken, newRefresh) => {
    await useAuthStore.getState().setTokens(newToken, newRefresh);
  },
  onExpired: async () => {
    await showSessionExpiredAlert(async () => {
      await useAuthStore.getState().logout();
    });
  },
  onMaintenance: async (data) => {
    useMaintenanceStore.getState().setMaintenance(true, data);
  }
});

export default useAuthStore;
