import { create } from 'zustand';

const useUpdateStore = create((set) => ({
  updateRequired: false,
  updateInfo: null,

  setUpdateRequired: (required, info = null) => set({
    updateRequired: required,
    updateInfo: info,
  }),
}));

export default useUpdateStore;
