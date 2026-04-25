import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
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
  const collapseOffset = Math.max(0, maxHeight - minHeight);
  const collapseOffsetRef = useRef(collapseOffset);
  collapseOffsetRef.current = collapseOffset;
  const initialOffset = initialExpanded || lockExpanded ? 0 : collapseOffset;
  const translateY = useRef(new Animated.Value(initialOffset)).current;
  const lastOffset = useRef(initialOffset);
  const [isExpanded, setIsExpanded] = useState(initialOffset === 0);

  useEffect(() => {
    if (lockExpanded) {
      lastOffset.current = 0;
      translateY.setValue(0);
      setIsExpanded(true);
      onExpandedChange?.(true);
      return;
    }
    const clamped = Math.min(lastOffset.current, collapseOffset);
    lastOffset.current = clamped;
    translateY.setValue(clamped);
    const expanded = clamped === 0;
    setIsExpanded(expanded);
    onExpandedChange?.(expanded);
  }, [collapseOffset, maxHeight, lockExpanded, translateY, onExpandedChange]);

  // Bounce hint animation — loops until user interacts
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

  // Drive layout height (not translateY) so hit-testing matches the visible sheet.
  // A translated full-height view still occupies the full layout box and blocks the map.
  const sheetTransform = [
    { translateY: translateY }
  ];

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
        translateY.stopAnimation((v) => {
          lastOffset.current = v;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        const offset = collapseOffsetRef.current;
        let newVal = lastOffset.current + dy;
        newVal = Math.max(0, Math.min(offset, newVal));
        translateY.setValue(newVal);
      },
      onPanResponderRelease: (_, { dy }) => {
        const offset = collapseOffsetRef.current;
        let current = lastOffset.current + dy;
        current = Math.max(0, Math.min(offset, current));
        const shouldExpand = current < offset * 0.5;
        const target = shouldExpand ? 0 : offset;
        lastOffset.current = target;
        const expanded = target === 0;
        setIsExpanded(expanded);
        onExpandedChange?.(expanded);
        Animated.spring(translateY, {
          toValue: target,
          useNativeDriver: true,
          tension: 80,
          friction: 13,
          velocity: 0.5,
          restSpeedThreshold: 0.001,
          restDisplacementThreshold: 0.001,
        }).start(() => {
          // Resume bounce hint when sheet is back in collapsed position
          if (target === offset) startBounce();
        });
      },
    })
  ).current;

  return (
    <View style={styles.wrapper} collapsable={false} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sheet,
          { height: maxHeight, transform: sheetTransform },
          style,
        ]}
      >
        <View pointerEvents="none" style={styles.topShadowGlow} />
        <View {...(!lockExpanded ? panResponder.panHandlers : undefined)} style={styles.dragArea} collapsable={false}>
          <Animated.View style={{ alignItems: 'center', transform: [{ translateY: lockExpanded ? 0 : bounceAnim }] }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    borderColor: '#D1D5DB', // Silver highlight
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
