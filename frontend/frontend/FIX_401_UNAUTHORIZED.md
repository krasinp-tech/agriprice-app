# Fix 401 Unauthorized Error Guide

## Problem Analysis

### Error Symptoms:
```
GET http://localhost:5000/api/favorites 401 (Unauthorized)
GET http://localhost:5000/api/bookings 401 (Unauthorized)
```

### Root Causes:

1. **Token Not in localStorage** - User hasn't logged in yet
2. **Token Expired** - Session has expired
3. **Missing Authorization Header** - Some code wasn't sending the token
4. **Invalid JWT_SECRET** - Server couldn't verify the token

### Why It Happens:

- `components.js:495` - syncFavoritesFromApi() runs on page load before user logs in
- `booking.js:12` - fetchBookings() called before authentication
- Both endpoints require authentication (protected with `auth` middleware)

---

## Changes Made

### 1. ✅ api-client.js
**Added:**
- `getFavorites()` - Fetch user's favorite sellers
- `addFavorite(id)` - Add to favorites
- `removeFavorite(id)` - Remove from favorites
- `isLoggedIn()` - Helper to check if user is authenticated

```javascript
const isLoggedIn = () => !!getToken();
const getFavorites   = () => call('GET',    '/api/favorites');
const addFavorite    = id => call('POST',   '/api/favorites', { target_user_id: id });
const removeFavorite = id => call('DELETE', '/api/favorites/'+encodeURIComponent(id));
```

### 2. ✅ components.js - syncFavoritesFromApi()
**Added:**
- Check if user is logged in before calling API
- Better error handling for 401 responses
- Console logs for debugging

```javascript
// Only sync if logged in
if (!API_BASE || !token) {
  console.log('[syncFavoritesFromApi] Skipped (not logged in)');
  return;
}

// Handle 401 responses
if (r.status === 401) {
  console.warn('[syncFavoritesFromApi] Token expired or invalid');
  return null;
}
```

### 3. ✅ farmer/booking/booking.js - fetchBookings()
**Added:**
- User logged-in check
- 401 redirect to login page
- Better error handling and logging
- Separated error messages for different scenarios

### 4. ✅ buyer/setbooking/booking.js - fetchBookings()
**Same improvements as farmer booking.js**

---

## How Authentication Works

### Token Flow:

```
1. User Login (pages/auth/login1.html)
   ↓
2. POST /api/auth/login {phone, password}
   ↓
3. Server returns: {token: "eyJ...", user: {...}}
   ↓
4. Frontend saves to localStorage:
   localStorage.setItem('token', token);
   localStorage.setItem('user', JSON.stringify(user));
   ↓
5. All subsequent API calls include:
   headers: { 'Authorization': 'Bearer ' + token }
   ↓
6. Server validates token with JWT_SECRET from .env
```

### Protected Endpoints (require auth):

```javascript
app.get('/api/favorites', auth, ...)       // ✅ Requires token
app.get('/api/bookings', auth, ...)        // ✅ Requires token
app.get('/api/profile', auth, ...)         // ✅ Requires token
app.get('/api/notifications', auth, ...)   // ✅ Requires token
```

### Public Endpoints (no auth):

```javascript
app.post('/api/auth/otp/send', ...)        // ❌ No auth needed
app.post('/api/auth/otp/verify', ...)      // ❌ No auth needed
app.get('/api/products', ...)              // ❌ No auth needed
app.get('/api/search', ...)                // ❌ No auth needed
```

---

## Testing the Fix

### 1. Test Normal Flow (Login → Access API):

```javascript
// 1. Login
await api.login('0812345678', 'password123');
// Token saved to localStorage

// 2. Now this works:
const favorites = await api.getFavorites();
const bookings = await api.getBookings();
```

Check browser console:
- ✅ No 401 errors
- ✅ `[syncFavoritesFromApi] ✅ API response:` log appears
- ✅ Bookings load successfully

### 2. Test Not Logged In:

```javascript
// Clear localStorage
localStorage.clear();

// Reload page - should not show errors
location.reload();
```

Check browser console:
- ✅ `[syncFavoritesFromApi] ⏭️  Skipped (not logged in)` - No 401 error
- ✅ Graceful handling

### 3. Test Expired Token:

```javascript
// Set old/invalid token
localStorage.setItem('token', 'expired_token_here');

// Reload page
location.reload();
```

Check browser console:
- ✅ `[syncFavoritesFromApi] ⚠️  Token expired or invalid`
- ✅ Redirects to login page after attempting API calls

### 4. Check DevTools:

1. Open **Chrome DevTools** > **Application** tab
2. Check **LocalStorage**:
   ```
   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
   user: `{"id":"...", "phone":"...", "role":"..."}`
   role: "farmer" or "buyer"
   ```
3. Open **Network** tab
4. Make API call and verify headers:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
   ```

---

## Debugging 401 Errors

### Step 1: Check if user is logged in
```javascript
console.log('Token:', localStorage.getItem('token'));
console.log('User:', localStorage.getItem('user'));
```

### Step 2: Verify token format
```javascript
// Should start with "eyJ"
const token = localStorage.getItem('token');
console.log('Valid token format?', token?.startsWith('eyJ'));
```

### Step 3: Check JWT_SECRET on server
```bash
# In server/.env
echo $JWT_SECRET
```

Should output something like:
```
dfsdfsdhfsihdoifshdoihsodifhsoidhfosidjksjndihjsdofihsodifhspdofpsodf
```

### Step 4: Test with postman
```
GET http://localhost:5000/api/favorites

Headers:
Authorization: Bearer <YOUR_TOKEN>

Response should be:
200 OK with favorites array
OR
401 if token invalid
```

### Step 5: Check server logs
```bash
# Terminal running server.js
npm run dev

# Should see logs like:
[auth] ✅ Token verified
[auth] ❌ Token expired
[auth] ❌ Token invalid
```

---

## Prevention Checklist

- ✅ Always check `api.isLoggedIn()` before API calls
- ✅ Handle 401 responses → redirect to login
- ✅ Add error messages for user feedback
- ✅ Only call protected endpoints **after** successful login
- ✅ Don't hardcode token values in code
- ✅ Clear token on logout: `api.logout()`
- ✅ Test token expiry scenarios

---

## Files Modified:
1. `/frontend/js/api-client.js` - Added favorites methods + isLoggedIn()
2. `/frontend/js/components.js` - Added login check before syncFavoritesFromApi()
3. `/frontend/js/farmer/booking/booking.js` - Added authentication checks + 401 handling
4. `/frontend/js/buyer/setbooking/booking.js` - Added authentication checks + 401 handling

---

**Status:** ✅ FIXED - 401 errors should no longer appear for unauthenticated users
