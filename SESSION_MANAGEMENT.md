# 🔐 30-Day Session Management System

## Overview

The Rider app now implements a **professional 30-day persistent login session** that:
- ✅ Keeps users logged in for 30 days without re-authentication
- ✅ Automatically refreshes tokens before expiry
- ✅ Only logs out after 30 days OR when user explicitly logs out
- ✅ Updates last activity on every app interaction
- ✅ Validates session on app foreground
- ✅ Handles network failures gracefully

## How It Works

### 1. **Session Storage Structure**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "loginTime": 1713607200000,
  "lastActivity": 1713607200000,
  "expiresAt": 1721383200000,
  "tokenExpiresAt": 1713610800000
}
```

- **loginTime**: When user first authenticated (never changes)
- **expiresAt**: 30 days from login (absolute expiration)
- **lastActivity**: Updated every app interaction
- **tokenExpiresAt**: When access token needs refresh

### 2. **Session Lifecycle**

```
Login Screen
    ↓
User enters phone + OTP
    ↓
verifyOtp() → returns accessToken + refreshToken
    ↓
saveTokens() → stores 30-day session in AsyncStorage
    ↓
App Home Screen
    ↓
[User uses app for weeks]
    ↓
Day 27: Update activity timestamp
    ↓
App detects token needs refresh (5 min before expiry)
    ↓
refreshTokens() → get new tokens
    ↓
updateTokens() → persist refreshed tokens
    ↓
[User continues using app]
    ↓
Day 30 (loginTime + 30 days)
    ↓
Session expired → Auto-logout
```

### 3. **Key Features**

#### Auto-Logout After 30 Days
```javascript
// App automatically logs out user on day 30
// No manual action needed - happens on next app open
const status = await getSessionStatus();
if (status.status === 'no_session') {
  // User is logged out
}
```

#### Token Refresh (Automatic)
```javascript
// Tokens are refreshed automatically before expiry
// User never sees "token expired" errors
if (status.needsRefresh) {
  const newTokens = await refreshTokens(refreshToken);
  await updateTokens(newTokens.accessToken, newTokens.refreshToken);
}
```

#### Activity Tracking
```javascript
// Last activity is updated whenever:
// - User opens app
// - User logs in
// - Tokens are refreshed
// - Tokens are updated
```

## Implementation Files

### New Files Created

1. **`src/utils/sessionManager.js`**
   - Core session management logic
   - Handles storage, expiration, refresh logic
   - Public API:
     - `saveSession(accessToken, refreshToken, expiresIn)`
     - `getSession()`
     - `updateLastActivity()`
     - `updateTokens(accessToken, refreshToken, expiresIn)`
     - `clearSession()`
     - `getSessionStatus()`

2. **`src/hooks/useSessionManager.js`**
   - React hook for app lifecycle management
   - Validates session when app comes to foreground
   - Updates activity timestamp

### Modified Files

1. **`src/utils/tokenStorage.js`**
   - Now uses `sessionManager` under the hood
   - Maintains backward-compatible API
   - Added `updateTokensOnly()` for token refresh

2. **`src/store/authStore.js`**
   - Added `sessionExpiresAt` state
   - Added `updateActivity()` method
   - Added `validateSession()` method
   - Enhanced `loadTokens()` with auto-refresh logic
   - Handles token refresh failures gracefully

## Usage

### 1. **In Login Screen**
```javascript
import useAuthStore from '../store/authStore';

const handleLoginSuccess = async (response) => {
  const { accessToken, refreshToken } = response.data;
  
  // Save tokens with 30-day expiration
  await useAuthStore.getState().setTokens(
    accessToken,
    refreshToken,
    3600 // 1 hour token expiry
  );
  
  // User will stay logged in for 30 days!
};
```

### 2. **In App Root Component**
```javascript
import useSessionManager from '../hooks/useSessionManager';

export default function RootNavigator() {
  // Add session lifecycle management
  useSessionManager();
  
  return (
    // Your navigation logic
  );
}
```

### 3. **On App Startup**
```javascript
import useAuthStore from '../store/authStore';

