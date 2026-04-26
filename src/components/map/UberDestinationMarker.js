import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Flag } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

/**
 * Uber-Style Destination Marker
 * - Red/Coral circular marker
 * - Clean design
 * - Location label above
 * - Professional appearance
 */
function UberDestinationMarker({ coordinate, title, onPress }) {
  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={false}
      zIndex={99}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.container}>
        {/* Main marker - red circle */}
        <View style={styles.markerBody}>
          <Flag size={18} color={colors.white} strokeWidth={2.5} />
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
  },

  markerBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  labelContainer: {
    marginTop: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#e5e5e5',
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  labelText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
