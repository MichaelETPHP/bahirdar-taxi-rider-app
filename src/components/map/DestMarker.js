import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

export default React.memo(function DestMarker({ coordinate, title = 'Destination', caption }) {
  if (!coordinate) return null;
  return (
    <Marker coordinate={coordinate} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
      <View style={styles.pin}>
        <View style={styles.label}>
          {caption ? <Text style={styles.captionText}>{caption}</Text> : null}
          <Text style={[styles.labelText, caption && styles.labelTextWithCaption]} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {/* Pin body */}
        <View style={styles.body}>
          <FontAwesome5 name="map-marker-alt" size={32} color={colors.success} solid />
        </View>
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
    maxWidth: 168,
  },
  captionText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelTextWithCaption: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
});
