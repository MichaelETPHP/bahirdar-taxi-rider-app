import { create } from 'zustand';
import { saveTokens, getTokens, clearTokens } from '../utils/tokenStorage';
import { fetchProfile } from '../services/authService';
import useLocationStore from './locationStore';
import useRideStore from './rideStore';

const useAuthStore = create((set) => ({
  user: null,
  phone: '',
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isNewUser: false,

  setPhone: (phone) => set({ phone }),

  setUser: (user) => set({ user }),

  /**
   * Persist both tokens to AsyncStorage and store in state.
   */
  setTokens: async (accessToken, refreshToken) => {
    await saveTokens(accessToken, refreshToken);
    set({ token: accessToken, refreshToken });
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
    const token = useAuthStore.getState().token;
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
   * Called on app launch — restores session from AsyncStorage.
   * Returns true if valid tokens were found.
   */
  loadTokens: async () => {
    try {
      const { accessToken, refreshToken } = await getTokens();
      if (accessToken) {
        set({ token: accessToken, refreshToken, isAuthenticated: true });
        await useAuthStore.getState().loadProfile();
        return true;
      }
    } catch (_) {}
    return false;
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
    });
  },
}));

export default useAuthStore;
