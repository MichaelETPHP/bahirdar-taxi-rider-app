import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { X, MessageSquare, Pencil, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { WhatsappIcon } from '../common/BrandIcons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import { formatPhoneDisplay } from '../../utils/formatters';

export default function SendCodeSheet({
  visible,
  phone,
  isEthiopia = true,
  onClose,
  onSendSms,
  onSendWhatsapp,
  onEditPhone,
}) {
  const { t } = useTranslation();

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

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('auth.sendTo')}</Text>
              <Text style={styles.phone}>{isEthiopia ? formatPhoneDisplay(phone) : phone}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {!isEthiopia && (
            <Text style={styles.hint}>{t('auth.whatsappOnlyHint')}</Text>
          )}

          <View style={styles.optionList}>
            {isEthiopia && (
              <TouchableOpacity style={styles.option} onPress={onSendSms} activeOpacity={0.75}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                  <MessageSquare size={20} color={colors.primary} />
                </View>
                <Text style={styles.optionLabel}>{t('auth.sendCodeSms')}</Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.option} onPress={onSendWhatsapp} activeOpacity={0.75}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}>
                <WhatsappIcon size={20} />
              </View>
              <Text style={styles.optionLabel}>{t('auth.sendCodeWhatsapp')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={onEditPhone} activeOpacity={0.75}>
              <View style={[styles.optionIcon, { backgroundColor: colors.backgroundAlt }]}>
                <Pencil size={20} color={colors.textSecondary} />
              </View>
              <Text style={styles.optionLabel}>{t('auth.editPhoneNumber')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  phone: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  optionList: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
