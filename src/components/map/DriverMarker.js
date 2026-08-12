import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, Platform } from 'react-native';
import { Marker, AnimatedRegion } from 'react-native-maps';
import { Car } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';
import { normalizeDriverCarIconUrl } from '../../utils/driverCategoryIcon';
import useCachedCarIconUri from '../../hooks/useCachedCarIconUri';
import useRoadSnappedCoordinate from '../../hooks/useRoadSnappedCoordinate';

const MarkerAnimated = Marker.Animated;

function firstName(fullName = '') {
  return fullName.trim().split(' ')[0] || '';
}

function findClosestIndex(path, target) {
  if (!path || path.length === 0) return -1;
  let minDist = Infinity, idx = -1;
  for (let i = 0; i < path.length; i++) {
    const d =
      Math.pow((path[i].latitude ?? path[i].lat) - (target.latitude ?? target.lat), 2) +
      Math.pow((path[i].longitude ?? path[i].lng) - (target.longitude ?? target.lng), 2);
    if (d < minDist) { minDist = d; idx = i; }
  }
  return idx;
}

function getAngle(p1, p2) {
  const dy = (p2.latitude ?? p2.lat) - (p1.latitude ?? p1.lat);
  const dx = (p2.longitude ?? p2.lng) - (p1.longitude ?? p1.lng);
  const a = Math.atan2(dx, dy) * (180 / Math.PI);
  return a < 0 ? a + 360 : a;
}

function interpolatePathAndHeading(path, fraction, fallbackHeading) {
  if (!path || path.length === 0) return null;
  if (path.length === 1) return { coordinate: { latitude: path[0].latitude ?? path[0].lat, longitude: path[0].longitude ?? path[0].lng }, heading: fallbackHeading };
  if (fraction <= 0) return { coordinate: { latitude: path[0].latitude ?? path[0].lat, longitude: path[0].longitude ?? path[0].lng }, heading: getAngle(path[0], path[1]) };

  const last = path[path.length - 1];
  if (fraction >= 1) return { coordinate: { latitude: last.latitude ?? last.lat, longitude: last.longitude ?? last.lng }, heading: fallbackHeading };

  let totalDist = 0;
  const segs = path.slice(0, -1).map((p1, i) => {
    const p2 = path[i + 1];
    const d = Math.sqrt(Math.pow((p2.latitude ?? p2.lat) - (p1.latitude ?? p1.lat), 2) + Math.pow((p2.longitude ?? p2.lng) - (p1.longitude ?? p1.lng), 2));
    totalDist += d;
    return d;
  });
  if (totalDist === 0) return { coordinate: { latitude: path[0].latitude ?? path[0].lat, longitude: path[0].longitude ?? path[0].lng }, heading: fallbackHeading };

  let current = 0;
  const target = fraction * totalDist;
  for (let i = 0; i < segs.length; i++) {
    if (current + segs[i] >= target) {
      const t = (target - current) / segs[i];
      const p1 = path[i], p2 = path[i + 1];
      return {
        coordinate: {
          latitude: (p1.latitude ?? p1.lat) + ((p2.latitude ?? p2.lat) - (p1.latitude ?? p1.lat)) * t,
          longitude: (p1.longitude ?? p1.lng) + ((p2.longitude ?? p2.lng) - (p1.longitude ?? p1.lng)) * t,
        },
        heading: getAngle(p1, p2),
      };
    }
    current += segs[i];
  }
  return { coordinate: { latitude: last.latitude ?? last.lat, longitude: last.longitude ?? last.lng }, heading: fallbackHeading };
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ActivePulse() {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale,   { toValue: 2.5, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0,   duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1,   duration: 0, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: false }),
      ]),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View renderToHardwareTextureAndroid style={[styles.pulse, { transform: [{ scale }], opacity }]} />;
}

