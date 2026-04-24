// frontend/js/config.js
// ใช้สำหรับตั้งค่า API_BASE_URL และ config อื่นๆ
const DEFAULT_API_BASE_URL = (() => {
	const { protocol = '', origin = '', hostname = '' } = window.location || {};
	const normalize = (v) => String(v || '').replace(/\/$/, '');

	// 1. Manual override from localStorage (Highest priority)
	try {
		const runtimeBase = localStorage.getItem('agriprice_api_base_url');
		if (runtimeBase) return normalize(runtimeBase);
	} catch (_) {}

	// 2. Localhost detection (ปิดถาวร เพื่อให้เครื่อง Local เด้งไปใช้ Backend บน Render ตลอดเวลา)
	// เวลานี้เพื่อนหรือใครก๊อบไปรันที่เครื่องก็จะใช้ Backend ตัวนี้แบบออนไลน์
	// const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname) || protocol === 'file:';
	
	// if (isLocal) {
	// 	console.log('[config] Local environment detected. Targeting localhost backend.');
	// 	return 'http://localhost:5000';
	// }

	// 3. Deployed backend URL (Production)
	const CLOUD_API_BASE_URL = 'https://agriprice-app.onrender.com';
	if (CLOUD_API_BASE_URL) {
		return normalize(CLOUD_API_BASE_URL);
	}

	// 4. Default fallback
	return origin || 'https://agriprice-app.onrender.com';
})();
window.API_BASE_URL = window.API_BASE_URL || DEFAULT_API_BASE_URL;
window.AGRIPRICE_DEBUG = window.AGRIPRICE_DEBUG ?? (
	new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('agriprice_debug') === '1'
);
console.log('%c[AgriPrice] Build: 2026.04.24.01 (APK-Fix) %c✅', 'color: #0B853C; font-weight: bold;', 'color: green;');

const FALLBACK_FIREBASE_CONFIG = {
	apiKey: 'AIzaSyBUdCFBGSS0S1bbmsvJM7Lc3b4S2kNt5SE',
	authDomain: 'agriprice-otp.firebaseapp.com',
	projectId: 'agriprice-otp',
	storageBucket: 'agriprice-otp.firebasestorage.app',
	messagingSenderId: '198488898047',
	appId: '1:198488898047:web:df3b694f4d0aa35ad6cfca',
	measurementId: 'G-4R11E179LR',
};
window.APP_CONFIG_ERROR = null;
window.APP_CONFIG_SOURCE = 'pending';

window.APP_CONFIG_READY = window.APP_CONFIG_READY || (async function loadPublicConfig() {
	const base = (window.API_BASE_URL || '').replace(/\/$/, '');
	const candidates = [];
	if (base) candidates.push(base + '/api/public-config');
	candidates.push('/api/public-config');

	const withTimeout = (promise, ms) => Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
	]);

	try {
		for (const url of candidates) {
			try {
				if (window.AGRIPRICE_DEBUG) console.log('[config] fetching config from:', url);
				const res = await withTimeout(fetch(url), 5000);
				if (!res.ok) {
					console.warn(`[config] fetch failed (${res.status}) for:`, url);
					continue;
				}
				const json = await res.json();
				if (json && json.success && json.data && json.data.firebase && json.data.firebase.apiKey) {
					window.FIREBASE_CONFIG = json.data.firebase;
					window.APP_CONFIG_ERROR = null;
					window.APP_CONFIG_SOURCE = 'server';
					console.log('[config] ✅ Successfully loaded firebase config from:', url);
					return;
				}
			} catch (err) {
				console.warn(`[config] connection failed for ${url}:`, err.message);
				// try next candidate
			}
		}

		console.warn('[config] ⚠️ No server config available. Falling back to internal defaults.');
		window.FIREBASE_CONFIG = FALLBACK_FIREBASE_CONFIG;
		window.APP_CONFIG_ERROR = null;
		window.APP_CONFIG_SOURCE = 'fallback';
	} catch (err) {
		console.error('[config] ❌ Critical loader error:', err);
		window.FIREBASE_CONFIG = FALLBACK_FIREBASE_CONFIG;
		window.APP_CONFIG_ERROR = null;
		window.APP_CONFIG_SOURCE = 'fallback';
	}
})();
// เพิ่ม config อื่นๆ ได้ที่นี่
