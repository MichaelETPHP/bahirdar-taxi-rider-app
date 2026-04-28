import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
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
  style,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const initialHeight = initialExpanded || lockExpanded ? maxHeight : minHeight;
  const sheetHeight = useRef(new Animated.Value(initialHeight)).current;
  const lastHeight = useRef(initialHeight);
  const [isExpanded, setIsExpanded] = useState(initialHeight === maxHeight);

  useEffect(() => {
    if (lockExpanded) {
      lastHeight.current = maxHeight;
      sheetHeight.setValue(maxHeight);
      setIsExpanded(true);
      onExpandedChange?.(true);
      return;
    }
    const clamped = Math.min(lastHeight.current, maxHeight);
    lastHeight.current = clamped;
    sheetHeight.setValue(clamped);
    const expanded = clamped === maxHeight;
    setIsExpanded(expanded);
    onExpandedChange?.(expanded);
  }, [maxHeight, lockExpanded, sheetHeight, onExpandedChange]);

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
    startBounce();
    return () => bounceLoop.current?.stop();
  }, [lockExpanded, startBounce]);

  const minHeightRef = useRef(minHeight);
  const maxHeightRef = useRef(maxHeight);
  minHeightRef.current = minHeight;
  maxHeightRef.current = maxHeight;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, { dx, dy }) => {
        if (lockExpanded) return false;
        if (evt.nativeEvent.touches.length > 1) return false;
        return Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 10;
      },
      onMoveShouldSetPanResponderCapture: (evt, { dx, dy }) => {
        if (lockExpanded) return false;
        if (evt.nativeEvent.touches.length > 1) return false;
        return Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 10;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        stopBounce();
        sheetHeight.stopAnimation((v) => {
          lastHeight.current = v;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        // Dragging DOWN (positive dy) reduces height (collapses)
        let newHeight = lastHeight.current - dy;
        newHeight = Math.max(minHeightRef.current, Math.min(maxHeightRef.current, newHeight));
        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, { dy }) => {
        let current = lastHeight.current - dy;
        current = Math.max(minHeightRef.current, Math.min(maxHeightRef.current, current));
        const midpoint = minHeightRef.current + (maxHeightRef.current - minHeightRef.current) * 0.5;
        const shouldExpand = current > midpoint;
        const target = shouldExpand ? maxHeightRef.current : minHeightRef.current;
        lastHeight.current = target;
        const expanded = target === maxHeightRef.current;
        setIsExpanded(expanded);
        onExpandedChange?.(expanded);
        Animated.spring(sheetHeight, {
          toValue: target,
          useNativeDriver: false, // height cannot use native driver
          tension: 80,
          friction: 13,
          velocity: 0.5,
          restSpeedThreshold: 0.001,
          restDisplacementThreshold: 0.001,
        }).start(() => {
          if (target === minHeightRef.current) startBounce();
        });
      },
    })
  ).current;

  return (
    // Animated.View occupies ONLY the visible height.
    // No translateY = Android touch areas always match what is visible on screen.
    <Animated.View
      style={[styles.sheet, { height: sheetHeight }, style]}
      pointerEvents="box-none"
      collapsable={false}
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
        directionalLockEnabled
        scrollEventThrottle={16}
        removeClippedSubviews
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
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8,
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
