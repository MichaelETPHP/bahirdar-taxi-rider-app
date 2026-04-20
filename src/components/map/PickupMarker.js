import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '../../constants/colors';

const PICKUP_COLOR = '#FFFFFF';

export default React.memo(function PickupMarker({ coordinate, title = 'Pickup' }) {
  if (!coordinate) return null;
  return (
    <Marker coordinate={coordinate} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
      <View style={styles.pin}>
        {/* Label */}
        <View style={styles.label}>
          <Text style={styles.labelText} numberOfLines={1}>{title}</Text>
        </View>
        {/* White dot */}
        <View style={styles.circle} />
        <View style={styles.tail} />
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
  },
  label: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 140,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PICKUP_COLOR,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0,0,0,0.1)',
    marginTop: -1,
  },
});
