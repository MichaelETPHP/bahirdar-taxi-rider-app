import { Alert, Linking, Share } from 'react-native';
import { secureStorage } from '../lib/secureStorage';

const CONTACT_KEY = 'rider_emergency_contact';
export async function getEmergencyContact() {
  const stored = await secureStorage.getItem(CONTACT_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch (_) { return null; }
}
export async function saveEmergencyContact(name, phone) {
  const normalized = String(phone).replace(/[\s()-]/g, '');
  if (!name.trim() || !/^\+?\d{7,15}$/.test(normalized)) throw new Error('Enter a name and valid phone number.');
  await secureStorage.setItem(CONTACT_KEY, JSON.stringify({ name: name.trim().slice(0, 100), phone: normalized }));
}
export const clearEmergencyContact = () => secureStorage.removeItem(CONTACT_KEY);

export async function openSafetyDialer(phone = '8840') {
  try { await Linking.openURL(`tel:${phone}`); }
  catch (_) { Alert.alert('Unable to open dialer', `Please call ${phone} manually.`); }
}
export async function showSafetyActions() {
  try {
    const contact = await getEmergencyContact();
    const actions = [{ text: 'Call 8840', onPress: () => void openSafetyDialer() }];
    if (contact) {
      actions.push({ text: `Call ${contact.name}`, onPress: () => void openSafetyDialer(contact.phone) });
      actions.push({ text: 'Share trip details', onPress: async () => {
        try {
          const { default: useRideStore } = await import('../store/rideStore');
          const { tripId, tripData } = useRideStore.getState();
          const message = `I need help. Trip: ${tripId && !String(tripId).startsWith('pending-') ? tripId : 'not confirmed'}\nPickup: ${tripData?.pickup_address || 'Unknown'}\nDestination: ${tripData?.dropoff_address || 'Unknown'}`;
          await Share.share({ message });
        } catch (_) { Alert.alert('Unable to share', 'Please call your emergency contact directly.'); }
      } });
    }
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Safety assistance', contact ? contact.name : 'No emergency contact saved', actions);
  } catch (_) { void openSafetyDialer(); }
}
