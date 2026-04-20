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
import {
  User,
  History,
  Bell,
  MessageCircle,
  Globe,
  LogOut,
  Users,
  Share2,
  Music,
  Send,
  Settings,
} from 'lucide-react-native';
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
  { key: 'facebook', url: 'https://facebook.com' },
  { key: 'instagram', url: 'https://instagram.com' },
  { key: 'twitter', url: 'https://twitter.com' },
  { key: 'telegram', url: 'https://t.me' },
];

const SOCIAL_ICON_MAP = {
  facebook: Users,
  instagram: Share2,
  twitter: Send,
  telegram: Send,
};

export default function DrawerMenu(props) {
  const { t, i18n } = useTranslation();
  const { user, phone, logout } = useAuthStore();

  // Format phone number correctly
  const formatPhoneNumber = (phoneStr) => {
    if (!phoneStr) return 'No phone';
    // If already international format, return as is
    if (phoneStr.startsWith('+251')) return phoneStr;
    // If local format (09XXXXXXXX or 0911111111), convert to international
    if (phoneStr.startsWith('0')) return `+251 ${phoneStr.slice(1)}`;
    // Otherwise return as is
    return phoneStr;
  };

  const displayPhone = formatPhoneNumber(phone);

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
          <Text style={styles.userPhone}>{displayPhone}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Menu items */}
      {MENU_ITEMS.map((item) => {
        const iconProps = { size: 20, color: colors.textSecondary, style: styles.menuIcon };
        const IconComponent = {
          'profile': User,
          'history': History,
          'notification': Bell,
          'support': MessageCircle,
        }[item.key] || User;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.menuItem}
            onPress={() => props.navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <IconComponent {...iconProps} />
            <Text style={styles.menuLabel}>{t(item.label)}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Language toggle */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={handleLanguageToggle}
        activeOpacity={0.7}
      >
        <Globe size={20} color={colors.textSecondary} style={styles.menuIcon} />
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
        <LogOut size={20} color={colors.error} style={styles.menuIcon} />
        <Text style={styles.logoutLabel}>{t('drawer.logout')}</Text>
      </TouchableOpacity>

      {/* Social media links */}
      <View style={styles.footer}>
        {SOCIAL_LINKS.map((item) => {
          const Icon = SOCIAL_ICON_MAP[item.key] || Send;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.socialBtn}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.7}
            >
              <Icon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
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
