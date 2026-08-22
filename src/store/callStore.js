import { create } from 'zustand';

// Not persisted — a call never survives an app restart, and shouldn't.
const initialState = {
  status: 'idle',       // idle | outgoing | ringing | incoming | connecting | connected | ended
  tripId: null,
  peerName: '',
  peerRole: null,        // 'driver' | 'rider'
  peerAvatarUrl: null,
  endedReason: null,     // 'declined' | 'busy' | 'unavailable' | 'ended' | 'failed'
  connectedAt: null,
  isMuted: false,
  isSpeakerOn: false,
  // Full-screen by default once connected; collapses to a small pill so the
  // rider can still see the map/trip while talking — a real call, unlike a
  // ringing alert, can run for minutes and shouldn't have to block the UI.
  isMinimized: false,
  // True only while Accept is waiting on the SDP offer to arrive (the
  // killed-app wake path can show the ring UI slightly before the offer
  // itself has arrived over the socket) — lets the Accept button show it
  // heard the tap instead of appearing to do nothing.
  isAcceptPending: false,
};

let endedTimer = null;

const useCallStore = create((set) => ({
  ...initialState,

  setOutgoing: ({ tripId, peerName, peerRole, peerAvatarUrl }) => {
    clearTimeout(endedTimer);
    set({ ...initialState, status: 'outgoing', tripId, peerName, peerRole, peerAvatarUrl: peerAvatarUrl ?? null });
  },

  setIncoming: ({ tripId, peerName, peerRole, peerAvatarUrl }) => {
    clearTimeout(endedTimer);
    set({ ...initialState, status: 'incoming', tripId, peerName, peerRole, peerAvatarUrl: peerAvatarUrl ?? null });
  },

  setStatus: (status) =>
    set((s) => ({
      status,
      connectedAt: status === 'connected' && !s.connectedAt ? Date.now() : s.connectedAt,
    })),

  setMuted: (isMuted) => set({ isMuted }),
  setSpeakerOn: (isSpeakerOn) => set({ isSpeakerOn }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setAcceptPending: (isAcceptPending) => set({ isAcceptPending }),

  /** Remote/error-triggered end — lingers in 'ended' briefly so the UI can show why, then auto-clears. */
  setEnded: (reason) => {
    clearTimeout(endedTimer);
    set({ status: 'ended', endedReason: reason });
    endedTimer = setTimeout(() => set({ ...initialState }), 1800);
  },

  /** Local/immediate clear — used when the user hangs up or declines themselves. */
  reset: () => {
    clearTimeout(endedTimer);
    set({ ...initialState });
  },
}));

export default useCallStore;
