/**
 * Image Optimization Service
 * Handles image caching, resizing, and lazy loading
 */

import { Image } from 'react-native';

// In-memory cache for image sources
const IMAGE_CACHE = new Map();
const CACHE_SIZE_LIMIT = 50; // Limit cache to 50 images

/**
 * Get optimized image URL with query parameters for sizing
 */
export function getOptimizedImageUrl(url, size = 'medium') {
  if (!url) return null;

  // If already a data URI or local file, don't optimize
  if (url.startsWith('data:') || url.startsWith('file://')) {
    return url;
  }

  const sizes = {
    small: '?w=100&h=100&fit=crop&q=80',
    medium: '?w=200&h=200&fit=crop&q=85',
    large: '?w=400&h=400&fit=crop&q=90',
  };

  const queryStr = sizes[size] || sizes.medium;

  // Avoid double query params
  if (url.includes('?')) {
    return url;
  }

  return url + queryStr;
}

/**
 * Preload image for better performance
 */
export async function preloadImage(url) {
  if (!url || IMAGE_CACHE.has(url)) {
    return;
  }

  try {
    await Image.prefetch(url);
    IMAGE_CACHE.set(url, true);

    // Maintain cache size limit
    if (IMAGE_CACHE.size > CACHE_SIZE_LIMIT) {
      const firstKey = IMAGE_CACHE.keys().next().value;
      IMAGE_CACHE.delete(firstKey);
    }

    console.log('📸 Image preloaded:', url);
  } catch (error) {
    console.warn('⚠️  Failed to preload image:', url, error.message);
  }
}

/**
 * Get cached image or load it
 */
export async function getCachedImage(url) {
  if (!url) return null;

  if (IMAGE_CACHE.has(url)) {
    return url;
  }

  await preloadImage(url);
  return url;
}

/**
 * Clear image cache
 */
export function clearImageCache() {
  IMAGE_CACHE.clear();
  console.log('✅ Image cache cleared');
}

/**
 * Get cache size (for debugging)
 */
export function getImageCacheSize() {
  return IMAGE_CACHE.size;
}
