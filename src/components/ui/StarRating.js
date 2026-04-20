import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
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
          <Star
            size={size}
            color={colors.primary}
            fill={star <= value ? colors.primary : 'none'}
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
