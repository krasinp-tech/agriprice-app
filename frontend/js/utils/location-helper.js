/**
 * frontend/js/utils/location-helper.js
 * 
 * Centralized utility for location-based features in AgriPrice.
 * Handles GPS requests, Haversine distance calculation, and formatting.
 */

(function() {
    'use strict';

    /**
     * Haversine formula to calculate distance between two points in km.
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
        
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Formats distance into a human-readable string (Thai).
     */
    function formatDistance(km) {
        if (km == null || isNaN(km)) return 'ระยะทาง - กม.';
        if (km < 1) {
            return `ระยะทาง ${Math.round(km * 1000)} ม.`;
        }
        return `ระยะทาง ${km.toFixed(1)} กม.`;
    }

    /**
     * Robustly get user location using AgriPermission or Geolocation API.
     */
    async function getUserLocation() {
        const DEBUG = !!window.AGRIPRICE_DEBUG;
        
        try {
            // 1. Try AgriPermission (standard for the app)
            if (window.AgriPermission) {
                const res = await window.AgriPermission.requestLocation();
                if (res.granted && res.position) {
                    const coords = res.position.coords || res.position;
                    return { lat: coords.latitude, lng: coords.longitude };
                }
                
                if (res.granted && !res.position) {
                    const Geo = window.Capacitor?.Plugins?.Geolocation;
                    if (Geo) {
                        const pos = await Geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
                        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    }
                }
            }

            // 2. Fallback to browser Geolocation
            if (navigator.geolocation) {
                return new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
                        () => resolve(null),
                        { timeout: 10000, maximumAge: 300000 }
                    );
                });
            }

            // 3. ULTIMATE FALLBACK: IP Geolocation (No permission required)
            try {
                const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
                if (ipRes && ipRes.ok) {
                    const ipData = await ipRes.json();
                    if (ipData.latitude && ipData.longitude) {
                        return { lat: ipData.latitude, lng: ipData.longitude };
                    }
                }
            } catch (e) {}
        } catch (err) {
            if (DEBUG) console.warn("[LocationHelper] Error:", err);
        }
        
        return null;
    }

    // Export to window
    window.LocationHelper = {
        calculateDistance,
        formatDistance,
        getUserLocation
    };

    if (window.AGRIPRICE_DEBUG) console.log("[LocationHelper] ✅ Initialized");
})();
