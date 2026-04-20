import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { X, HelpCircle, Phone, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';

const SUPPORT_ITEMS = [
  { icon: 'faq', iconComp: HelpCircle, labelKey: 'support.faq' },
  { icon: 'contact', iconComp: Phone, labelKey: 'support.contact' },
  { icon: 'issue', iconComp: AlertTriangle, labelKey: 'support.reportIssue' },
];

export default function SupportScreen({ navigation }) {
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
        <Text style={styles.title}>{t('support.title')}</Text>
      </View>

      <View style={styles.content}>
        {SUPPORT_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.labelKey}
            style={styles.card}
            onPress={() => Alert.alert(t('common.comingSoon'))}
            activeOpacity={0.7}
          >
            {React.createElement(item.iconComp, { size: 22, color: colors.primary, style: styles.icon })}
            <Text style={styles.label}>{t(item.labelKey)}</Text>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  content: { padding: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 16,
    gap: 14,
    ...shadow.sm,
  },
  icon: { width: 28 },
  label: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
});
