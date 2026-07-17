/**
 * ProductGrade Component
 * Reusable UI for displaying product prices by grade (A, B, C)
 */
(function () {
    'use strict';

    function normalizePrice(value, unitSuffix) {
        if (value === undefined || value === null) return '';
        const raw = String(value).trim();
        if (!raw || raw === '-' || raw.toLowerCase() === 'null') return '';

        const match = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
        const numeric = Number(match ? match[0] : raw);
        if (!Number.isFinite(numeric) || numeric <= 0) return '';

        if (raw.includes('บ.') || raw.includes('Baht') || raw.includes('泰铢') || raw.includes('铢')) return raw;
        return `${numeric} ${unitSuffix}`;
    }

    function getRelationGrades(data) {
        const grades = Array.isArray(data.grades)
            ? data.grades
            : (Array.isArray(data.product_grades)
                ? data.product_grades
                : (Array.isArray(data.offer_grades) ? data.offer_grades : []));

        return grades.map((g) => ({
            label: g.grade_name || g.grade || 'A',
            value: g.price
        }));
    }

    /**
     * Render the grades row HTML
     * @param {Object} data - Object containing grades or priceA, priceB, priceC
     * @param {string} unitSuffix - Suffix for price
     * @returns {string} - HTML string
     */
    function render(data, unitSuffix) {
        if (!data) return '';
        unitSuffix = unitSuffix || (window.i18nT ? window.i18nT('baht_per_kg', 'บาท/กก.') : 'บาท/กก.');

        const relationGrades = getRelationGrades(data);
        const rawGrades = relationGrades.length ? relationGrades : [
            { label: 'A', value: data.priceA !== undefined ? data.priceA : data.price_a },
            { label: 'B', value: data.priceB !== undefined ? data.priceB : data.price_b },
            { label: 'C', value: data.priceC !== undefined ? data.priceC : data.price_c }
        ];

        const grades = rawGrades
            .map((g) => ({
                label: g.label || 'A',
                price: normalizePrice(g.value, unitSuffix)
            }))
            .filter((g) => g.price);

        if (grades.length === 0) return '';

        return `
            <div class="price-row">
                ${grades.map((g) => `
                    <div class="price-box">
                        <div class="grade">${g.label}</div>
                        <div class="price">${g.price}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    window.ProductGrade = {
        render
    };
})();
