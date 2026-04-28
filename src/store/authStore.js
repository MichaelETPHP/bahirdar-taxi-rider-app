import { create } from 'zustand';
import { saveTokens, getTokens, clearTokens, updateTokensOnly, getStoredPhone } from '../utils/tokenStorage';
import { getSessionStatus, updateLastActivity } from '../utils/sessionManager';
import { fetchProfile, refreshTokens } from '../services/authService';
import useLocationStore from './locationStore';
import useRideStore from './rideStore';
import { initApiClient } from '../lib/apiClient';
import { showSessionExpiredAlert } from '../utils/logoutAlert';

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
    set({ isAuthenticated, isNewUser }),

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
          avatarUrl:   u.avatar_url   || u.avatarUrl || u.profileImage || state.user?.avatarUrl,
          preferredLang: u.preferred_lang || state.user?.preferredLang,
          isVerified:  u.is_verified  ?? state.user?.isVerified,
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
  }
});

export default useAuthStore;
