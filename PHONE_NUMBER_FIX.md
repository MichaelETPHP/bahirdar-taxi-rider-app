# 📱 Phone Number Persistence Fix

## Problem
After closing and reopening the app, the phone number in the drawer menu displayed as `XXXXXXXX` (masked) instead of the actual phone number like `+251 911111111`.

---

## Root Cause
When the app reloaded, the phone number wasn't being restored from AsyncStorage. It was only stored in the Zustand store (which resets on reload) but not persisted.

---

## Solution

### 1. **Save Phone Number to AsyncStorage**
**File**: `src/utils/sessionManager.js`
- Added `PHONE_KEY` constant
- Updated `saveSession()` to accept and save phone number
- Added `getSavedPhone()` function to retrieve saved phone

```javascript
const PHONE_KEY = 'rider_phone_number';

export async function saveSession(accessToken, refreshToken, expiresIn, phone = null) {
  // ... session save logic
  if (phone) {
    await AsyncStorage.setItem(PHONE_KEY, phone);
  }
}

export async function getSavedPhone() {
  return await AsyncStorage.getItem(PHONE_KEY);
}
```

### 2. **Update Token Storage Wrapper**
**File**: `src/utils/tokenStorage.js`
- Added phone parameter to `saveTokens()`
- Added `getStoredPhone()` function

```javascript
export async function saveTokens(accessToken, refreshToken, expiresIn, phone) {
  return await saveSession(accessToken, refreshToken, expiresIn, phone);
}

export async function getStoredPhone() {
  return await getSavedPhone();
}
```

### 3. **Pass Phone When Saving Tokens**
**File**: `src/store/authStore.js`
- Modified `setTokens()` to pass phone number when saving
- This ensures phone is saved every time tokens are saved

```javascript
setTokens: async (accessToken, refreshToken, expiresIn = 3600) => {
  const currentPhone = get().phone;
  const session = await saveTokens(accessToken, refreshToken, expiresIn, currentPhone);
  // ... rest of logic
};
```

### 4. **Restore Phone on App Load**
**File**: `src/store/authStore.js`
- Updated `loadTokens()` to restore phone from AsyncStorage
- Phone is restored before authentication state is set

```javascript
loadTokens: async () => {
  // ... session check
  
  // Restore phone number first
  const storedPhone = await getStoredPhone();
  if (storedPhone) {
    set({ phone: storedPhone });
    console.log('[loadTokens] Phone number restored:', storedPhone);
  }
  
  // ... token logic
};
```

### 5. **Format Phone Display Correctly**
**File**: `src/screens/profile/DrawerMenu.js`
- Added `formatPhoneNumber()` function to handle different formats
- Converts local format (09XXXXXXXX) to international (+251 9XXXXXXXX)
- Displays correctly even if phone is empty

```javascript
const formatPhoneNumber = (phoneStr) => {
  if (!phoneStr) return 'No phone';
  // International format check
  if (phoneStr.startsWith('+251')) return phoneStr;
  // Local format conversion
  if (phoneStr.startsWith('0')) return `+251 ${phoneStr.slice(1)}`;
  return phoneStr;
};

// Use in display
<Text style={styles.userPhone}>{displayPhone}</Text>
```

### 6. **Clear Phone on Logout**
**File**: `src/utils/sessionManager.js`
- Updated `clearSession()` to also remove saved phone

```javascript
export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
  await AsyncStorage.removeItem(PHONE_KEY);  // Also clear phone
}
```

---

## Data Flow

### Login Flow
```
User enters phone (09111111111)
         ↓
OTPScreen calls setStorePhone(+251911111111)
         ↓
User verifies OTP
         ↓
OTPScreen calls setTokens(token, refreshToken)
         ↓
setTokens() saves to AsyncStorage:
  - SESSION_KEY: { tokens, timestamps }
  - PHONE_KEY: "+251911111111"
         ↓
App navigates to Home
```

### Reload Flow
```
User closes app
         ↓
User reopens app
         ↓
RootNavigator.useEffect triggers
         ↓
loadTokens() called
         ↓
getSessionStatus() checks SESSION_KEY
         ↓
getStoredPhone() retrieves PHONE_KEY
         ↓
Phone is restored to store
         ↓
DrawerMenu displays correct phone number
```

---

## Files Modified

```
✅ src/utils/sessionManager.js
   - Added PHONE_KEY constant
   - Added getSavedPhone() function
   - Updated saveSession() to save phone
   - Updated clearSession() to clear phone

✅ src/utils/tokenStorage.js
   - Updated saveTokens() to accept phone parameter
   - Added getStoredPhone() function

✅ src/store/authStore.js
   - Imported getStoredPhone
   - Updated setTokens() to pass phone
   - Updated loadTokens() to restore phone
   - Added phone restoration logging

✅ src/screens/profile/DrawerMenu.js
   - Added formatPhoneNumber() function
   - Updated display to use formatPhoneNumber()
   - Handles all phone number formats
```

---

## Testing

### Test: Phone Number Persistence

**Scenario 1: Fresh Login**
```
1. Delete app
2. Reinstall
3. Login: +251 9XX XXX XXXX
4. Complete OTP
5. Set up profile
6. Open drawer menu
7. ✅ Phone shows: +251 9XX XXX XXXX (correct format)
8. Check Expo logs: [loadTokens] Phone number restored
```

**Scenario 2: App Reload**
```
1. (From previous login) App is already logged in
2. Swipe up to open app switcher
3. Swipe app to close (completely close)
4. Tap app to reopen
5. Wait for app to load
6. Tap hamburger menu (drawer)
7. ✅ Phone shows: +251 9XX XXX XXXX (NOT masked/empty)
8. Check Expo logs: [loadTokens] Phone number restored: +251 9XX XXX XXXX
```

**Scenario 3: Phone Format Handling**
```
Different phone formats:
- 09XXXXXXXX     → +251 9XXXXXXXX ✅
- +251911111111  → +251911111111 ✅
- Empty/null     → "No phone" (fallback)
- XXXXXXXX       → Shows as is (fallback)
```

**Scenario 4: Logout**
```
1. Open app (logged in)
2. Open drawer menu
3. Tap "Logout"
4. Confirm logout
5. App navigates to login
6. Close and reopen app
7. ✅ Shows login screen (not home)
8. Phone data cleared from AsyncStorage
```

---

## Debug Tips

**Check if phone is saved:**
```javascript
// In Expo DevTools:
const phone = await AsyncStorage.getItem('rider_phone_number');
console.log('Saved phone:', phone);
```

**Check session data:**
```javascript
const session = await AsyncStorage.getItem('rider_session_data');
console.log('Session:', JSON.parse(session));
// Should have: accessToken, refreshToken, loginTime, expiresAt
```

**View Expo Logs:**
```
Look for:
✅ [loadTokens] Phone number restored: +251 9XX XXX XXXX
✅ [Auth] Session restored from AsyncStorage
```

---

## Summary

| Issue | Before | After |
|-------|--------|-------|
| Phone on reload | XXXXXXXX (masked) | +251 9XX XXX XXXX (correct) |
| Phone format | Inconsistent | Standardized (+251 format) |
| Session persistence | ❌ No | ✅ Yes (30 days) |
| Logout clears phone | ❌ No | ✅ Yes |

**Result**: Phone number now displays correctly after app reload and persists for the entire 30-day session! 🎉
