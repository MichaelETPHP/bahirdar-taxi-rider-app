import React, { useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, XCircle } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
const AnimatedLine = Animated.createAnimatedComponent(Line);

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useLocationStore from '../../store/locationStore';

function LocationBar({ onToPress, onFromPress, isInServiceArea = true }) {
  const { t } = useTranslation();
  const { pickup, destination, clearDestination } = useLocationStore();
  const whereToPulse = useRef(new Animated.Value(0)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;
  const liquidAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;


  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(liquidAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [liquidAnim, scaleAnim]);

  useEffect(() => {
    // Matrix-style flowing dots animation
    Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -12, // Move by two full dash patterns
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [dashOffset]);

  const handlePressOut = useCallback(() => {

    Animated.parallel([
      Animated.timing(liquidAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [liquidAnim, scaleAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(whereToPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(whereToPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [whereToPulse]);

  useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, {
          toValue: 0,
          duration: 420,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cursorBlink, {
          toValue: 1,
          duration: 420,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    blinkLoop.start();
    return () => blinkLoop.stop();
  }, [cursorBlink]);

  const whereToAnimatedStyle = {
    transform: [
      {
        scale: whereToPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02],
        }),
      },
    ],
    opacity: whereToPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.96, 1],
    }),
  };

  return (
    <View style={styles.container}>
      {/* Connector column - dynamic pins and vertical lines */}
      <View style={styles.connectorColumn}>
        <View style={styles.pinWrapper}>
          <MapPin size={18} color={colors.mapCurrentLocation} />
        </View>
        <View style={styles.dottedLineContainer}>
          <Svg height="100%" width="2">
            <AnimatedLine
              x1="1"
              y1="0"
              x2="1"
              y2="100%"
              stroke={colors.mapDestination}
              strokeWidth="2"
              strokeDasharray="1, 6"
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />

          </Svg>
        </View>
        <View style={styles.pinWrapper}>
          <MapPin size={18} color={colors.mapDestination} />
        </View>
      </View>

      <View style={styles.inputsColumn}>
        {/* Current location */}
        <View style={styles.inputRow}>
          <TouchableOpacity 
            style={styles.input} 
            onPress={isInServiceArea ? onFromPress : undefined} 
            activeOpacity={isInServiceArea ? 0.7 : 1}
            disabled={!isInServiceArea}
          >
            <Text style={pickup ? styles.inputText : styles.inputPlaceholder} numberOfLines={1}>
              {pickup?.name || t('home.yourLocation')}
            </Text>
          </TouchableOpacity>
          <View style={styles.inputAction} />
        </View>

        <View style={styles.divider} />

        {/* Destination */}
        <Animated.View 
          style={[
            styles.inputRow, 
            styles.whereToRow,
            !destination && whereToAnimatedStyle,
            { transform: [...(!destination ? whereToAnimatedStyle.transform : []), { scale: scaleAnim }] }
          ]}
        >
          <Pressable 
            style={[styles.input, styles.whereToInput]} 
            onPress={isInServiceArea ? onToPress : undefined} 
            onPressIn={isInServiceArea ? handlePressIn : undefined}
            onPressOut={isInServiceArea ? handlePressOut : undefined}
            disabled={!isInServiceArea}
          >
            {({ pressed }) => (
              <>
                <Animated.View 
                  style={[
                    styles.liquidFill,
                    {
                      transform: [{ scale: liquidAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2.5] }) }],
                      opacity: liquidAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
                    }
                  ]} 
                />
                <View style={styles.whereToInline}>
                  <Text 
                    style={[
                      destination ? styles.inputText : styles.whereToPlaceholder,
                      !isInServiceArea && styles.outOfServiceText
                    ]} 
                    numberOfLines={1}
                  >
                    {destination?.name || (isInServiceArea ? t('home.whereTo') : 'Out of Service')}
                  </Text>
                  {!destination && isInServiceArea && <Animated.View style={[styles.fakeCursor, { opacity: cursorBlink }]} />}
                </View>
              </>
            )}
          </Pressable>
          {destination ? (
            <TouchableOpacity
              style={styles.inputAction}
              onPress={clearDestination}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <XCircle size={20} color="rgba(239,68,68,0.5)" />
            </TouchableOpacity>
          ) : (
            <View style={styles.inputAction} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

export default memo(LocationBar);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 103, 79, 0.10)',
    borderRadius: 24,
    backgroundColor: colors.white,
    overflow: 'hidden',
    padding: 8,
    gap: 10,
    shadowColor: '#0B3B2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  connectorColumn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F3FBF8',
    borderRadius: 18,
    gap: 2,
  },
  dottedLineContainer: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    alignItems: 'center',
  },
  pinWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputsColumn: {
    flex: 1,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
  },
  input: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: 54,
  },
  inputAction: {
    width: 42,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    marginHorizontal: 12,
  },
  inputText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  inputPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  whereToRow: {
    backgroundColor: '#E8F6F0',
    borderWidth: 1,
    borderColor: 'rgba(0, 103, 79, 0.16)',
  },
  whereToInput: {
    borderRadius: 18,
  },
  whereToPlaceholder: {
    fontSize: fontSize.sm,
    color: 'rgba(11, 122, 90, 0.78)',
    fontWeight: fontWeight.medium,
  },
  outOfServiceText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  whereToInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fakeCursor: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: '#0B7A5A',
  },
  liquidFill: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#BEE7D7',
    top: -34,
    left: '8%',
    zIndex: -1,
  },
});
