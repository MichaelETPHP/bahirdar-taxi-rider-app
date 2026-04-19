import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';

const CAR_ON_MAP = require('../../../assets/carOnMap.png');

// OSRM heading is degrees from north clockwise.
// FA5 "car" icon faces right (east = 90°), so offset by -90°.
function headingToDeg(deg) {
  return (deg ?? 0) - 90;
}

// Show first name only — keeps bubble compact
function firstName(fullName = '') {
  return fullName.trim().split(' ')[0] || '';
}

export default React.memo(function DriverMarker({ driver, onPress }) {
  // tracksViewChanges must be true on first render so the custom view renders,
  // then set to false immediately for performance (stops re-rendering on map scroll).
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 300);
    return () => clearTimeout(t);
  }, []);

  const isLive   = !!driver?.live;
  const name     = firstName(driver?.fullName || driver?.name || '');
  const carText  = String(driver?.carLabel || '').trim();
  const rotateDeg = `${headingToDeg(driver.heading)}deg`;

  return (
    <Marker
      coordinate={{ latitude: driver.lat, longitude: driver.lng }}
      onPress={onPress}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.root}>
        {/* Name bubble — only for live Redis drivers */}
        {isLive && !!name && (
          <View style={styles.nameWrap}>
            <View style={styles.nameBubble}>
              <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
              {!!carText && (
                <Text style={styles.carText} numberOfLines={1}>
                  {carText}
                </Text>
              )}
            </View>
            <View style={styles.nameTail} />
          </View>
        )}

        <Image
          source={CAR_ON_MAP}
          resizeMode="contain"
          style={[
            styles.carImage,
            { transform: [{ rotate: rotateDeg }] },
          ]}
        />

        {/* Pointer tip */}
        <View style={[styles.tip, isLive && styles.tipLive]} />
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },

  // Name bubble
  nameWrap: {
    alignItems: 'center',
    marginBottom: 1,
  },
  nameBubble: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    maxWidth: 110,
    ...shadow.sm,
  },
  nameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  carText: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    fontWeight: '600',
  },
  nameTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
    marginTop: -2,
  },

  carImage: {
    width: 60,
    height: 60,
  },

  // Pointer tip below card
  tip: {
    marginTop: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.border,
  },
  tipLive: {
    borderTopColor: colors.primary,
  },
});
