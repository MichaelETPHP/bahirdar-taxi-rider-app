import React, { useEffect, useState } from 'react';
import { Alert, View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { X, Save, Trash2 } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { getEmergencyContact, saveEmergencyContact, clearEmergencyContact } from '../../services/emergencyService';

export default function EmergencyContactScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    getEmergencyContact().then(contact => {
      if (active) { setName(contact?.name || ''); setPhone(contact?.phone || ''); }
    }).catch(() => Alert.alert('Unable to load contact', 'Please try again.'))
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    setBusy(true);
    try { await saveEmergencyContact(name, phone); navigation.goBack(); }
    catch (error) { Alert.alert('Contact not saved', error.message); }
    finally { setBusy(false); }
  };
  const remove = () => Alert.alert('Remove emergency contact?', name, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      setBusy(true);
      try { await clearEmergencyContact(); setName(''); setPhone(''); }
      catch (_) { Alert.alert('Contact not removed', 'Please try again.'); }
      finally { setBusy(false); }
    } },
  ]);
  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.emergencyContact')}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Contact name</Text>
        <TextInput accessibilityLabel="Emergency contact name" style={styles.input} value={name} onChangeText={setName} maxLength={100} editable={!busy} autoComplete="name" />
        <Text style={styles.label}>Phone number</Text>
        <TextInput accessibilityLabel="Emergency contact phone number" style={styles.input} value={phone} onChangeText={setPhone} maxLength={24} editable={!busy} keyboardType="phone-pad" autoComplete="tel" />
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save} style={[styles.saveButton, busy && { opacity: 0.5 }]}>
          <Save size={20} color={colors.white} /><Text style={styles.saveText}>{busy ? 'Please wait' : 'Save contact'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy || !name} onPress={remove} style={styles.removeButton}>
          <Trash2 size={20} color={colors.error} /><Text style={{ color: colors.error }}>Remove contact</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  content: { flex: 1, padding: 20, gap: 12 },
  label: { color: colors.textPrimary, fontSize: fontSize.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, minHeight: 48, padding: 12, color: colors.textPrimary, fontSize: fontSize.md },
  saveButton: { minHeight: 48, backgroundColor: colors.primary, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  saveText: { color: colors.white, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  removeButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  emptyText: { fontSize: fontSize.md, color: colors.error },
});
