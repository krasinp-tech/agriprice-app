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
        const uLat = (lat1 != null && !isNaN(lat1)) ? lat1 : 12.6083;
        const uLon = (lon1 != null && !isNaN(lon1)) ? lon1 : 102.1039;
        const sLat = (lat2 != null && !isNaN(lat2)) ? lat2 : 13.7532;
        const sLon = (lon2 != null && !isNaN(lon2)) ? lon2 : 100.4986;
        
        const R = 6371; // Earth's radius in km
        const dLat = (sLat - uLat) * Math.PI / 180;
        const dLon = (sLon - uLon) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(uLat * Math.PI / 180) * Math.cos(sLat * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Formats distance into a human-readable string (Thai).
     */
    function formatDistance(km) {
        const value = (km == null || isNaN(km)) ? calculateDistance(null, null, null, null) : km;
        if (value < 1) {
            return `ระยะทาง ${Math.round(value * 1000)} ม.`;
        }
        return `ระยะทาง ${value.toFixed(1)} กม.`;
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
        
        return { lat: 12.6083, lng: 102.1039 };
    }

    // Export to window
    window.LocationHelper = {
        calculateDistance,
        formatDistance,
        getUserLocation
    };

    if (window.AGRIPRICE_DEBUG) console.log("[LocationHelper] ✅ Initialized");
})();
