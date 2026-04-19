import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  PanResponder,
  Alert,
  Linking,
  Image,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import Avatar from '../common/Avatar';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { changeLanguage } from '../../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Panel is 1–2px wider than layout math so the curved edge overlaps the dim overlay and removes the white hairline. */
const DRAWER_PANEL_WIDTH = Math.ceil(SCREEN_WIDTH * 0.78) + 2;

const MENU_ITEMS = [
  { key: 'profile', icon: 'user', labelKey: 'drawer.profile', screen: 'Profile' },
  { key: 'history', icon: 'clipboard-list', labelKey: 'drawer.history', screen: 'RideHistory' },
  { key: 'notification', icon: 'bell', labelKey: 'drawer.notification', screen: 'Notification' },
  { key: 'support', icon: 'comment', labelKey: 'drawer.support', screen: 'Support' },
];

const SOCIAL_LINKS = [
  { key: 'facebook', icon: 'facebook-f', url: 'https://facebook.com' },
  { key: 'instagram', icon: 'instagram', url: 'https://instagram.com' },
  { key: 'tiktok', icon: 'tiktok', url: 'https://www.tiktok.com' },
  { key: 'telegram', icon: 'telegram-plane', url: 'https://t.me' },
];

export default function CustomDrawer({ visible, onClose, navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, phone, logout } = useAuthStore();
  const avatarUrl = user?.avatarUrl || user?.avatar_url || null;
  const slideAnim = useRef(new Animated.Value(-DRAWER_PANEL_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const dragStartX = useRef(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_PANEL_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
      onPanResponderGrant: () => {
        slideAnim.stopAnimation((v) => {
          dragStartX.current = v;
        });
      },
      onPanResponderMove: (_, { dx }) => {
        const nextX = Math.min(0, Math.max(-DRAWER_PANEL_WIDTH, dragStartX.current + dx));
        slideAnim.setValue(nextX);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const shouldClose = dx < -70 || vx < -0.8;
        if (shouldClose) {
          Animated.parallel([
            Animated.timing(slideAnim, {
              toValue: -DRAWER_PANEL_WIDTH,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(overlayAnim, {
              toValue: 0,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start(onClose);
          return;
        }
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!visible && slideAnim._value === -DRAWER_PANEL_WIDTH) return null;

  const handleNavigate = (screen) => {
    onClose();
    setTimeout(() => navigation.navigate(screen), 250);
  };

  const handleLanguageToggle = async () => {
    const next = i18n.language === 'en' ? 'am' : 'en';
    await changeLanguage(next);
  };


  const handleLogout = () => {
    Alert.alert(t('drawer.logout'), 'Are you sure you want to log out?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          logout();
          onClose();
          // RootNavigator switches to AuthNav automatically when isAuthenticated → false
        },
      },
    ]);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.drawerOverlay]} pointerEvents="box-none">
      {/* Dark overlay */}
      <Pressable style={styles.overlayTapArea} onPress={onClose}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
          ]}
        />
      </Pressable>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateX: slideAnim }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.content}>
          {/* Profile section — emerald gradient (lighter; no heavy black) */}
          <View style={[styles.profileSection, { paddingTop: insets.top + 14 }]}>
            <Svg
              pointerEvents="none"
              width={DRAWER_PANEL_WIDTH}
              height={220}
              style={styles.profileGradientSvg}
            >
              <Defs>
                <LinearGradient id="drawerProfileGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
                  <Stop offset="0.55" stopColor={colors.primary} stopOpacity="1" />
                  <Stop offset="0.85" stopColor={colors.primaryDark} stopOpacity="1" />
                  <Stop offset="1" stopColor="#0a3d30" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={DRAWER_PANEL_WIDTH} height={220} fill="url(#drawerProfileGrad)" />
            </Svg>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Avatar
                initials={user?.fullName?.slice(0, 2)?.toUpperCase() || '?'}
                size={64}
                style={styles.profileAvatar}
              />
            )}
            <View style={styles.profileInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{user?.fullName || ''}</Text>
                {(user?.isVerified !== false) && (
                  <FontAwesome5 name="check-circle" size={14} color={colors.verified} solid style={styles.verifiedBadge} />
                )}
              </View>
              <Text style={styles.userPhone}>
                {phone || 'XXXXXXXXX'}
              </Text>
              </View>
            </View>
          

          {/* Navigation items */}
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuItem}
              onPress={() => handleNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <FontAwesome5 name={item.icon} size={16} color={colors.textSecondary} solid style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
            </TouchableOpacity>
          ))}

          {/* Language toggle */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLanguageToggle}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="globe" size={16} color={colors.textSecondary} solid style={styles.menuIcon} />
            <Text style={styles.menuLabel}>{t('drawer.language')}</Text>
            <View style={styles.langToggle}>
              <Text style={[styles.langOption, i18n.language === 'en' && styles.langActive]}>EN</Text>
              <Text style={styles.langSep}>|</Text>
              <Text style={[styles.langOption, i18n.language === 'am' && styles.langActive]}>አማ</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
            <FontAwesome5 name="door-open" size={16} color={colors.error} solid style={styles.menuIcon} />
            <Text style={styles.logoutLabel}>{t('drawer.logout')}</Text>
          </TouchableOpacity>

          {/* Tap blank area inside drawer to close */}
          <TouchableOpacity style={styles.emptyCloseArea} onPress={onClose} activeOpacity={1} />
        </View>

        {/* Social media links */}
        <View style={styles.footer}>
          {SOCIAL_LINKS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.socialBtn}
              onPress={() => Linking.openURL(item.url)}
              activeOpacity={0.7}
            >
              <FontAwesome5 name={item.icon} size={13} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerOverlay: {
    zIndex: 9999,
    elevation: 9999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  overlayTapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_PANEL_WIDTH,
    flexDirection: 'column',
    backgroundColor: colors.white,
    paddingHorizontal: 0,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
  },
  content: {
    flex: 1,
    zIndex: 0,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 28,
    overflow: 'hidden',
    gap: 12,
    position: 'relative',
    minHeight: 164,
  },
  profileGradientSvg: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(255,255,255,0.14)',
    zIndex: 1,
  },
  profileAvatar: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 1,
  },
  profileInfo: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  verifiedBadge: {
    marginTop: 2,
  },
  userPhone: {
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
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
  langSep: { color: colors.border },
  langActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
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
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(0,0,0,0.04)',
    zIndex: 1,
  },
  emptyCloseArea: {
    flex: 1,
    minHeight: 48,
  },
  socialBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