useEffect(() => {
  const bootstrap = async () => {
    const hasSession = await useAuthStore.getState().loadTokens();
    if (hasSession) {
      // User is already logged in - no login needed!
      navigateTo('Home');
    } else {
      navigateTo('Login');
    }
  };
  
  bootstrap();
}, []);
```

### 4. **Validate Session Before API Calls**
```javascript
// Optional: validate before sensitive operations
const isValid = await useAuthStore.getState().validateSession();
if (!isValid) {
  // User needs to login again
  return;
}
```

### 5. **Check Session Status (For Debugging)**
```javascript
import { getSessionStatus } from '../utils/sessionManager';

const status = await getSessionStatus();
console.log('Session:', {
  status: status.status,
  daysRemaining: status.daysRemaining,
  hoursRemaining: status.hoursRemaining,
  needsRefresh: status.needsRefresh,
  expiresAt: status.expiresAt,
});
```

## Constants

All time constants are in `src/utils/sessionManager.js`:

```javascript
SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000  // 30 days
TOKEN_REFRESH_BUFFER = 5 * 60 * 1000        // Refresh 5 min before expiry
```

To change the session duration, modify `SESSION_TIMEOUT`:
- 7 days: `7 * 24 * 60 * 60 * 1000`
- 14 days: `14 * 24 * 60 * 60 * 1000`
- 30 days: `30 * 24 * 60 * 60 * 1000`
- 90 days: `90 * 24 * 60 * 60 * 1000`

## Error Handling

### Scenario: Token Refresh Fails
```javascript
// If token refresh fails, app continues with existing token
// User won't be logged out - graceful degradation
try {
  const refreshed = await refreshTokens(refreshToken);
  await updateTokensOnly(refreshed.accessToken, refreshed.refreshToken);
} catch (err) {
  // Use existing token - don't force logout
  console.warn('Token refresh failed, using existing token');
}
```

### Scenario: Session Expired (30 days passed)
```javascript
// On app foreground, session validity is checked
// If 30 days have passed, user is automatically logged out
const status = await getSessionStatus();
if (status.status === 'no_session') {
  await useAuthStore.getState().logout();
  // Navigate to login screen
}
```

### Scenario: User Logs Out Explicitly
```javascript
// Manual logout clears everything
await useAuthStore.getState().logout();
// All session data is wiped
```

## Testing

### Test 30-Day Session
```javascript
// Simulate day 29 (should still work)
const session = await getSession();
console.log('Days remaining:', Math.floor((session.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));

// Simulate day 31 (should auto-logout)
// Set expiresAt to past date
```

### Test Token Refresh
```javascript
// Check if refresh is needed
const status = await getSessionStatus();
console.log('Token needs refresh:', status.needsRefresh);
```

### Test Activity Update
```javascript
const before = await getSession();
await updateLastActivity();
const after = await getSession();
console.log('Activity updated:', before.lastActivity !== after.lastActivity);
```

## Migration from Old System

If users have old tokens stored:

```javascript
// Old system used separate keys
const ACCESS_KEY = 'rider_access_token';
const REFRESH_KEY = 'rider_refresh_token';

// New system uses unified session
const SESSION_KEY = 'rider_session_data';

// Old tokens are automatically migrated on first login
// No action needed for existing users
```

## Security Best Practices

✅ **Tokens are stored in AsyncStorage** (encrypted by OS)
✅ **Refresh tokens are never exposed to client**
✅ **Access tokens have short expiry (1 hour default)**
✅ **Refresh tokens are refreshed automatically**
✅ **Session has absolute expiration (30 days)**
✅ **No hardcoded secrets in code**

⚠️ **Remember:**
- Never log tokens in production
- Never expose tokens in error messages
- Always validate session on app foreground
- Clear session on logout immediately

## Future Enhancements

1. **Biometric Authentication**
   - Unlock app with fingerprint/face on day 2-30
   - Require full authentication on day 31+

2. **Session Activity Dashboard**
   - Show user when session expires
   - Warning before expiration

3. **Multiple Device Support**
   - Invalidate sessions on other devices
   - Show active sessions

4. **Geolocation-based Refresh**
   - Require re-auth if location changes significantly

---

**Questions?** Check `src/utils/sessionManager.js` for detailed implementation.
