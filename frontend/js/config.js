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
		const cap = window.Capacitor;
		const capPlatform = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : '';
		const isNative = (
			window.location.protocol === 'capacitor:' || 
			window.location.protocol === 'ionic:' ||
			(window.Capacitor && window.Capacitor.isNative) ||
			capPlatform === 'android' ||
			capPlatform === 'ios' ||
			!!cap?.isNative
		);
		const useLocalApi = localStorage.getItem('agriprice_use_local') === '1';

		if (isNative && !useLocalApi) {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Native app detected: Using Production API');
			return 'https://agriprice-app.onrender.com';
		}

		// Auto-detect local development (localhost, 127.0.0.1, file protocol, or local network IP)
		const isLocal = (
			(hostname === 'localhost' || hostname === '127.0.0.1') && 
			(window.location.port !== '' && window.location.port !== '80' && window.location.port !== '443') ||
			hostname.startsWith('192.168.') || 
			protocol === 'file:'
		);

		if (isLocal || useLocalApi) {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Local environment detected: Using http://localhost:5000');
			return 'http://localhost:5000';
		}

		// Default to Production Render
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
		ROLE: window.AUTH_ROLE_KEY,
		THEME: 'agriprice_theme',
		LANGUAGE: 'language',
		AVATAR: (role) => `profile_avatar_dataurl_${role || 'guest'}`,
		PROFILE: (role) => `myprofile_data_${role || 'guest'}`
	};

	// --- FIREBASE CONFIGURATION (MATCHING WEB CONSOLE) ---
	// Note: Firebase config is exposed in frontend as required by Firebase Web SDK.
	// This is standard practice - Firebase config is not sensitive, actual security is enforced by Firebase rules.
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

	// Define global resolve helper functions to prevent ReferenceErrors
	window.resolveUserId = function(...ids) {
		for (const id of ids) {
			if (id !== undefined && id !== null && String(id).trim() !== '') {
				return String(id);
			}
		}
		return '';
	};
	window.resolveProfileId = window.resolveUserId;
})();
