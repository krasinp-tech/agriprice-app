// frontend/js/config.js
// ใช้สำหรับตั้งค่า API_BASE_URL และ config อื่นๆ
const DEFAULT_API_BASE_URL = (() => {
	const { protocol = '', origin = '', hostname = '' } = window.location || {};
	const normalize = (v) => String(v || '').replace(/\/$/, '');

	// Allow overriding backend URL at runtime without rebuilding app.
	try {
		const runtimeBase = localStorage.getItem('agriprice_api_base_url');
		if (runtimeBase) return normalize(runtimeBase);
	} catch (_) {
		// no-op if storage is unavailable
	}

	if (window.__AGRIPRICE_API_BASE_URL__) {
		return normalize(window.__AGRIPRICE_API_BASE_URL__);
	}

	// Prefer the deployed backend URL for APK/runtime use.
	const CLOUD_API_BASE_URL = 'https://agriprice-app.onrender.com';
	if (CLOUD_API_BASE_URL) {
		return normalize(CLOUD_API_BASE_URL);
	}

	if (/^https?:$/i.test(protocol) && /^(localhost|127\.0\.0\.1)$/i.test(hostname)) {
		return 'http://localhost:5000';
	}
	if (/^https?:$/i.test(protocol) && origin) {
		return origin;
	}

	return 'https://agriprice.com';
})();
window.API_BASE_URL = window.API_BASE_URL || DEFAULT_API_BASE_URL;
window.AGRIPRICE_DEBUG = window.AGRIPRICE_DEBUG ?? (
	new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('agriprice_debug') === '1'
);

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
				const res = await withTimeout(fetch(url), 4000);
				if (!res.ok) continue;
				const json = await res.json();
				if (json && json.success && json.data && json.data.firebase && json.data.firebase.apiKey) {
					window.FIREBASE_CONFIG = json.data.firebase;
					window.APP_CONFIG_ERROR = null;
					window.APP_CONFIG_SOURCE = 'server';
					if (window.AGRIPRICE_DEBUG) console.log('[config] loaded firebase config from', url);
					return;
				}
			} catch (_) {
				// try next candidate
			}
		}

		window.FIREBASE_CONFIG = FALLBACK_FIREBASE_CONFIG;
		window.APP_CONFIG_ERROR = null;
		window.APP_CONFIG_SOURCE = 'fallback';
		if (window.AGRIPRICE_DEBUG) console.warn('[config] server config unavailable, using fallback firebase config');
	} catch (_) {
		window.FIREBASE_CONFIG = FALLBACK_FIREBASE_CONFIG;
		window.APP_CONFIG_ERROR = null;
		window.APP_CONFIG_SOURCE = 'fallback';
		if (window.AGRIPRICE_DEBUG) console.warn('[config] unexpected loader error, using fallback firebase config');
	}
})();
// เพิ่ม config อื่นๆ ได้ที่นี่
