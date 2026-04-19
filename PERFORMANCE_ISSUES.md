# BahirdarRide Performance Issues & Optimization Plan

## Current Problems Causing App to Freeze/Stack

### 🔴 **1. Multiple Continuous Animations Running Simultaneously**

**Files:** `src/screens/home/HomeScreen.js`, `src/components/ride/LocationBar.js`

**Issues:**
- **Banner Marquee** (line 471): 7-second loop animation running constantly
- **Wave Hand Animation** (line 459): 2-second interval animation loop
- **Skeleton Shimmer** (line 486): Loading state animation loop
- **LocationBar Pulse** (line 20): "Where To" field pulsing animation
- **LocationBar Cursor Blink** (line 41): Fake cursor blinking animation

**Impact:** All these run in parallel, causing continuous re-renders and GPU/CPU overload

---

### 🔴 **2. High-Frequency Socket Updates → Excessive Re-renders**

**File:** `src/screens/home/HomeScreen.js` (lines 242-348)

**Issues:**
- Socket emits `driver:location` event every 3-5 seconds per driver
- Each event calls `setDrivers()` which re-renders entire HomeScreen
- With 10+ nearby drivers = 40+ re-renders per minute
- `areDriverListsEqual()` function does O(n) comparison on every update

**Impact:** Main thread saturated, app becomes unresponsive

---

### 🔴 **3. Complex Map Operations**

**File:** `src/screens/home/HomeScreen.js` (lines 373-414)

**Issues:**
- `animateToRegion()` called when destination changes (line 390)
- `fitToCoordinates()` called frequently with route coordinates (line 410)
- Map re-renders all driver markers (line 527-529) when drivers array changes

**Impact:** Map animations are expensive, multiple simultaneous animations cause jank

---

### 🔴 **4. Inefficient useEffect Dependencies**

**File:** `src/screens/home/HomeScreen.js`

**Issue Examples:**
```javascript
// Line 414: Triggers on EVERY destination or coordinate change
useEffect(() => { mapRef.current.fitToCoordinates(...) }, 
  [destination, pickupCoordinate.latitude, pickupCoordinate.longitude, ...7 more]
);

// Line 361: Updates pickup on every userCoords change
useEffect(() => { setPickup({...}) }, 
  [userCoords, setPickup]
);
```

**Impact:** Too many effect re-runs, state churn

---

### 🔴 **5. Missing Memoization**

**File:** `src/screens/home/HomeScreen.js` (line 503 onwards)

**Issue:** HomeScreen is a large component with lots of state. When one piece updates, entire component re-renders

**Good news:** DriverMarker is already memoized (React.memo) ✅

---

## Optimization Strategy

### ✅ **Priority 1: Disable Non-Critical Animations When App is in Background**

**Changes needed:**
1. Use React Native's `AppState` to pause animations when app is backgrounded
2. Disable LocationBar animations when destination is not set
3. Debounce banner marquee animation

### ✅ **Priority 2: Throttle Socket Updates**

**Changes needed:**
1. Batch socket updates: collect driver updates over 500ms, then update once
2. Use `useCallback` with stable deps to prevent re-creating socket listeners
3. Replace `setDrivers()` with Map-based merge to avoid full array re-renders

### ✅ **Priority 3: Optimize Map Animations**

**Changes needed:**
1. Debounce `fitToCoordinates()` - only call when destination actually changes, not on coordinates update
2. Reduce animation duration or disable animation on frequent updates
3. Use `animateToRegion` less frequently

### ✅ **Priority 4: Memoize HomeScreen Components & Callbacks**

**Changes needed:**
1. Extract map children into memoized sub-component
2. Use `useMemo` for driver list filtering/sorting
3. Use `useCallback` for all handlers with stable dependencies

### ✅ **Priority 5: Debounce Pickup Location Updates**

**Changes needed:**
1. Don't update pickup location on every coordinate change
2. Only update when user coordinates actually change significantly (already done for geocoding)

---

## Performance Wins (in order of impact)

| Fix | Est. Gain | Difficulty |
|-----|-----------|-----------|
| Pause animations in background | 40% | Easy |
| Batch socket updates (500ms) | 35% | Medium |
| Debounce map animations | 25% | Easy |
| Memoize callbacks/components | 20% | Medium |
| Throttle location updates | 15% | Easy |

---

## Implementation Order

1. ✅ **Disable animations when destination is not set** (easiest, quick win)
2. ✅ **Throttle socket updates to 500ms batches** (biggest impact)
3. ✅ **Debounce fitToCoordinates** (reduces jank)
4. ✅ **Add AppState listener to pause animations** (background performance)
5. ✅ **Memoize HomeScreen sub-components**

---

## Code Changes Required

### File: `src/screens/home/HomeScreen.js`
- Wrap animations in conditions (destination check)
- Add batching to socket updates
- Debounce map.fitToCoordinates
- Add useMemo for driver markers
- Add AppState listener

### File: `src/components/ride/LocationBar.js`
- Disable pulse/blink animations unless actively being used
- Use `useMemo` for animation values

### File: `src/components/map/DriverMarker.js`
- Already optimized ✅

---

## Testing Checklist
- [ ] No freezing with 20+ nearby drivers
- [ ] Map pans smoothly with animations
- [ ] Socket updates don't cause frame drops
- [ ] Animations pause in background
- [ ] Battery usage reduced by 30%+

---

## Estimated Total Time: 2-3 hours for all fixes
