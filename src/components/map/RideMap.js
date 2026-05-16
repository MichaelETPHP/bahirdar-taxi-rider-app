import { memo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import useRideStore from '../../store/rideStore';

function MapSkeleton({ opacity }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.skeleton, { opacity }]}>
      {/* Fake road lines for instant visual feedback */}
      <View style={[styles.fakeRoad, { top: '38%', left: 0, right: 0, height: 3 }]} />
      <View style={[styles.fakeRoad, { top: '62%', left: 0, right: 0, height: 2 }]} />
      <View style={[styles.fakeRoad, { left: '35%', top: 0, bottom: 0, width: 3 }]} />
      <View style={[styles.fakeRoad, { left: '65%', top: 0, bottom: 0, width: 2 }]} />
      {/* Center pin shadow */}
      <View style={styles.skeletonPin}>
        <View style={styles.skeletonPinDot} />
        <View style={styles.skeletonPinShadow} />
      </View>
    </Animated.View>
  );
}

function RideMap({
  children,
  mapRef: providedRef,
  initialRegion,
  style,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  mapPadding,
}) {
  const internalRef = useRef(null);
  const mapViewRef  = providedRef || internalRef;
  const [mapReady, setMapReady] = useState(false);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;

  // Fade out skeleton as soon as the map surface is ready
  const handleMapReady = () => {
    setMapReady(true);
    Animated.timing(skeletonOpacity, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!mapReady) return;
    const apply = (enabled) => {
      mapViewRef.current?.setNativeProps({ scrollEnabled: enabled });
    };
    let prev = useRideStore.getState().isMapScrollEnabled;
    apply(prev);
    return useRideStore.subscribe((state) => {
      if (state.isMapScrollEnabled !== prev) {
        prev = state.isMapScrollEnabled;
        apply(prev);
      }
    });
  }, [mapViewRef, mapReady]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapViewRef}
        provider={PROVIDER_GOOGLE}
        googleRenderer="LEGACY"
        style={StyleSheet.absoluteFillObject}
        // Pass initialRegion directly to avoid hardcoded jump
        initialRegion={initialRegion}
        
        // ── Optimized Performance Flags ──
        showsUserLocation={false} 
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
        showsBuildings={true}
        showsIndoors={false}
        showsPointsOfInterest={true}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        
        // ── Interaction ──
        scrollEnabled={true}
        zoomEnabled={true}
        panEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        
        // ── Callbacks ──
        mapPadding={mapPadding}
        onPress={onPress}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={handleMapReady}
        mapType="standard"
        
        // ── Native Loading fallback ──
        loadingEnabled={true}
        loadingIndicatorColor="#00674F"
        loadingBackgroundColor="#F5F5F5"
      >
        {/* Only mount children after map is ready to prevent UI glitches/crashes */}
        {mapReady ? children : null}
      </MapView>

      {/* High-speed skeleton overlay */}
      <MapSkeleton opacity={skeletonOpacity} />
    </View>
  );
}

export default memo(RideMap);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  skeleton: {
    backgroundColor: '#EEF0EB',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  fakeRoad: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    opacity: 0.8,
    borderRadius: 2,
  },
  skeletonPin: {
    alignItems: 'center',
  },
  skeletonPinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00674F',
    borderWidth: 2,
    borderColor: '#fff',
  },
  skeletonPinShadow: {
    width: 8,
    height: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginTop: 2,
  },
});
