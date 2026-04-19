import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useLocationStore from '../../store/locationStore';

const MAX_STOPS = 2;

export default function LocationBar({ onToPress, onFromPress, onStopPress, onAddStopPress }) {
  const { t } = useTranslation();
  const { pickup, destination, stops, clearDestination, addStop, removeStop } = useLocationStore();
  const canAddStop = stops.length < MAX_STOPS;
  const whereToPulse = useRef(new Animated.Value(0)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;

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
          <FontAwesome5 name="map-marker-alt" size={18} color={colors.primary} solid />
        </View>
        {stops.map((_, i) => (
          <React.Fragment key={i}>
            <View style={styles.dottedLine} />
            <View style={styles.pinWrapper}>
              <FontAwesome5 name="map-marker-alt" size={16} color={colors.mapCurrentLocation} solid />
            </View>
          </React.Fragment>
        ))}
        <View style={styles.dottedLine} />
        <View style={styles.pinWrapper}>
          <FontAwesome5 name="map-marker-alt" size={18} color={colors.mapCurrentLocation} solid />
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
          <React.Fragment key={index}>
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
                <FontAwesome5 name="times-circle" size={20} color="rgba(239,68,68,0.5)" solid />
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
                <FontAwesome5 name="plus" size={12} color={colors.primary} solid />
              </View>
              <Text style={styles.addStopText}>{t('home.addStop')}</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.divider} />

        {/* Destination */}
        <Animated.View style={[styles.inputRow, !destination && whereToAnimatedStyle]}>
          <TouchableOpacity style={styles.input} onPress={onToPress} activeOpacity={0.85}>
            <View style={styles.whereToInline}>
              <Text style={destination ? styles.inputText : styles.inputPlaceholder} numberOfLines={1}>
                {destination?.name || t('home.whereTo')}
              </Text>
              {!destination && <Animated.View style={[styles.fakeCursor, { opacity: cursorBlink }]} />}
            </View>
          </TouchableOpacity>
          {destination ? (
            <TouchableOpacity
              style={styles.inputAction}
              onPress={clearDestination}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <FontAwesome5 name="times-circle" size={20} color="rgba(239,68,68,0.5)" solid />
            </TouchableOpacity>
          ) : (
            <View style={styles.inputAction} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

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
  dottedLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(239, 68, 68, 0.5)',
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
});
