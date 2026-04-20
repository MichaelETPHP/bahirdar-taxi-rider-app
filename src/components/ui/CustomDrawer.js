import React, { useRef, useEffect, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import {
  User,
  ClipboardList,
  Bell,
  MessageCircle,
  LogOut,
  Globe,
  CircleCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FacebookIcon, InstagramIcon, TiktokIcon, TelegramIcon } from '../common/BrandIcons';
import Avatar from '../common/Avatar';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilyBold, fontFamilySemiBold, fontFamilyRegular } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { changeLanguage } from '../../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.ceil(SCREEN_WIDTH * 0.78) + 2;

const MENU_ITEMS = [
  { key: 'profile', labelKey: 'drawer.profile', screen: 'Profile' },
  { key: 'history', labelKey: 'drawer.history', screen: 'RideHistory' },
  { key: 'notification', labelKey: 'drawer.notification', screen: 'Notification' },
  { key: 'support', labelKey: 'drawer.support', screen: 'Support' },
];

const SOCIAL_LINKS = [
  { key: 'facebook', url: 'https://facebook.com' },
  { key: 'instagram', url: 'https://instagram.com' },
  { key: 'telegram', url: 'https://t.me' },
];

const ICON_MAP = {
  profile: User,
  history: ClipboardList,
  notification: Bell,
  support: MessageCircle,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  telegram: TelegramIcon,
};

function CustomDrawer({ visible, onClose, navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, phone, logout } = useAuthStore();
  const avatarUrl = user?.avatarUrl || user?.avatar_url || null;

  const displayPhone = phone
    ? (phone.startsWith('+251') ? phone : `+251 ${phone.slice(1)}`)
    : 'Loading...';

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Open drawer animation
  const animateOpen = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  // Close drawer animation
  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  // Handle drawer open/close trigger
  useEffect(() => {
    if (visible) {
      animateOpen();
    } else {
      animateClose();
    }
  }, [visible, animateOpen, animateClose]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      slideAnim.stopAnimation();
      fadeAnim.stopAnimation();
    };
  }, [slideAnim, fadeAnim]);

  // Pan responder for swipe-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
      onPanResponderGrant: () => {
        slideAnim.stopAnimation();
      },
      onPanResponderMove: (_, { dx }) => {
        const nextX = Math.min(0, Math.max(-DRAWER_WIDTH, dx));
        slideAnim.setValue(nextX);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const shouldClose = dx < -70 || vx < -0.8;
        if (shouldClose) {
          if (!isClosingRef.current) {
            isClosingRef.current = true;
            animateClose();
            setTimeout(() => {
              onClose?.();
              isClosingRef.current = false;
            }, 220);
          }
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

  // Close drawer when overlay is tapped
  const handleOverlayPress = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    animateClose();
    setTimeout(() => {
      onClose?.();
      isClosingRef.current = false;
    }, 220);
  }, [animateClose, onClose]);

  // Navigate to screen and close drawer
  const handleNavigate = useCallback((screen) => {
    if (isClosingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isClosingRef.current = true;
    animateClose();
    setTimeout(() => {
      try {
        navigation.navigate(screen);
      } catch (e) {
        console.warn('Navigation error:', e);
      } finally {
        onClose?.();
        isClosingRef.current = false;
      }
    }, 220);
  }, [animateClose, navigation, onClose]);

  const handleLanguageToggle = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = i18n.language === 'en' ? 'am' : 'en';
    await changeLanguage(next);
  }, [i18n.language]);

  const handleLogout = useCallback(() => {
    Alert.alert(t('drawer.logout'), 'Are you sure you want to log out?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          logout();
          handleOverlayPress();
        },
      },
    ]);
  }, [t, logout, handleOverlayPress]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Overlay - tap to close entire drawer */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
          },
        ]}
        pointerEvents="none"
      />

      {/* Overlay tap area - catches all touches outside drawer */}
      <View
        style={styles.overlayTapArea}
        onTouchEnd={handleOverlayPress}
        pointerEvents="auto"
      />

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
        {...panResponder.panHandlers}
        pointerEvents="auto"
        collapsable={false}
      >
        {/* Profile section */}
        <View style={[styles.profileSection, { paddingTop: insets.top + 14 }]}>
          <Svg
            pointerEvents="none"
            width={DRAWER_WIDTH}
            height={220}
            style={styles.profileGradient}
          >
            <Defs>
              <LinearGradient id="profileGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
                <Stop offset="0.55" stopColor={colors.primary} stopOpacity="1" />
                <Stop offset="0.85" stopColor={colors.primaryDark} stopOpacity="1" />
                <Stop offset="1" stopColor="#0a3d30" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={DRAWER_WIDTH} height={220} fill="url(#profileGradient)" />
          </Svg>

          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Avatar
              initials={user?.fullName?.slice(0, 2)?.toUpperCase() || '?'}
              size={64}
              style={styles.avatarDefault}
            />
          )}

          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{user?.fullName || ''}</Text>
              {user?.isVerified !== false && (
                <CircleCheck size={14} color={colors.verified} />
              )}
            </View>
            <Text style={styles.userPhone} numberOfLines={1}>
              {displayPhone}
            </Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => {
            const IconComponent = ICON_MAP[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.menuItem}
                onPress={() => handleNavigate(item.screen)}
                activeOpacity={0.7}
              >
                {IconComponent && <IconComponent size={20} color={colors.textSecondary} />}
                <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Language toggle */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLanguageToggle}
            activeOpacity={0.7}
          >
            <Globe size={20} color={colors.textSecondary} />
            <Text style={styles.menuLabel}>{t('drawer.language')}</Text>
            <View style={styles.langToggle}>
              <Text
                style={[
                  styles.langOption,
                  i18n.language === 'en' && styles.langActive,
                ]}
              >
                EN
              </Text>
              <Text style={styles.langSep}>|</Text>
              <Text
                style={[
                  styles.langOption,
                  i18n.language === 'am' && styles.langActive,
                ]}
              >
                አማ
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Logout */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={20} color={colors.error} />
            <Text style={styles.menuLogout}>{t('drawer.logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Social media footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {SOCIAL_LINKS.map((item) => {
            const IconComponent = ICON_MAP[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.socialBtn}
                onPress={() => Linking.openURL(item.url)}
                activeOpacity={0.7}
              >
                {IconComponent && <IconComponent size={17} color={colors.textPrimary || '#000'} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(CustomDrawer);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  overlayTapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 100,
    backgroundColor: colors.white,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
    flexDirection: 'column',
  },
  profileSection: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 28,
    minHeight: 164,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(255,255,255,0.14)',
    zIndex: 1,
  },
  avatarDefault: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 1,
  },
  userInfo: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  userName: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    fontFamily: fontFamilyBold,
    color: colors.white,
  },
  userPhone: {
    fontSize: fontSize.xl,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: fontWeight.regular,
    fontFamily: fontFamilyRegular,
  },
  menuContainer: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 18,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    fontWeight: fontWeight.regular,
    fontFamily: fontFamilyRegular,
  },
  menuLogout: {
    flex: 1,
    fontSize: fontSize.xl,
    color: colors.error,
    fontWeight: fontWeight.regular,
    fontFamily: fontFamilyRegular,
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
    fontWeight: fontWeight.regular,
    fontFamily: fontFamilyRegular,
  },
  langActive: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
  },
  langSep: {
    color: colors.border,
    fontSize: fontSize.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  socialBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
});
