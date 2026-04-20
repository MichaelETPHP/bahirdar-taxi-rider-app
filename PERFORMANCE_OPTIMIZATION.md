# 🚀 Mobile Application Performance Optimization

## Performance Issues Identified

### 1. **Query Refetch Intervals Too Aggressive**
- **Location**: `src/hooks/useTripQueries.js` (Line 42)
- **Issue**: `useNearbyDrivers` refetches every 10 seconds
- **Impact**: Causes re-renders every 10s even when screen is idle
- **Fix**: Increase to 20-30 seconds, add pause when app is backgrounded

### 2. **BottomSheet Animation Using JavaScript Driver**
- **Location**: `src/components/ui/BottomSheet.js` (Line 148)
- **Issue**: `useNativeDriver: false` for translateY animation
- **Impact**: Blocks main thread, causes jank and unresponsive UI
- **Fix**: Change to `useNativeDriver: true`

### 3. **Components Not Memoized**
- **Location**: `src/components/map/RideMap.js` and similar
- **Issue**: Components re-render on every parent update
- **Impact**: Expensive re-renders for Map, Markers, etc.
- **Fix**: Wrap with React.memo()

### 4. **Socket Live Updates Not Throttled**
- **Location**: `src/screens/home/HomeScreen.js` (mergeDrivers function)
- **Issue**: Every socket driver location update triggers setState
- **Impact**: Constant re-renders while drivers are moving
- **Fix**: Add debounce/throttle to socket updates (every 500ms instead of every update)

### 5. **useAuthStore Broad Subscriptions**
- **Location**: `src/screens/home/HomeScreen.js` (multiple zustand selectors)
- **Issue**: Multiple unrelated state selectors cause re-renders
- **Impact**: UI reacts to token changes, profile changes, etc.
- **Fix**: Use selective subscriptions with useShallow or separate hooks

### 6. **No Interaction Manager for Heavy Operations**
- **Issue**: Heavy operations (fare calculation, route fetch) block UI
- **Impact**: UI becomes unresponsive during API calls
- **Fix**: Wrap heavy operations with InteractionManager.runAfterInteractions()

### 7. **ScrollView Not Optimized**
- **Location**: Multiple screens
- **Issue**: Large content in ScrollView without removeClippedSubviews
- **Fix**: Add removeClippedSubviews, optimize content rendering

### 8. **Location Updates Causing Frequent Re-renders**
- **Location**: HomeScreen location hooks
- **Issue**: Every location update (from GPS) re-renders entire screen
- **Fix**: Memoize location-dependent calculations, use useCallback

## Optimization Priority

1. **HIGH PRIORITY** (Immediate unresponsiveness fix):
   - Fix BottomSheet native driver
   - Memoize RideMap and marker components
   - Add throttle to socket updates

2. **MEDIUM PRIORITY** (Reduce lag):
   - Optimize query refetch intervals
   - Add selective store subscriptions
   - Wrap heavy operations with InteractionManager

3. **LOW PRIORITY** (Polish):
   - ScrollView optimization
   - Bundle size reduction
   - Image optimization

## Implementation Checklist

- [ ] BottomSheet: useNativeDriver true
- [ ] RideMap: React.memo
- [ ] Markers: React.memo + useCallback
- [ ] useNearbyDrivers: Increase refetchInterval to 30s
- [ ] HomeScreen: Add socket throttle (500ms)
- [ ] HomeScreen: Use selective zustand selectors
- [ ] Heavy API calls: Wrap with InteractionManager
- [ ] Location hooks: Memoize dependencies
- [ ] Test on low-end Android device (Android 8-10)
- [ ] Profile app performance (react-native-community/hooks)

## Testing

Test on:
- Android 8 (low-end device)
- Android 11 (mid-range)
- Android 13+ (high-end)

Metrics:
- First interaction delay (hamburger menu click)
- Frame rate during scroll
- Memory usage (check for leaks)
- Battery impact (check wake frequency)
