import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import Avatar from '../../components/common/Avatar';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { changeLanguage } from '../../i18n';

const MENU_ITEMS = [
  { key: 'profile', icon: 'user', label: 'drawer.profile', screen: 'Profile' },
  { key: 'history', icon: 'clipboard-list', label: 'drawer.history', screen: 'RideHistory' },
  { key: 'notification', icon: 'bell', label: 'drawer.notification', screen: 'Notification' },
  { key: 'support', icon: 'comment', label: 'drawer.support', screen: 'Support' },
];

const SOCIAL_LINKS = [
  { key: 'facebook', icon: 'facebook-f', url: 'https://facebook.com' },
  { key: 'instagram', icon: 'instagram', url: 'https://instagram.com' },
  { key: 'twitter', icon: 'twitter', url: 'https://twitter.com' },
  { key: 'telegram', icon: 'telegram-plane', url: 'https://t.me' },
];

export default function DrawerMenu(props) {
  const { t, i18n } = useTranslation();
  const { user, phone, logout } = useAuthStore();

  const handleLanguageToggle = async () => {
    const next = i18n.language === 'en' ? 'am' : 'en';
    await changeLanguage(next);
  };

  const handleLogout = () => {
    Alert.alert(
      t('drawer.logout'),
      'Are you sure you want to log out?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            logout();
            // RootNavigator switches to AuthNav automatically when isAuthenticated → false
          },
        },
      ]
    );
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      {/* Profile section */}
      <View style={styles.profileSection}>
        <Avatar
          initials={user?.fullName?.slice(0, 2)?.toUpperCase() || '?'}
          size={64}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{user?.fullName || ''}</Text>
          <Text style={styles.userPhone}>+251 {phone.slice(1)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Menu items */}
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.menuItem}
          onPress={() => props.navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <FontAwesome5 name={item.icon} size={20} color={colors.textSecondary} solid style={styles.menuIcon} />
          <Text style={styles.menuLabel}>{t(item.label)}</Text>
        </TouchableOpacity>
      ))}

      {/* Language toggle */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={handleLanguageToggle}
        activeOpacity={0.7}
      >
        <FontAwesome5 name="globe" size={20} color={colors.textSecondary} solid style={styles.menuIcon} />
        <Text style={styles.menuLabel}>{t('drawer.language')}</Text>
        <View style={styles.langToggle}>
          <Text style={[styles.langOption, i18n.language === 'en' && styles.langActive]}>EN</Text>
          <Text style={styles.langSep}>|</Text>
          <Text style={[styles.langOption, i18n.language === 'am' && styles.langActive]}>አማ</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Logout */}
      <TouchableOpacity
        style={[styles.menuItem, styles.logoutItem]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <FontAwesome5 name="door-open" size={20} color={colors.error} solid style={styles.menuIcon} />
        <Text style={styles.logoutLabel}>{t('drawer.logout')}</Text>
      </TouchableOpacity>

      {/* Social media links */}
      <View style={styles.footer}>
        {SOCIAL_LINKS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.socialBtn}
            onPress={() => Linking.openURL(item.url)}
            activeOpacity={0.7}
          >
            <FontAwesome5 name={item.icon} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  userPhone: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  menuIcon: {
    width: 24,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  langOption: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  langSep: {
    color: colors.border,
    fontSize: fontSize.sm,
  },
  langActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  logoutItem: {},
  logoutLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 'auto',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  socialBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
