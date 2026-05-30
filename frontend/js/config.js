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
			const runtimeBase = localStorage.getItem('agriprice_api_base_url');
			if (runtimeBase) {
				if (window.AGRIPRICE_DEBUG) console.log('[config] Using manual override API URL:', runtimeBase);
				return normalize(runtimeBase);
			}
		} catch (_) {}

		// 2. Environment detection
		const isNative = (
			window.location.protocol === 'capacitor:' || 
			window.location.protocol === 'ionic:' ||
			(window.Capacitor && window.Capacitor.isNative)
		);

		// If we explicitly want to use local server for development
		if (localStorage.getItem('agriprice_use_local') === '1') {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Manual override: Using localhost:5000');
			return 'http://localhost:5000';
		}

		// For development (localhost), default to local backend at http://localhost:5000
		if (hostname === 'localhost' || hostname === '127.0.0.1') {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Development mode: Using localhost:5000');
			return 'http://localhost:5000';
		}

		// For native apps (Capacitor), use production Render
		if (isNative) {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Native app: Using Production API: https://agriprice-app.onrender.com');
			return 'https://agriprice-app.onrender.com';
		}

		// Default to production Render
		if (window.AGRIPRICE_DEBUG) console.log('[config] Defaulting to Production API: https://agriprice-app.onrender.com');
		return 'https://agriprice-app.onrender.com';
	})();

	window.API_BASE_URL = window.API_BASE_URL || DEFAULT_URL;
	window.AGRIPRICE_DEBUG = window.AGRIPRICE_DEBUG ?? (
		new URLSearchParams(window.location.search).has('debug') || 
		localStorage.getItem('agriprice_debug') === '1'
	);

	// Helper function for other scripts to get the latest API URL
	window.getAgriPriceApiUrl = () => (window.API_BASE_URL || '').replace(/\/$/, '');

	// Global Storage Keys
	window.AUTH_TOKEN_KEY = 'token';
	window.AUTH_USER_KEY  = 'user_data';
	window.AUTH_ROLE_KEY  = 'role';
	window.STORAGE_KEYS   = {
		TOKEN: window.AUTH_TOKEN_KEY,
		USER_DATA: window.AUTH_USER_KEY,
		ROLE: window.AUTH_ROLE_KEY
	};

	// --- FIREBASE CONFIGURATION (MATCHING WEB CONSOLE) ---
	const FALLBACK_FIREBASE = {
		apiKey: 'AIzaSyBUdCFBGSS0S1bbmsvJM7Lc3b4S2kNt5SE',
		authDomain: 'agriprice-otp.firebaseapp.com',
		projectId: 'agriprice-otp',
		storageBucket: 'agriprice-otp.firebasestorage.app',
		messagingSenderId: '198488898047',
		appId: '1:198488898047:web:df3b694f4d0aa35ad6cfca', 
		measurementId: 'G-4R11E179LR'
	};

	// Set initial config immediately
	window.FIREBASE_CONFIG = FALLBACK_FIREBASE;
	window.APP_CONFIG_SOURCE = 'initial';

	window.APP_CONFIG_READY = window.APP_CONFIG_READY || (async function loadPublicConfig() {
		const base = (window.API_BASE_URL || '').replace(/\/$/, '');
		const PRODUCTION_URL = 'https://agriprice-app.onrender.com';
		
		if (base === PRODUCTION_URL) {
			window.APP_CONFIG_SOURCE = 'production';
			return;
		}

		const candidates = [];
		if (base && !base.startsWith('/')) candidates.push(base + '/api/public-config');
		candidates.push(PRODUCTION_URL + '/api/public-config');

		const withTimeout = (promise, ms) => Promise.race([
			promise,
			new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
		]);

		for (const url of candidates) {
			try {
				const res = await withTimeout(fetch(url), 3000);
				if (res.ok) {
					const json = await res.json();
					if (json && json.success && json.data && json.data.firebase) {
						window.FIREBASE_CONFIG = json.data.firebase;
						window.APP_CONFIG_SOURCE = 'server';
						return;
					}
				}
			} catch (err) {}
		}
	})();

	window.FRONTEND_URL = window.FRONTEND_URL || (() => {
		if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') {
			return 'https://agriprice-otp.web.app';
		}
		return window.location.origin;
	})();

	const savedTheme = localStorage.getItem('agriprice_theme');
	const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const themeToApply = savedTheme || (systemDark ? 'dark' : 'light');
	document.documentElement.setAttribute('data-theme', themeToApply);
})();
