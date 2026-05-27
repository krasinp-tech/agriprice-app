/*
Simple test script to simulate follow -> notification flow.
Usage (from repo root):
  node scripts/test-follow-notification.js

Requires env vars:
  API_BASE (default http://localhost:5000)
  FOLLOWER_EMAIL
  FOLLOWER_PASSWORD
  TARGET_EMAIL
  TARGET_PASSWORD

The script will:
  - login follower and target to obtain tokens
  - resolve target's profile id via GET /api/profile (for target)
  - call POST /api/follow/:targetId with follower token
  - poll GET /api/notifications with target token and check for a 'follow' notification
*/

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const fetch = global.fetch || require('node-fetch');

async function login(email, password) {
  const resp = await fetch(API_BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_or_email: email, password })
  });
  const j = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error('Login failed: ' + (j?.message || resp.status));
  return j.data || j;
}

async function getProfile(token) {
  const resp = await fetch(API_BASE + '/api/profile', { headers: { Authorization: 'Bearer ' + token } });
  const j = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error('Get profile failed: ' + (j?.message || resp.status));
  return j.data || j;
}

async function follow(targetId, token) {
  const resp = await fetch(`${API_BASE}/api/follow/${encodeURIComponent(targetId)}`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }
  });
  const j = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error('Follow failed: ' + (j?.message || resp.status));
  return j;
}

async function getNotifications(token) {
  const resp = await fetch(API_BASE + '/api/notifications', { headers: { Authorization: 'Bearer ' + token } });
  const j = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error('Get notifications failed: ' + (j?.message || resp.status));
  return j.data || j;
}

(async () => {
  try {
    const followerEmail = process.env.FOLLOWER_EMAIL;
    const followerPass = process.env.FOLLOWER_PASSWORD;
    const targetEmail = process.env.TARGET_EMAIL;
    const targetPass = process.env.TARGET_PASSWORD;
    if (!followerEmail || !followerPass || !targetEmail || !targetPass) {
      console.error('Please set FOLLOWER_EMAIL, FOLLOWER_PASSWORD, TARGET_EMAIL and TARGET_PASSWORD');
      process.exit(1);
    }

    console.log('Logging in follower...');
    const follower = await login(followerEmail, followerPass);
    const followerToken = follower?.token || follower?.access_token || follower?.data?.token;
    if (!followerToken) throw new Error('No token from follower login');

    console.log('Logging in target...');
    const target = await login(targetEmail, targetPass);
    const targetToken = target?.token || target?.access_token || target?.data?.token;
    if (!targetToken) throw new Error('No token from target login');

    console.log('Resolving target profile id...');
    const targetProfile = await getProfile(targetToken);
    const targetId = targetProfile?.profile_id || targetProfile?.id;
    if (!targetId) throw new Error('Cannot resolve target profile id');

    console.log('Performing follow...');
    await follow(targetId, followerToken);
    console.log('Followed. Polling notifications for target...');

    let found = false;
    for (let i = 0; i < 10; i++) {
      const notes = await getNotifications(targetToken);
      const recent = Array.isArray(notes) ? notes : (notes.data || []);
      if (recent && recent.length) {
        const match = recent.find(n => String(n.type || '').toLowerCase() === 'follow');
        if (match) {
          console.log('Found follow notification:', match);
          found = true;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!found) console.error('Follow notification not found within timeout');
    process.exit(found ? 0 : 2);
  } catch (err) {
    console.error('Test failed:', err.message || err);
    process.exit(3);
  }
})();