function GPSRipple({ trigger }) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    if (trigger === 0) return;
    scale.setValue(0.6); opacity.setValue(0.8);
    Animated.parallel([
      Animated.timing(scale,   { toValue: 3.8, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 0,   duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [trigger]);
  if (trigger === 0) return null;
  return <Animated.View renderToHardwareTextureAndroid style={[styles.gpsRipple, { transform: [{ scale }], opacity }]} />;
}

function NameBubble({ name, carText }) {
  return (
    <View style={styles.nameWrap}>
      <View style={styles.nameBubble}>
        <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
        {!!carText && <Text style={styles.carText} numberOfLines={1}>{carText}</Text>}
      </View>
      <View style={styles.nameTail} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default React.memo(function DriverMarker({ driver, onPress, routeCoords }) {
  const [rippleTrigger, setRippleTrigger] = useState(0);
  const [imageLoaded,   setImageLoaded]   = useState(false);
  const [imageFailed,   setImageFailed]   = useState(false);
  // Android: heading state drives the native `rotation` prop on the car marker.
  const [heading, setHeading] = useState(driver.heading || 0);

  // Snaps the raw GPS point to the nearest road (falls back to the raw point
  // instantly, corrects to the snapped one once OSRM resolves) so the car
  // sits on the street instead of slightly off-road.
  const { lat: snapLat, lng: snapLng } = useRoadSnappedCoordinate(driver.lat, driver.lng);

  // AnimatedRegion drives smooth position for MarkerAnimated (both platforms)
  const coordinate = useRef(new AnimatedRegion({
    latitude:  snapLat ?? 0,
    longitude: snapLng ?? 0,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;

  const animVal      = useRef(new Animated.Value(0)).current;
  const prevCoordRef = useRef({ latitude: snapLat, longitude: snapLng });
  const prevHeadRef  = useRef(driver.heading || 0);
  const routeRef     = useRef([]);
  const carIconUrl = useMemo(
    () => normalizeDriverCarIconUrl(
      driver?.carIconUrl ??
      driver?.car_icon_url ??
      driver?.vehicle?.categoryIconUrl ??
      driver?.vehicle?.car_icon_url
    ),
    [driver?.carIconUrl, driver?.car_icon_url, driver?.vehicle?.categoryIconUrl, driver?.vehicle?.car_icon_url]
  );
  // iOS-only: Marker's native `image` prop (unlike a child <Image>) renders
  // through a path that isn't affected by the custom-Marker-children bug —
  // but it only accepts local files, hence the cache-then-reference dance.
  const cachedCarIconUri = useCachedCarIconUri(Platform.OS === 'ios' ? carIconUrl : null);
  if (routeCoords && routeCoords.length > 2 && routeCoords !== routeRef.current) {
    routeRef.current = routeCoords;
  }

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    if (!carIconUrl) return;
    Image.prefetch(carIconUrl).catch(() => {});
  }, [carIconUrl]);

  useEffect(() => {
    const startLat = prevCoordRef.current.latitude;
    const startLng = prevCoordRef.current.longitude;
    const endLat   = snapLat;
    const endLng   = snapLng;
    const endHead  = driver.heading || 0;

    setRippleTrigger(n => n + 1);

    const dist = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));

    // Snap for large jumps or first render
    if (dist > 0.005 || (startLat === 0 && startLng === 0)) {
      coordinate.setValue({ latitude: endLat, longitude: endLng, latitudeDelta: 0, longitudeDelta: 0 });
      setHeading(endHead);
      prevCoordRef.current = { latitude: endLat, longitude: endLng };
      prevHeadRef.current  = endHead;
      return;
    }

    const oldCoord = { latitude: startLat, longitude: startLng };
    const newCoord = { latitude: endLat,   longitude: endLng   };
    let animPath = [];

    if (routeRef.current.length > 0) {
      const si = findClosestIndex(routeRef.current, oldCoord);
      const ei = findClosestIndex(routeRef.current, newCoord);
      if (si !== -1 && ei !== -1 && si < ei) animPath = [oldCoord, ...routeRef.current.slice(si + 1, ei), newCoord];
      else if (si !== -1 && ei !== -1 && si === ei) animPath = [oldCoord, newCoord];
    }
    if (animPath.length < 2) animPath = [oldCoord, newCoord];

    animVal.setValue(0);
    const id = animVal.addListener(({ value }) => {
      const r = interpolatePathAndHeading(animPath, value, endHead);
      if (!r) return;
      coordinate.setValue({ latitude: r.coordinate.latitude, longitude: r.coordinate.longitude, latitudeDelta: 0, longitudeDelta: 0 });
    });

    Animated.timing(animVal, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: false })
      .start(() => {
        setHeading(endHead);
        prevCoordRef.current = { latitude: endLat, longitude: endLng };
        prevHeadRef.current  = endHead;
        animVal.removeListener(id);
      });

    return () => animVal.removeListener(id);
  }, [snapLat, snapLng, driver.heading]);

  if (!driver.lat || !driver.lng) return null;

  const isLive  = !!driver?.live;
  const name    = firstName(driver?.fullName || driver?.name || '');
  const carText = String(driver?.carLabel || '').trim();
  const renderCarVisual = () => {
    if (carIconUrl && !imageFailed) {
      return (
        <Image
          source={{ uri: carIconUrl }}
          resizeMode="contain"
          fadeDuration={0}
          style={styles.carImage}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageFailed(true);
            setImageLoaded(true);
          }}
        />
      );
    }

    return (
      <View style={styles.carFallback}>
        <Car size={26} color={colors.primary} strokeWidth={2.2} />
      </View>
    );
  };

  // ── Android: plain <Marker image> + separate animation overlay ────────────
  if (Platform.OS === 'android') {
    return (
      <>
        {/* Animation overlay — no image inside, pure views only */}
        <MarkerAnimated
          coordinate={coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={true}
          zIndex={100}
        >
          <View style={styles.root} collapsable={false}>
            <ActivePulse />
            <GPSRipple trigger={rippleTrigger} />
            {isLive && !!name && <NameBubble name={name} carText={carText} />}
          </View>
        </MarkerAnimated>

        {/* Car icon — plain Marker so image prop works natively on Android */}
        <MarkerAnimated
          coordinate={coordinate}
          rotation={heading - 90}
          flat
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={!!carIconUrl && !imageFailed ? true : !imageLoaded}
          zIndex={101}
          onPress={onPress}
        >
          <View style={styles.carContainer} collapsable={false}>
            {renderCarVisual()}
          </View>
        </MarkerAnimated>
      </>
    );
  }

  // ── iOS: native `image`/`pinColor` props, no custom children ───────────────
  // Custom Marker children (the pulse ring, name bubble, and a child <Image>
  // for the car photo) silently fail to render on iOS under this project's
  // react-native-maps + New Architecture setup — proved this while debugging
  // the current-location marker. The native `image` prop renders through a
  // different path that isn't affected, so the car icon uses that instead;
  // it falls back to a plain colored pin while the icon is still downloading
  // to local cache (see useCachedCarIconUri) or if caching fails. The pulse
  // ring and name bubble have no equivalent native-prop path, so they're
  // Android-only for now.
  return (
    <MarkerAnimated
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={heading - 90}
      flat
      zIndex={100}
      image={cachedCarIconUri ? { uri: cachedCarIconUri } : undefined}
      pinColor={!cachedCarIconUri ? colors.primary : undefined}
    />
  );
});

const styles = StyleSheet.create({
  root: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  nameWrap: {
    position: 'absolute',
    top: 4,
    width: 140,
    alignItems: 'center',
  },
  nameBubble: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    maxWidth: 110,
    ...shadow.sm,
  },
  nameText:  { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  carText:   { marginTop: 1, color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: '600' },
  nameTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: colors.primary,
    marginTop: -2, alignSelf: 'center',
  },
  carContainer: {
    width: 60, height: 60,
    justifyContent: 'center', alignItems: 'center',
  },
  carImage: { width: 55, height: 55 },
  carFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(47, 112, 199, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  pulse: {
    position: 'absolute', top: 50, left: 50,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(47, 112, 199, 0.18)',
  },
  gpsRipple: {
    position: 'absolute', top: 50, left: 50,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 2.5, borderColor: 'rgba(47, 112, 199, 0.65)',
  },
});
