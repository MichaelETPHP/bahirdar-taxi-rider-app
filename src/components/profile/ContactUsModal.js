import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, Linking } from 'react-native';
import { X, Phone, Mail, ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

const SUPPORT_PHONE_DISPLAY = '+251 916 182 957';
const SUPPORT_PHONE_DIAL = '+251916182957';
const SUPPORT_EMAIL = 'info@gebetatech.com';

const CONTACTS = [
  {
    key: 'phone',
    icon: Phone,
    label: 'Call us',
    value: SUPPORT_PHONE_DISPLAY,
    action: () => Linking.openURL(`tel:${SUPPORT_PHONE_DIAL}`),
  },
  {
    key: 'email',
    icon: Mail,
    label: 'Email us',
    value: SUPPORT_EMAIL,
    action: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
  },
];

// Same bottom-sheet chrome as AboutWalletModal (handle, header, close button)
// — one consistent popup language across the app rather than a one-off style
// just for this screen.
export default function ContactUsModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Contact Us</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>We're here to help — reach out any time.</Text>

          {CONTACTS.map(({ key, icon: Icon, label, value, action }) => (
            <Pressable
              key={key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                action();
              }}
            >
              <View style={styles.iconWrap}>
                <Icon size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
              <ExternalLink size={15} color={colors.textSecondary} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  rowPressed: {
    backgroundColor: colors.backgroundAlt,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
