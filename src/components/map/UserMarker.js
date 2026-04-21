import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Marker } from 'react-native-maps';
import { colors } from '../../constants/colors';

const LABEL_GAP = 6;
const AVATAR_OUTER = 48;

export default React.memo(function UserMarker({ coordinate, avatarUrl, name, label }) {
  const [imageReady, setImageReady] = useState(false);
  const [forceTrack, setForceTrack] = useState(true);

  // Stop tracking changes after 3 seconds or when image is ready to save performance
  // But keep it true for at least a few frames on Android to ensure paint
  React.useEffect(() => {
    const timer = setTimeout(() => setForceTrack(false), 3000);
    return () => clearTimeout(timer);
  }, [imageReady]);

  if (!coordinate) return null;

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : null;

  // On Android, we MUST track view changes while the image loads, 
  // otherwise it stays blank.
  const tracks = forceTrack || (Boolean(avatarUrl) && !imageReady);

  // Anchor at center of avatar (below optional label) so lat/lng matches pickup point
  const anchor = label ? { x: 0.5, y: 0.72 } : { x: 0.5, y: 0.5 };

  return (
    <Marker 
      coordinate={coordinate} 
      tracksViewChanges={tracks} 
      anchor={anchor}
      zIndex={99} // Ensure user is always on top
    >
      <View style={styles.column}>
        {label ? (
          <View style={styles.labelPill}>
            <Text style={styles.labelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
        <View style={styles.outer}>
          <View style={styles.ring} />
          <View style={styles.shell}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                onLoad={() => setImageReady(true)}
              />
            ) : initials ? (
              <View style={styles.initialsCircle}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
            ) : (
              <View style={styles.dot} />
            )}
          </View>
        </View>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
  },
  labelPill: {
    maxWidth: 160,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: LABEL_GAP,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF0000',
  },
  outer: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}14`,
  },
  shell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.white,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  initialsCircle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  dot: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 17,
  },
});
