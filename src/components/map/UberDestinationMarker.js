import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Marker } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

/**
 * Uber-Style Destination Marker with 'Red Light' Pulse
 */
function UberDestinationMarker({ coordinate, title, onPress }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.3, 0],
  });

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={true}
      zIndex={499} // Above polyline
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.container}>
        {/* Pulsing light ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale }],
              opacity,
            },
          ]}
        />

        {/* Main marker - red circle */}
        <View style={styles.markerBody}>
          <MapPin size={22} color={colors.white} strokeWidth={2.5} />
        </View>

        {/* Location label */}
        {title && (
          <View style={styles.labelContainer}>
            <Text style={styles.labelText} numberOfLines={1}>
              {title}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

export default memo(UberDestinationMarker);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },

  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mapDestination,
  },

  markerBody: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mapDestination,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  labelContainer: {
    position: 'absolute',
    top: -25,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    minWidth: 60,
  },

  labelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
});
