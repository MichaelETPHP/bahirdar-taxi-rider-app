import { create } from 'zustand';

const useMaintenanceStore = create((set) => ({
  isMaintenanceMode: false,
  maintenanceData: null,

  setMaintenance: (enabled, data = null) => set({ 
    isMaintenanceMode: enabled, 
    maintenanceData: data 
  }),
}));

export default useMaintenanceStore;
