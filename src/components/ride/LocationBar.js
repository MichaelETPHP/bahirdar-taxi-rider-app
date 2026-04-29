import React, { useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, XCircle, Plus } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useLocationStore from '../../store/locationStore';

const MAX_STOPS = 2;

function LocationBar({ onToPress, onFromPress, onStopPress, onAddStopPress }) {
  const { t } = useTranslation();
  const { pickup, destination, stops, clearDestination, addStop, removeStop } = useLocationStore();
  const canAddStop = stops.length < MAX_STOPS;
  const whereToPulse = useRef(new Animated.Value(0)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;
  const liquidAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        {stops.map((stop, i) => (
          <React.Fragment key={`stop-${stop?.placeId || stop?.id || i}`}>
            <View style={styles.dottedLineContainer}>
              <Svg height="100%" width="2">
                <Line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2="100%"
                  stroke={colors.mapDestination}
                  strokeWidth="2"
                  strokeDasharray="0.1, 6"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View style={styles.pinWrapper}>
              <MapPin size={16} color={colors.mapCurrentLocation} />
            </View>
          </React.Fragment>
        ))}
        <View style={styles.dottedLineContainer}>
          <Svg height="100%" width="2">
            <Line
              x1="1"
              y1="0"
              x2="1"
              y2="100%"
              stroke={colors.mapDestination}
              strokeWidth="2"
              strokeDasharray="0.1, 6"
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
          <TouchableOpacity style={styles.input} onPress={onFromPress} activeOpacity={0.7}>
            <Text style={pickup ? styles.inputText : styles.inputPlaceholder} numberOfLines={1}>
              {pickup?.name || t('home.yourLocation')}
            </Text>
          </TouchableOpacity>
          <View style={styles.inputAction} />
        </View>

        {/* Dynamic stops */}
        {stops.map((stop, index) => (
          <React.Fragment key={`stop-input-${stop?.placeId || stop?.id || index}`}>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.input}
                onPress={() => onStopPress?.(index)}
                activeOpacity={0.7}
              >
                <Text
                  style={stop ? styles.inputText : styles.inputPlaceholder}
                  numberOfLines={1}
                >
                  {stop?.name || t('home.stopLabel', { n: index + 1 })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inputAction}
                onPress={() => removeStop(index)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <XCircle size={20} color="rgba(239,68,68,0.5)" />
              </TouchableOpacity>
            </View>
          </React.Fragment>
        ))}

        {/* Add stop button - max 2 stops */}
        {canAddStop && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.addStopRow}
              onPress={addStop}
              activeOpacity={0.7}
            >
              <View style={styles.addStopIcon}>
                <Plus size={12} color={colors.primary} />
              </View>
              <Text style={styles.addStopText}>{t('home.addStop')}</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.divider} />

        {/* Destination */}
        <Animated.View 
          style={[
            styles.inputRow, 
            !destination && whereToAnimatedStyle,
            { transform: [...(!destination ? whereToAnimatedStyle.transform : []), { scale: scaleAnim }] }
          ]}
        >
          <Pressable 
            style={styles.input} 
            onPress={onToPress} 
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
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
                  <Text style={destination ? styles.inputText : styles.inputPlaceholder} numberOfLines={1}>
                    {destination?.name || t('home.whereTo')}
                  </Text>
                  {!destination && <Animated.View style={[styles.fakeCursor, { opacity: cursorBlink }]} />}
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
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  connectorColumn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.backgroundAlt,
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
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  input: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: 60,
  },
  inputAction: {
    width: 48,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
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
  addStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 16,
    gap: 10,
  },
  addStopIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStopText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
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
    backgroundColor: colors.primary,
  },
  liquidFill: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    top: -30,
    left: '10%',
    zIndex: -1,
  },
});
