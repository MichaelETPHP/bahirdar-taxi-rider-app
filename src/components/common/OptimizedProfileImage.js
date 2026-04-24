import React, { useState, useEffect, useCallback } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { getOptimizedImageUrl, preloadImage } from '../../services/imageOptimizationService';

/**
 * Optimized profile image with lazy loading, caching, and fallback
 */
export default function OptimizedProfileImage({
  uri,
  size = 80,
  placeholder = true,
  onLoad = () => {},
  onError = () => {},
}) {
  const [loading, setLoading] = useState(!!uri);
  const [error, setError] = useState(false);
  const [displayUri, setDisplayUri] = useState(null);

  // Preload image on mount
  useEffect(() => {
    if (!uri) {
      setLoading(false);
      return;
    }

    const optimizedUrl = getOptimizedImageUrl(uri, 'medium');
    preloadImage(optimizedUrl)
      .then(() => {
        setDisplayUri(optimizedUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[OptimizedProfileImage] Preload failed:', err);
        setError(true);
        setLoading(false);
        onError?.(err);
      });
  }, [uri, onError]);

  const handleImageLoad = useCallback(() => {
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleImageError = useCallback(() => {
    console.warn('[OptimizedProfileImage] Image load failed:', displayUri);
    setError(true);
    setLoading(false);
    onError?.();
  }, [displayUri, onError]);

  const imageSize = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // Fallback placeholder
  if (!uri || error) {
    return (
      <View
        style={[
          styles.placeholder,
          imageSize,
          { backgroundColor: colors.backgroundSecondary },
        ]}
      >
        <User size={size * 0.5} color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[imageSize, styles.container]}>
      {displayUri && (
        <Image
          source={{ uri: displayUri, cache: 'force-cache' }}
          style={imageSize}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
      {loading && placeholder && (
        <View style={[imageSize, styles.loadingOverlay]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  loadingOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
