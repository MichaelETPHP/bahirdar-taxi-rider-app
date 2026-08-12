import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, FlatList,
  Animated, Easing, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { X, Bell, CheckCheck, ChevronDown } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { spacing, borderRadius } from '../../constants/layout';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
} from '../../services/notificationService';
import { getSocket } from '../../services/socketService';

const STAGGER_MS = 40;
const SKELETON_ROWS = 6;
const BODY_COLLAPSED_LINES = 2;

// "2h ago" / "Just now" — small enough not to warrant a shared util file.
function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Skeleton — mirrors the real row's shape (bell circle + title + body
// lines) so the loading state doesn't jump/reflow once real content lands.
function NotificationRowSkeleton() {
  const opacity = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.62, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.38, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={[styles.bellCircle, { backgroundColor: colors.border }]} />
      <View style={styles.cardBody}>
        <View style={styles.skeletonTitleLine} />
        <View style={styles.skeletonBodyLine} />
        <View style={[styles.skeletonBodyLine, { width: '60%' }]} />
      </View>
    </Animated.View>
  );
}

function NotificationRow({ item, index, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const pressScale = useRef(new Animated.Value(1)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;
  // Self-owned entrance animation instead of a parent-managed array indexed
  // by position — that positional approach breaks the moment a row is
  // inserted live (via the socket) rather than loaded all together, since
  // every index after the new one shifts and no longer matches its
  // original animated value. Each row now animates itself in once, the
  // first time it mounts (FlatList only mounts a row once per stable
  // `id` key, so this doesn't replay on re-renders like is_read toggling).
  const mountAnim = useRef(new Animated.Value(0)).current;
  // Captured once, at mount — `index` itself is intentionally NOT a
  // dependency below. If it were, every existing row's animation would
  // restart from 0 whenever a live insert shifted everyone's position by
  // one, causing the whole list to visibly re-fade-in on every new arrival.
  const initialIndex = useRef(index).current;

  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1,
      duration: 240,
      delay: initialIndex * STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pressIn = () => Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpen(item);
    setExpanded((prev) => {
      const next = !prev;
      Animated.timing(chevronRotate, {
        toValue: next ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
      return next;
    });
  };

  const rotateDeg = chevronRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Animated.View
      style={{
        opacity: mountAnim,
        transform: [
          { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          { scale: pressScale },
        ],
      }}
    >
      <View style={[styles.card, !item.is_read && styles.cardUnread]}>
        <View style={styles.bellCircle}>
          <Bell size={16} color={colors.primary} />
          {!item.is_read && <View style={styles.bellBadge} />}
        </View>

        <View style={styles.cardBody}>
          <Pressable
            onPress={toggleExpanded}
            onPressIn={pressIn}
            onPressOut={pressOut}
            style={styles.headingRow}
          >
            <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
              {item.title}
            </Text>
            <View style={styles.headingRight}>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              {!!item.body && (
                <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
                  <ChevronDown size={14} color={colors.textSecondary} />
                </Animated.View>
              )}
            </View>
          </Pressable>

          {!!item.body && (
            <Text style={styles.cardBodyText} numberOfLines={expanded ? undefined : BODY_COLLAPSED_LINES}>
              {item.body}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function NotificationScreen({ navigation }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getNotifications({ limit: 50 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setNotifications(list);
    } catch (_) {
      // Leave whatever was already on screen — a failed refresh shouldn't
      // wipe out a list the rider was already looking at.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetches every time this screen gains focus — not just on first mount.
  // React Navigation keeps screens mounted in the background stack, so a
  // plain useEffect(() => load(), []) only ever ran once; navigating away
  // and back showed stale data until the rider manually pulled to refresh.
  // `loading` is only ever set true by its initial useState — this never
  // re-triggers the skeleton on refocus, so returning to an already-seen
  // list updates silently instead of flashing a loading state each time.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live insert + removal — an admin sending or deleting a broadcast only
  // reaches an already-open screen through these socket events;
  // refetch-on-focus alone can't help here since the rider never navigates
  // away and back while watching it happen live.
  useFocusEffect(
    useCallback(() => {
      const socket = getSocket();
      if (!socket) return undefined;

      const handleNew = (row) => {
        if (!row?.id) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNotifications((prev) => (
          prev.some((n) => n.id === row.id) ? prev : [row, ...prev]
        ));
      };

      // campaign_id (embedded in each row's `data` at send time) is what
      // ties a deleted broadcast to the rows currently on screen.
      const handleDeleted = ({ campaign_ids } = {}) => {
        if (!Array.isArray(campaign_ids) || campaign_ids.length === 0) return;
        setNotifications((prev) => prev.filter((n) => !campaign_ids.includes(n.data?.campaign_id)));
      };

      socket.on('notification:new', handleNew);
      socket.on('notification:deleted', handleDeleted);
      return () => {
        socket.off('notification:new', handleNew);
        socket.off('notification:deleted', handleDeleted);
      };
    }, []),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRowOpen = (item) => {
    if (item.is_read) return;
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    markNotificationRead(item.id).catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('drawer.notification')}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <CheckCheck size={14} color={colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <NotificationRowSkeleton key={i} />
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Bell size={40} color={colors.border} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyBody}>Trip updates and announcements will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item, index }) => (
            <NotificationRow
              item={item}
              index={index}
              onOpen={handleRowOpen}
            />
          )}
        />
      )}
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
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: 8 },
  emptyBody: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardUnread: {
    borderColor: 'rgba(47, 112, 199, 0.22)',
  },
  // Blue, low-opacity, simple — same tint system used for the swipe-control
  // states elsewhere in this app, just applied to a small round icon here.
  bellCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(47, 112, 199, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bellBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  cardBody: { flex: 1, minWidth: 0 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  time: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  cardBodyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  skeletonTitleLine: {
    height: 13,
    width: '50%',
    borderRadius: 6,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  skeletonBodyLine: {
    height: 10,
    width: '90%',
    borderRadius: 5,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
});
