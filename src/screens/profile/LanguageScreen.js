import { Check, X } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import { changeLanguage } from '../../i18n';

export default function LanguageScreen({ navigation }) {
  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const { t, i18n } = useTranslation();

  const handleSelect = async (lang) => {
    await changeLanguage(lang);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.language')}</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.option, i18n.language === 'en' && styles.optionActive]}
          onPress={() => handleSelect('en')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, i18n.language === 'en' && styles.optionTextActive]}>English</Text>
          {i18n.language === 'en' && (
            <Check size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, i18n.language === 'am' && styles.optionActive]}
          onPress={() => handleSelect('am')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, i18n.language === 'am' && styles.optionTextActive]}>አማርኛ</Text>
          {i18n.language === 'am' && (
            <Check size={18} color={colors.primary} />
          )}
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
  content: { padding: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    marginBottom: 12,
  },
  optionActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  optionText: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: fontWeight.medium },
  optionTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
});
