import { env } from '../config/env';

export const checkMaintenanceStatus = async () => {
  try {
    // Health check endpoint usually on the base URL or /api/v1/maintenance/status
    const baseUrl = env.apiUrl.includes('/api/v1') 
      ? env.apiUrl.replace('/api/v1', '') 
      : env.apiUrl;
      
    const response = await fetch(`${baseUrl}/api/v1/maintenance/status`);
    if (!response.ok) return { maintenance: false };
    
    return await response.json();
  } catch (error) {
    console.error('Maintenance check failed:', error);
    return { maintenance: false };
  }
};
