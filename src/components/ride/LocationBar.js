import React, { useEffect, useRef, memo } from 'react';
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
  const dashOffset = useRef(new Animated.Value(0)).current;

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
        <View style={[styles.inputRow, styles.whereToRow]}>
          <Pressable 
            style={[styles.input, styles.whereToInput]} 
            onPress={isInServiceArea ? onToPress : undefined} 
            disabled={!isInServiceArea}
          >
            <View style={styles.whereToInline}>
              <Text 
                style={[
                  destination ? styles.whereToText : styles.whereToPlaceholder,
                  !isInServiceArea && styles.outOfServiceText
                ]} 
                numberOfLines={1}
              >
                {destination?.name || (isInServiceArea ? t('home.whereTo') : 'Out of Service')}
              </Text>
            </View>
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
        </View>
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
    backgroundColor: '#F2F7F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 103, 79, 0.08)',
  },
  whereToInput: {
    borderRadius: 18,
  },
  whereToText: {
    fontSize: fontSize.sm,
    color: '#38584E',
    fontWeight: fontWeight.medium,
  },
  whereToPlaceholder: {
    fontSize: fontSize.sm,
    color: 'rgba(56, 88, 78, 0.72)',
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
});
