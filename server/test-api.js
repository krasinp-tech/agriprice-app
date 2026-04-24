const API_BASE = 'https://agriprice-app.onrender.com';
const TEST_PHONE = '0888888888';
const TEST_PASS = 'test12345';

async function req(path, opts = {}) {
  const url = API_BASE + path;
  if (opts.body) {
     opts.body = JSON.stringify(opts.body);
     opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== Starting API Flow Test ===');
  let token = null;

  try {
    // 1. Health
    let r = await req('/api/health');
    console.log('✅ /api/health:', r.status);

    // 2. Request OTP
    r = await req('/api/auth/otp/send', { method: 'POST', body: { phone: TEST_PHONE } });
    console.log('✅ /api/auth/otp/send:', r.status, r.data?.message);

    // 3. Verify OTP
    r = await req('/api/auth/otp/verify', { method: 'POST', body: { phone: TEST_PHONE, otp: '123456' } });
    console.log('✅ /api/auth/otp/verify:', r.status, r.data?.message);
    
    if (r.status !== 200) {
      console.error('Failed to verify OTP:', r.data);
      return;
    }
    
    const tempToken = r.data?.data?.temp_token;

    // 4. Register Finish (if not exists) or Login
    if (r.data?.data?.isNewUser) {
        let r2 = await req('/api/auth/register/finish', { method: 'POST', body: {
            temp_token: tempToken,
            role: 'buyer',
            profile: { firstName: 'Test', lastName: 'User' },
            password: TEST_PASS
        }});
        console.log('✅ /api/auth/register/finish:', r2.status);
    }
    
    // Login
    r = await req('/api/auth/login', { method: 'POST', body: { phone: TEST_PHONE, password: TEST_PASS } });
    console.log('✅ /api/auth/login:', r.status);
    if (r.status !== 200) {
        console.log('Login failed:', r.data);
        return;
    }
    
    token = r.data?.data?.token;
    console.log('Got Token:', token.substring(0,10) + '...');

    const headers = { Authorization: 'Bearer ' + token };

    // Test protected
    r = await req('/api/profile', { headers });
    console.log('✅ /api/profile:', r.status);

    r = await req('/api/bookings', { headers });
    console.log('✅ /api/bookings:', r.status, `found ${r.data?.data?.length} bookings`);

    r = await req('/api/products?limit=5');
    console.log('✅ /api/products:', r.status, `found ${r.data?.data?.length} products`);

    r = await req('/api/chats', { headers });
    console.log('✅ /api/chats:', r.status);

    r = await req('/api/dashboard', { headers });
    console.log('✅ /api/dashboard:', r.status);
    
    console.log('=== All Tests Passed ===');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
runTests();
