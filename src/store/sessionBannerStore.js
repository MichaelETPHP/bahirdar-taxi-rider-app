import { create } from 'zustand';

/**
 * Drives SessionExpiredBanner from outside the React tree — logoutAlert.js
 * is deliberately decoupled from any store/component (see its own header
 * comment), so a plain Zustand store is the only way for it to trigger UI
 * without importing React. Mirrors how useCallStore drives CallOverlay.
 */
const useSessionBannerStore = create((set) => ({
  visible: false,
  message: '',
  show: (message) => set({ visible: true, message }),
  hide: () => set({ visible: false }),
}));

export default useSessionBannerStore;
