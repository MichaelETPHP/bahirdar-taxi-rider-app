import { apiRequest } from '../lib/apiClient';

export async function getActivePromotions() {
  return apiRequest('GET', '/promotions/active?target=rider');
}
