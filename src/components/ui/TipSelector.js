import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated } from 'react-native';
import { colors } from '../../constants/colors';
import { borderRadius, shadow } from '../../constants/layout';
import { fontSize, fontWeight } from '../../constants/typography';

const TIPS = [0, 10, 25, 50];
// One Animated.Value per tip chip + one for custom
const CHIP_KEYS = [...TIPS.map(String), 'custom'];

function AnimatedChip({ label, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevSelected = useRef(selected);

  React.useEffect(() => {
    if (selected && !prevSelected.current) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.1,
          speed: 140,
          bounciness: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 80,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevSelected.current = selected;
  }, [selected]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      speed: 120,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 80,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TipSelector({ value, onChange, style }) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const selectTip = (tip) => {
    setCustomMode(false);
    onChange?.(tip);
  };

  const handleCustom = () => {
    setCustomMode(true);
    onChange?.(0);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {TIPS.map((tip) => (
          <AnimatedChip
            key={tip}
            label={tip === 0 ? 'No tip' : `${tip} ETB`}
            selected={value === tip && !customMode}
            onPress={() => selectTip(tip)}
          />
        ))}
        <AnimatedChip
          key="custom"
          label="Custom"
          selected={customMode}
          onPress={handleCustom}
        />
      </View>
      {customMode && (
        <TextInput
          style={styles.customInput}
          placeholder="Enter amount (ETB)"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          value={customValue}
          onChangeText={(text) => {
            setCustomValue(text);
            onChange?.(parseInt(text, 10) || 0);
          }}
          autoFocus
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: borderRadius.pill,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  customInput: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 12,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
});
