import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

export default function StarRating({ value = 0, onChange, size = 36, style }) {
  const handlePress = async (star) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange?.(star);
  };

  return (
    <View style={[styles.row, style]}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => handlePress(star)} activeOpacity={0.7}>
          <FontAwesome5
            name="star"
            size={size}
            color={colors.primary}
            solid={star <= value}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
});
