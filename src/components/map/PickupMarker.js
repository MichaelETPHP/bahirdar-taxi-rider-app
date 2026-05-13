import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

// colors.mapCurrentLocation is #10B981 (Bright Green)
import { colors } from '../../constants/colors';

export default React.memo(function PickupMarker({ coordinate, title = 'Pickup' }) {
  if (!coordinate) return null;
  return (
    <Marker coordinate={coordinate} tracksViewChanges={true} anchor={{ x: 0.5, y: 1 }}>
      <View style={styles.pin}>
        {/* Label */}
        <View style={styles.label}>
          <Text style={styles.labelText} numberOfLines={1}>{title}</Text>
        </View>
        {/* Green circle */}
        <View style={styles.circle} />
        {/* Drop shadow tail */}
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
    backgroundColor: colors.mapCurrentLocation,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    minWidth: 70,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.mapCurrentLocation,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.mapCurrentLocation,
    marginTop: -1,
  },
});
