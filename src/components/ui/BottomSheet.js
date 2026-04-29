import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Pressable,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_HEIGHT = 220;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

export default function BottomSheet({
  children,
  header,
  footer,
  minHeight = MIN_HEIGHT,
  maxHeight = MAX_HEIGHT,
  initialExpanded = false,
  lockExpanded = false,
  onExpandedChange,
  onDragStart,
  onDragEnd,
  style,
  scrollEnabled = true,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // The sheet will be fixed at maxHeight. We use translateY to hide/show it.
  // translateY = 0 means fully expanded (maxHeight).
  // translateY = maxHeight - minHeight means collapsed (minHeight).
  const COLLAPSED_Y = maxHeight - minHeight;
  const initialY = initialExpanded || lockExpanded ? 0 : COLLAPSED_Y;

  const sheetAnim = useRef(new Animated.Value(initialY)).current;
  const lastY = useRef(initialY);
  const [isExpanded, setIsExpanded] = useState(initialY === 0);

  useEffect(() => {
    if (lockExpanded) {
      lastY.current = 0;
      sheetAnim.setValue(0);
      setIsExpanded(true);
      onExpandedChange?.(true);
      return;
    }
    const target = initialExpanded ? 0 : COLLAPSED_Y;
    lastY.current = target;
    sheetAnim.setValue(target);
    setIsExpanded(initialExpanded);
  }, [maxHeight, minHeight, lockExpanded, initialExpanded]);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const bounceLoop = useRef(null);

  const startBounce = useCallback(() => {
    bounceLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -8,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    );
    bounceLoop.current.start();
  }, [bounceAnim]);

  const stopBounce = useCallback(() => {
    bounceLoop.current?.stop();
    Animated.timing(bounceAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [bounceAnim]);

  useEffect(() => {
    if (lockExpanded) return undefined;
    if (!isExpanded) startBounce();
    return () => bounceLoop.current?.stop();
  }, [lockExpanded, isExpanded, startBounce]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, { dx, dy }) => {
        if (lockExpanded) return false;
        // Increase ratio to 3.0 to ensure horizontal swipes (like the car selector)
        // are not intercepted by the vertical sheet.
        return Math.abs(dy) > Math.abs(dx) * 3.0 && Math.abs(dy) > 10;
      },
      onMoveShouldSetPanResponderCapture: (evt, { dx, dy }) => {
        if (lockExpanded) return false;
        return Math.abs(dy) > Math.abs(dx) * 3.0 && Math.abs(dy) > 10;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        stopBounce();
        onDragStart?.();
        sheetAnim.stopAnimation((v) => {
          lastY.current = v;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        // Dragging UP (negative dy) decreases translateY (expanded)
        // Dragging DOWN (positive dy) increases translateY (collapsed)
        let newY = lastY.current + dy;
        newY = Math.max(0, Math.min(COLLAPSED_Y, newY));
        sheetAnim.setValue(newY);
      },
      onPanResponderRelease: (_, { dy }) => {
        onDragEnd?.();
        let currentY = lastY.current + dy;
        currentY = Math.max(0, Math.min(COLLAPSED_Y, currentY));

        const midpoint = COLLAPSED_Y * 0.5;
        const shouldExpand = currentY < midpoint;
        const target = shouldExpand ? 0 : COLLAPSED_Y;

        lastY.current = target;
        setIsExpanded(shouldExpand);
        onExpandedChange?.(shouldExpand);

        Animated.spring(sheetAnim, {
          toValue: target,
          useNativeDriver: true, // MUCH smoother and doesn't affect map
          tension: 80,
          friction: 13,
        }).start(() => {
          if (!shouldExpand) startBounce();
        });
      },
    })
  ).current;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.sheet,
          {
            height: maxHeight,
            transform: [{ translateY: sheetAnim }],
          },
          style,
        ]}
        pointerEvents="auto"
      >
        <View pointerEvents="none" style={styles.topShadowGlow} />
        <View
          {...(!lockExpanded ? panResponder.panHandlers : undefined)}
          style={styles.dragArea}
          collapsable={false}
        >
          <Animated.View
            style={{
              alignItems: 'center',
              transform: [{ translateY: lockExpanded ? 0 : bounceAnim }],
            }}
          >
            <View style={styles.handle} />
            {!lockExpanded && (
              <View style={styles.swipeHintWrap}>
                <Text style={styles.swipeHint}>
                  {isExpanded
                    ? t('home.swipeDownToHide', 'Swipe down')
                    : t('home.swipeUpToViewMore')}
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
        {header ? (
          <View style={styles.header} {...(!lockExpanded ? panResponder.panHandlers : undefined)}>
            {header}
          </View>
        ) : null}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          scrollEventThrottle={16}
          removeClippedSubviews
          scrollEnabled={scrollEnabled}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}
            pointerEvents="box-none"
          >
            {footer}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 14,
    paddingHorizontal: 20,
    overflow: 'hidden',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.2,
    borderRightWidth: 1.2,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  topShadowGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  dragArea: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginHorizontal: -20,
    alignItems: 'center',
    marginBottom: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  swipeHintWrap: {
    alignItems: 'center',
    marginTop: 6,
  },
  swipeHint: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  header: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 8,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingBottom: 8,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
