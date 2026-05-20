import { memo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import useRideStore from '../../store/rideStore';

function MapSkeleton({ opacity }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.skeleton, { opacity }]}>
      {/* Fake road lines for instant visual feedback */}
      <View style={[styles.fakeRoad, { top: '38%', left: 0, right: 0, height: 3 }]} />
      <View style={[styles.fakeRoad, { top: '62%', left: 0, right: 0, height: 2 }]} />
      <View style={[styles.fakeRoad, { left: '35%', top: 0, bottom: 0, width: 3 }]} />
      <View style={[styles.fakeRoad, { left: '65%', top: 0, bottom: 0, width: 2 }]} />
      {/* Center pin */}
      <View style={styles.skeletonPin}>
        <View style={styles.skeletonPinDot} />
        <View style={styles.skeletonPinShadow} />
      </View>
    </Animated.View>
  );
}

function ProfessionalRideMap({
  children,
  mapRef,
  initialRegion,
  style,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  mapPadding,
  scrollEnabled = true,
  onMapReady: onMapReadyProp,
}) {
  const internalRef = useRef(null);
  const mapViewRef  = mapRef || internalRef;
  const [mapReady, setMapReady] = useState(false);

  // Skeleton fades out as soon as the map surface is ready
  const skeletonOpacity = useRef(new Animated.Value(1)).current;

  const handleMapReady = () => {
    setMapReady(true);
    onMapReadyProp?.();
    Animated.timing(skeletonOpacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // Imperatively push scroll-enabled state — avoids React render cycle latency
  useEffect(() => {
    if (!mapReady) return;
    const apply = (enabled) => {
      mapViewRef.current?.setNativeProps({ scrollEnabled: scrollEnabled && enabled });
    };
    let prev = useRideStore.getState().isMapScrollEnabled;
    apply(prev);
    return useRideStore.subscribe((state) => {
      if (state.isMapScrollEnabled !== prev) {
        prev = state.isMapScrollEnabled;
        apply(prev);
      }
    });
  }, [scrollEnabled, mapReady]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapViewRef}
        provider={PROVIDER_GOOGLE}
        googleRenderer="LEGACY"
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        
        // ── Scroll / gesture ────────────────────────────────────
        scrollEnabled={scrollEnabled}
        zoomEnabled={true}
        zoomTapEnabled={true}
        panEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}

        // ── Performance ──────────────────────────────────────────
        // showsUserLocation OFF — we render UberUserLocationMarker ourselves.
        // The native blue-dot adds a redundant GPS warmup + render pass.
        showsUserLocation={false}
        // Remove map chrome that adds GPU layers with no UX value
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
        showsBuildings={true}
        showsIndoors={false}
        showsPointsOfInterest={true}

        // Loading indicator inside MapView (shows native spinner before tiles appear)
        loadingEnabled={true}
        loadingIndicatorColor="#00674F"
        loadingBackgroundColor="#F5F5F5"

        toolbarEnabled={false}
        mapType="standard"

        // ── Callbacks ────────────────────────────────────────────
        onPress={onPress}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
        mapPadding={mapPadding}
        onMapReady={handleMapReady}
      >
        {/* Only mount children after the map surface is ready.
            Mounting markers before onMapReady causes native crashes on some
            Android versions and wastes a render pass on iOS. */}
        {mapReady ? children : null}
      </MapView>

      {/* Instant skeleton — visible until onMapReady fires */}
      <MapSkeleton opacity={skeletonOpacity} />
    </View>
  );
}

export default memo(ProfessionalRideMap);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  // ── Skeleton ───────────────────────────────────────────────────────────
  skeleton: {
    backgroundColor: '#F3F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeRoad: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    opacity: 0.85,
    borderRadius: 2,
  },
  skeletonPin: {
    alignItems: 'center',
  },
  skeletonPinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00674F',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  skeletonPinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginTop: 2,
  },
});
