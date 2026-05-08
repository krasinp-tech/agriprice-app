// frontend/js/config.js
// ใช้สำหรับตั้งค่า API_BASE_URL และ config อื่นๆ
(() => {
	if (typeof window.AGRIPRICE_CONFIG_LOADED !== 'undefined') return;
	window.AGRIPRICE_CONFIG_LOADED = true;

	const DEFAULT_URL = (() => {
		const { protocol = '', origin = '', hostname = '' } = window.location || {};
		const normalize = (v) => String(v || '').replace(/\/$/, '');

		// 1. Manual override from localStorage (Highest priority)
		try {
			// [FIXED] Removed the code that auto-deleted localhost from localStorage 
			// to allow developers to manually set their local IP (e.g. http://192.168.1.50:5000)
			const runtimeBase = localStorage.getItem('agriprice_api_base_url');
			if (runtimeBase) {
				if (window.AGRIPRICE_DEBUG) console.log('[config] Using manual override API URL:', runtimeBase);
				return normalize(runtimeBase);
			}
		} catch (_) {}

		// 2. Environment detection
		// [FIXED] Better detection for Capacitor/Native environments
		const isNative = (
			window.location.protocol === 'capacitor:' || 
			window.location.protocol === 'ionic:' ||
			(window.Capacitor && window.Capacitor.isNative) ||
			// In Android APK, hostname is often 'localhost' but there is NO PORT
			((hostname === 'localhost' || hostname === '127.0.0.1') && !window.location.port)
		);

		const isDevServer = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname) && window.location.port;
		
		if (isDevServer && !isNative) {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Local development detected (Browser). Targeting Render: https://agriprice-app.onrender.com');
			return 'https://agriprice-app.onrender.com';
		}

		// Always use Render for production/external access or Native APK
		if (window.AGRIPRICE_DEBUG) console.log('[config] Native/Production environment. Targeting Render: https://agriprice-app.onrender.com');
		return 'https://agriprice-app.onrender.com';
	})();

	window.API_BASE_URL = window.API_BASE_URL || DEFAULT_URL;
	window.AGRIPRICE_DEBUG = window.AGRIPRICE_DEBUG ?? (
		new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('agriprice_debug') === '1'
	);

	// Helper function for other scripts to get the latest API URL
	window.getAgriPriceApiUrl = () => (window.API_BASE_URL || '').replace(/\/$/, '');

	// Global Storage Keys - used by all modules to prevent conflicts
	window.AUTH_TOKEN_KEY = 'token';
	window.AUTH_USER_KEY  = 'user_data';
	window.AUTH_ROLE_KEY  = 'role';
	window.STORAGE_KEYS   = {
		TOKEN: window.AUTH_TOKEN_KEY,
		USER_DATA: window.AUTH_USER_KEY,
		ROLE: window.AUTH_ROLE_KEY
	};

	if (typeof window.CONFIG_INITIALIZED === 'undefined') {
		window.CONFIG_INITIALIZED = true;
	}

	const FALLBACK_FIREBASE = {
		apiKey: 'AIzaSyBUdCFBGSS0S1bbmsvJM7Lc3b4S2kNt5SE',
		authDomain: 'agriprice-otp.firebaseapp.com',
		projectId: 'agriprice-otp',
		storageBucket: 'agriprice-otp.firebasestorage.app',
		messagingSenderId: '198488898047',
		appId: '1:198488898047:web:df3b694f4d0aa35ad6cfca',
		measurementId: 'G-4R11E179LR',
	};

	window.APP_CONFIG_READY = window.APP_CONFIG_READY || (async function loadPublicConfig() {
		const base = (window.API_BASE_URL || '').replace(/\/$/, '');
		const candidates = [];
		const PRODUCTION_URL = 'https://agriprice-app.onrender.com';
		
		// If already on Render (e.g. APK), resolve immediately
		if (base === PRODUCTION_URL) {
			window.FIREBASE_CONFIG = FALLBACK_FIREBASE;
			window.APP_CONFIG_SOURCE = 'production';
			return;
		}

		if (base && !base.startsWith('/')) {
			candidates.push(base + '/api/public-config');
		}
		
		// Add Render as fallback if not already primary
		candidates.push(PRODUCTION_URL + '/api/public-config');

		if (window.location.port !== '5500' && window.location.port !== '5000') {
			candidates.push('/api/public-config');
		}

		const withTimeout = (promise, ms) => Promise.race([
			promise,
			new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
		]);

		try {
			// Skip local if already failed in this session
			const localFailed = sessionStorage.getItem('agriprice_local_failed');
			
			for (const url of candidates) {
				try {
					if (url.includes('127.0.0.1') && localFailed) continue;

					if (window.AGRIPRICE_DEBUG) console.log('[config] checking config at:', url);
					// Fast check: if fetch fails (e.g. refused), it throws immediately
					const res = await withTimeout(fetch(url), 3000);
					if (!res.ok) {
						if (url.includes('127.0.0.1')) sessionStorage.setItem('agriprice_local_failed', '1');
						continue;
					}
					const json = await res.json();
					if (json && json.success && json.data && json.data.firebase) {
						window.FIREBASE_CONFIG = json.data.firebase;
						window.APP_CONFIG_SOURCE = 'server';
						
						// If we switched to Render, update the global base URL
						if (url.startsWith(PRODUCTION_URL) && window.API_BASE_URL !== PRODUCTION_URL) {
							window.API_BASE_URL = PRODUCTION_URL;
						}
						return;
					}
				} catch (err) {
					if (url.includes('127.0.0.1')) sessionStorage.setItem('agriprice_local_failed', '1');
				}
			}
			window.FIREBASE_CONFIG = FALLBACK_FIREBASE;
			window.APP_CONFIG_SOURCE = 'fallback';
		} catch (err) {
			window.FIREBASE_CONFIG = FALLBACK_FIREBASE;
			window.APP_CONFIG_SOURCE = 'fallback';
		}
	})();

	window.FRONTEND_URL = window.FRONTEND_URL || (() => {
		if (window.APP_CONFIG?.FRONTEND_URL) return window.APP_CONFIG.FRONTEND_URL;
		if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') {
			return 'https://agriprice-otp.web.app';
		}
		return window.location.origin;
	})();

	// Theme - Improved system detection
	const savedTheme = localStorage.getItem('agriprice_theme');
	const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const themeToApply = savedTheme || (systemDark ? 'dark' : 'light');
	document.documentElement.setAttribute('data-theme', themeToApply);
})();


