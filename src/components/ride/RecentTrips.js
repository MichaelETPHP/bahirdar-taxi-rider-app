import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, ActivityIndicator, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MapPin, ChevronRight, Trash2, Clock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import { getSearchHistory, removeFromHistory } from '../../services/searchHistoryService';
import { extractNeighborhoodName } from '../../services/addressParserService';
import { getTripHistory } from '../../services/tripService';
import useAuthStore from '../../store/authStore';
import useTripHistoryStore from '../../store/tripHistoryStore';

const MAX_ITEMS = 4;
const STAGGER_MS = 45;
const SWIPE_CLEAR_DISTANCE = 90;
const SWIPE_CLEAR_VELOCITY = 0.5;

function toEntry(type, payload) {
  const readableName = type === 'search'
    ? extractNeighborhoodName(payload.address, payload.lat, payload.lng)
    : null;
  const primaryText = type === 'trip'
    ? payload.destination || 'Past trip'
    : (payload.name || readableName || 'Past search');
  const secondaryText = type === 'trip'
    ? payload.pickup || 'Trip history'
    : payload.address;
  return { type, payload, primaryText, secondaryText };
}

function RecentRow({ entry, onPress, onDismiss, index, mountAnim }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  // Collapses the row's own space once it's swiped away, so the item below
  // slides up smoothly instead of snapping into the gap. Only animatable
  // once we know the real rendered height (captured on first layout) — the
  // `measured` flag forces the one re-render needed to switch the `height`
  // style from `undefined` (natural size) over to this Animated.Value.
  const rowHeight = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);
  const hasMeasured = useRef(false);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
  };

  const collapseAndRemove = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // rowOpacity also drives the backdrop below (not just the row content),
    // so the red tint + trash icons fade out together with the row instead
    // of one lingering behind the other. Longer than the fly-out itself so
    // it reads as a deliberate "erase," not an abrupt cut.
    Animated.parallel([
      Animated.timing(rowOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rowHeight, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => onDismiss(entry));
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        const cleared = Math.abs(gs.dx) > SWIPE_CLEAR_DISTANCE || Math.abs(gs.vx) > SWIPE_CLEAR_VELOCITY;
        if (cleared) {
          const direction = gs.dx >= 0 ? 1 : -1;
          // A fixed-duration exit, not a spring: a spring's completion
          // callback only fires once it fully settles near zero velocity,
          // which with a large toValue can take a second or more even
          // though the row is visually off-screen almost immediately —
          // that gap is exactly what left the red backdrop flashing after
          // the row had already flown away. Timing fires deterministically
          // at a fixed duration, so the row, its fade, and the backdrop's
          // fade all finish together, fast.
          Animated.timing(translateX, {
            toValue: direction * 600,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(collapseAndRemove);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            velocity: gs.vx,
            useNativeDriver: true,
            friction: 7,
            tension: 220,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 220 }).start();
      },
    })
  ).current;

  const onLayout = (e) => {
    if (!hasMeasured.current) {
      hasMeasured.current = true;
      rowHeight.setValue(e.nativeEvent.layout.height);
      setMeasured(true);
    }
  };

  return (
    // Height is JS-driven (native driver doesn't support it) and must live
    // on its own node — mixing it with a native-driven style (opacity,
    // transform) on the same Animated.View throws
    // "Style property 'height' is not supported by native animated module".
    <Animated.View
      style={{
        height: measured ? rowHeight : undefined,
        overflow: 'hidden',
      }}
    >
      {/* Revealed behind the row as it's dragged — confirms "this will clear".
          A single centered icon would sit under the opaque row for most of
          the drag (the exposed sliver is at the edge you're dragging away
          from, not the row's center) — one icon per edge means whichever
          side gets revealed always has a trash icon sitting inside it.
          Bound to rowOpacity so it fades out with the row on dismiss instead
          of staying fully red while only the content above it disappears. */}
      <Animated.View style={[styles.clearBackdrop, { opacity: rowOpacity }]} pointerEvents="none">
        <Trash2 size={16} color="#EF4444" />
        <Trash2 size={16} color="#EF4444" />
      </Animated.View>
      <Animated.View
        onLayout={onLayout}
        style={{
          opacity: Animated.multiply(mountAnim, rowOpacity),
          transform: [
            { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { translateX },
            { scale: pressScale },
          ],
        }}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={[styles.tripItem, index > 0 && styles.tripItemBorder, styles.tripItemSurface]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.tripIcon}>
            <MapPin size={18} color={colors.primary} />
          </View>
          <View style={styles.tripContent}>
            <Text style={styles.tripName} numberOfLines={1}>{entry.primaryText}</Text>
            {!!entry.secondaryText && <Text style={styles.tripAddress} numberOfLines={1}>{entry.secondaryText}</Text>}
          </View>
          <ChevronRight size={16} color={colors.border} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default function RecentTrips({ onSelectPlace }) {
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountAnims = useRef([]).current;

  useEffect(() => {
    loadHistory();
  }, [token, userId]);

  const loadHistory = async () => {
    try {
      // Cached trip history skips both the loading spinner and the network
      // call entirely — only search history (already local/instant) and,
      // when stale, a background trip-history refetch add real latency.
      const cacheFresh = useTripHistoryStore.getState().isFresh(userId);
      setLoading(!cacheFresh);

      const fetchTrips = cacheFresh
        ? Promise.resolve(useTripHistoryStore.getState().recentTrips)
        : token
          ? getTripHistory(token, { limit: MAX_ITEMS })
              .then((trips) => {
                useTripHistoryStore.getState().setRecentTrips(trips, userId);
                return trips;
              })
              .catch(() => [])
          : Promise.resolve([]);

      const [searches, trips] = await Promise.all([getSearchHistory(), fetchTrips]);
      const dismissedTripIds = useTripHistoryStore.getState().dismissedTripIds;

      const searchEntries = Array.isArray(searches)
        ? searches.slice(0, MAX_ITEMS).map((p) => toEntry('search', p))
        : [];
      const tripEntries = Array.isArray(trips)
        ? trips.filter((p) => !dismissedTripIds.includes(p.id)).slice(0, MAX_ITEMS).map((p) => toEntry('trip', p))
        : [];

      // Prioritize searches (closer to "where do I want to go" intent);
      // fill any remaining slots with trip history so the list stays full.
      // Dedup across the two sources by display name — a place you both
      // searched for and later took a trip to would otherwise show as two
      // separate rows even though each source list is already deduped on
      // its own.
      const seenNames = new Set();
      const combined = [];
      for (const entry of [...searchEntries, ...tripEntries]) {
        const key = entry.primaryText.trim().toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        combined.push(entry);
        if (combined.length >= MAX_ITEMS) break;
      }
      setItems(combined);

      mountAnims.length = 0;
      combined.forEach(() => mountAnims.push(new Animated.Value(0)));
      Animated.stagger(
        STAGGER_MS,
        mountAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start();
    } catch (err) {
      console.error('[RecentTrips] Failed to load history:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (entry) => {
    setItems((prev) => prev.filter((it) => it !== entry));
    if (entry.type === 'search') {
      removeFromHistory(entry.payload.placeId);
    } else if (entry.type === 'trip' && entry.payload?.id) {
      useTripHistoryStore.getState().dismissTrip(entry.payload.id);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.emptyState]}>
        <Clock size={18} color={colors.textSecondary} />
        <Text style={styles.emptyText}>No recent trips or searches yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.map((entry, index) => (
        <RecentRow
          key={`${entry.type}-${entry.payload?.placeId || entry.payload?.id || index}`}
          entry={entry}
          index={index}
          mountAnim={mountAnims[index] || new Animated.Value(1)}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelectPlace?.(entry);
          }}
          onDismiss={handleDismiss}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // 16px matches LocationBar's inner paddingHorizontal, so the icon
    // column here lines up with the search pill's icon above it.
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  clearBackdrop: {
    // Low-opacity red tint, not a solid fill — same "light color, not
    // alarming" tint system used for the delete/complete state elsewhere
    // in the app, just enough to read as "this clears" without shouting.
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  tripItemSurface: {
    backgroundColor: colors.white,
  },
  tripItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tripIcon: {
    // Bare icon, no background box — matches LocationBar's MapPin exactly
    // (same 18px icon, no wrapper), so the text column after it lines up
    // with the search pill's text above.
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripContent: {
    flex: 1,
  },
  tripName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: 'rgba(13, 27, 30, 0.78)',
    marginBottom: 2,
  },
  tripAddress: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
