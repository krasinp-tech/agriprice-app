// frontend/js/config.js
// ใช้สำหรับตั้งค่า API_BASE_URL และ config อื่นๆ
(() => {
	if (typeof window.AGRIPRICE_CONFIG_LOADED !== 'undefined') return;
	window.AGRIPRICE_CONFIG_LOADED = true;

	// Storage can be unavailable in privacy-restricted browsers or embedded webviews.
	// Keep configuration bootable and let native preferences continue to work.
	const storageGet = (key) => {
		try { return window.localStorage.getItem(key); } catch (_) { return null; }
	};
	const storageSet = (key, value) => {
		try { window.localStorage.setItem(key, value); return true; } catch (_) { return false; }
	};
	const storageRemove = (key) => {
		try { window.localStorage.removeItem(key); return true; } catch (_) { return false; }
	};

	const DEFAULT_URL = (() => {
		const normalize = (v) => String(v || '').replace(/\/$/, '');

		// 1. Manual override from localStorage (Highest priority)
		try {
			const runtimeBase = storageGet('agriprice_api_base_url');
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
		const useLocalApi = storageGet('agriprice_use_local') === '1';

		if (useLocalApi) {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Local API override enabled: Using http://localhost:5000');
			return 'http://localhost:5000';
		}

		if (isNative) {
			if (window.AGRIPRICE_DEBUG) console.log('[config] Native app detected: Using Production API');
			return 'https://agriprice-app.onrender.com';
		}

		// Default to Production Render
		if (window.AGRIPRICE_DEBUG) console.log('[config] Defaulting to Production API: https://agriprice-app.onrender.com');
		return 'https://agriprice-app.onrender.com';
	})();

	window.API_BASE_URL = window.API_BASE_URL || DEFAULT_URL;
	window.AGRIPRICE_DEBUG = window.AGRIPRICE_DEBUG ?? (
		new URLSearchParams(window.location.search).has('debug') || 
		storageGet('agriprice_debug') === '1'
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
		LANGUAGE: 'lang',
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

	const savedTheme = storageGet('agriprice_theme');
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

	// --- CAPACITOR NATIVE RUNTIME ---
	// Centralized optional enhancements. Every method safely falls back on web.
	window.NativeRuntime = window.NativeRuntime || (() => {
		const plugins = () => window.Capacitor?.Plugins || {};
		const isNative = () => {
			const cap = window.Capacitor;
			if (!cap) return false;
			if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
			const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
			return platform === 'android' || platform === 'ios' || !!cap.isNative;
		};

		const PREFERENCE_KEYS = ['agriprice_theme', 'lang', 'location'];
		let initialized = false;

		async function setPreference(key, value) {
			if (value == null) storageRemove(key);
			else storageSet(key, String(value));
			if (!isNative() || !plugins().Preferences) return;
			try {
				if (value == null) await plugins().Preferences.remove({ key });
				else await plugins().Preferences.set({ key, value: String(value) });
			} catch (_) {}
		}

		async function hydratePreferences() {
			if (!isNative() || !plugins().Preferences) return;
			for (const key of PREFERENCE_KEYS) {
				try {
					const { value } = await plugins().Preferences.get({ key });
					const webValue = storageGet(key);
					if (value != null) storageSet(key, value);
					else if (webValue != null) await plugins().Preferences.set({ key, value: webValue });
				} catch (_) {}
			}

			const restoredTheme = storageGet('agriprice_theme');
			if (restoredTheme) document.documentElement.setAttribute('data-theme', restoredTheme);
			window.dispatchEvent(new CustomEvent('agriprice:preferences-ready'));
		}

		async function applySystemBars(theme) {
			if (!isNative() || !plugins().StatusBar) return;
			try {
				await plugins().StatusBar.setStyle({ style: theme === 'dark' ? 'LIGHT' : 'DARK' });
			} catch (_) {}
		}

		async function share(options = {}) {
			const payload = {
				title: options.title || 'AGRIPRICE',
				text: options.text || '',
				url: options.url || window.location.href,
				dialogTitle: options.dialogTitle || 'แชร์ผ่าน'
			};
			if (plugins().Share) return plugins().Share.share(payload);
			if (navigator.share) return navigator.share(payload);
			if (navigator.clipboard && payload.url) {
				await navigator.clipboard.writeText(payload.url);
				return { activityType: 'clipboard' };
			}
			return null;
		}

		async function init() {
			if (initialized) return;
			initialized = true;
			await hydratePreferences();

			const { Network, Keyboard, SplashScreen } = plugins();
			if (isNative() && Network) {
				const applyNetwork = (status) => {
					document.documentElement.classList.toggle('is-offline', !status.connected);
					window.dispatchEvent(new CustomEvent('agriprice:native-network', { detail: status }));
				};
				try {
					applyNetwork(await Network.getStatus());
					await Network.addListener('networkStatusChange', applyNetwork);
				} catch (_) {}
			}

			if (isNative() && Keyboard) {
				try {
					await Keyboard.addListener('keyboardWillShow', (info) => {
						document.documentElement.classList.add('keyboard-open');
						document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight || 0}px`);
						setTimeout(() => document.activeElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 80);
					});
					await Keyboard.addListener('keyboardWillHide', () => {
						document.documentElement.classList.remove('keyboard-open');
						document.documentElement.style.setProperty('--keyboard-height', '0px');
					});
				} catch (_) {}
			}

			await applySystemBars(document.documentElement.getAttribute('data-theme') || 'light');
			if (isNative() && SplashScreen) {
				try { await SplashScreen.hide(); } catch (_) {}
			}
		}

		return { init, isNative, setPreference, applySystemBars, share };
	})();
	window.shareAgriPrice = (options) => window.NativeRuntime.share(options);

	const startNativeRuntime = () => window.NativeRuntime.init();
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', startNativeRuntime, { once: true });
	} else {
		startNativeRuntime();
	}
})();
