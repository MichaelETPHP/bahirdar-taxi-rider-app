let clearTransientCaches = () => {};

export function registerTransientCacheClearer(clearer) {
  clearTransientCaches = typeof clearer === 'function' ? clearer : () => {};
}

export function clearTransientRuntimeCaches() {
  try {
    clearTransientCaches();
  } catch (error) {
    if (__DEV__) console.warn('[Recovery] Could not clear transient caches:', error?.message ?? error);
  }
}
