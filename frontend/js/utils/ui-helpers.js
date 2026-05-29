/**
 * ui-helpers.js
 * Common UI and formatting utilities for AgriPrice
 */

/**
 * ui-helpers.js
 * รวมฟังก์ชันช่วยจัดการ UI เช่น การจัดรูปแบบวันที่ภาษาไทย, 
 * การคั่นตัวเลขด้วยคอมม่า, และการแปลงเวลา "เมื่อ x นาทีที่แล้ว"
 */
(function() {
    function t(key, fallback) {
        if (window.i18nT) return window.i18nT(key, fallback);
        return fallback || key;
    }

    /**
     * Format date string to "Time Ago" format (Thai)
     * @param {string} dateStr 
     * @returns {string}
     */
    function formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) return '';
        
        const diff = Math.floor((Date.now() - dt.getTime()) / 60000);
        if (diff < 1) return t('just_updated', 'เพิ่งอัปเดตเมื่อครู่');
        if (diff < 60) return t('minutes_ago_prefix', 'เมื่อ') + ' ' + diff + ' ' + t('minutes_ago', 'นาทีที่แล้ว');
        if (diff < 1440) return t('hours_ago_prefix', 'เมื่อ') + ' ' + Math.floor(diff / 60) + ' ' + t('hours_ago', 'ชั่วโมงที่แล้ว');
        return t('days_ago_prefix', 'เมื่อ') + ' ' + Math.floor(diff / 1440) + ' ' + t('days_ago', 'วันที่แล้ว');
    }

    /**
     * Escape HTML special characters
     * @param {string} str 
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    /**
     * Format date to short format based on current locale
     * @param {string|Date} dateValue 
     * @returns {string}
     */
    function formatThaiDate(dateValue) {
        if (!dateValue) return "";
        const dt = new Date(dateValue);
        if (isNaN(dt.getTime())) return "";
        const lang = localStorage.getItem('lang') || 'th';
        const locale = lang === 'en' ? 'en-US' : (lang === 'zh' ? 'zh-CN' : 'th-TH');
        return new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
        }).format(dt);
    }

    /**
     * Format number with commas
     * @param {number|string} num 
     * @returns {string}
     */
    function formatNumber(num) {
        if (!num && num !== 0) return "";
        const parsed = parseFloat(num);
        if (isNaN(parsed)) return String(num);
        return parsed.toLocaleString();
    }

    /**
     * Format estimated time in minutes
     * @param {number} minutes 
     * @returns {string}
     */
    function formatEstimatedTime(minutes) {
        if (!minutes || minutes < 0) return "-";
        if (minutes < 60) return minutes + " " + t('unit_minute', 'นาที');
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) return hours + " " + t('unit_hour', 'ชั่วโมง');
        return hours + " " + t('unit_hour', 'ชั่วโมง') + " " + mins + " " + t('unit_minute', 'นาที');
    }

    // Export to window
    window.AgriPriceUI = {
        formatTimeAgo,
        escapeHtml,
        formatThaiDate,
        formatNumber,
        formatEstimatedTime,
        t
    };
})();
