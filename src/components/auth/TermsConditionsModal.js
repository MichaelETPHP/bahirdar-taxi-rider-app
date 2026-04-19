import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TermsConditionsModal({ visible, onClose }) {
  const { t } = useTranslation();

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('termsModal.title')}</Text>
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.7}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <FontAwesome5 name="times" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.paragraph}>{t('termsModal.intro')}</Text>
            <Text style={styles.subtitle}>{t('termsModal.serviceTitle')}</Text>
            <Text style={styles.paragraph}>{t('termsModal.serviceContent')}</Text>
            <Text style={styles.subtitle}>{t('termsModal.userTitle')}</Text>
            <Text style={styles.paragraph}>{t('termsModal.userContent')}</Text>
            <Text style={styles.subtitle}>{t('termsModal.privacyTitle')}</Text>
            <Text style={styles.paragraph}>{t('termsModal.privacyContent')}</Text>
            <Text style={styles.subtitle}>{t('termsModal.contactTitle')}</Text>
            <Text style={styles.paragraph}>{t('termsModal.contactContent')}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: 24,
    paddingBottom: 24,
    ...shadow.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  subtitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'left',
  },
  closeButton: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
