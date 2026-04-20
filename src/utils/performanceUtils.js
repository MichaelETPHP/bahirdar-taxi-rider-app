import { InteractionManager } from 'react-native';

/**
 * Wraps an async function to run after all interactions are complete
 * Prevents blocking the UI thread during heavy operations
 */
export async function runAfterInteractions(asyncFn) {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const result = await asyncFn();
        resolve(result);
      } catch (error) {
        resolve(error);
      }
    });
  });
}

/**
 * Simple debounce function for throttling rapid updates
 */
export function debounce(func, delayMs) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delayMs);
  };
}

/**
 * Simple throttle function - executes at most once per interval
 */
export function throttle(func, intervalMs) {
  let lastTime = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - lastTime >= intervalMs) {
      lastTime = now;
      func(...args);
    }
  };
}

/**
 * Batches multiple state updates to prevent excessive re-renders
 */
export function batchUpdates(updates) {
  return Object.entries(updates).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}
