/**
 * ProductGrade Component
 * Reusable UI for displaying product prices by grade (A, B, C)
 */
(function () {
    'use strict';

    /**
     * Render the grades row HTML
     * @param {Object} data - Object containing priceA, priceB, priceC
     * @param {string} unitSuffix - Suffix for price (default: 'บ.')
     * @returns {string} - HTML string
     */
    function render(data, unitSuffix = 'บ.กก.') {
        if (!data) return '';
        
        const rawGrades = [
            { label: 'A', value: data.priceA !== undefined ? data.priceA : data.price_a },
            { label: 'B', value: data.priceB !== undefined ? data.priceB : data.price_b },
            { label: 'C', value: data.priceC !== undefined ? data.priceC : data.price_c }
        ];

        // Filter out empty grades
        const grades = rawGrades.filter(g => {
            if (g.value === undefined || g.value === null) return false;
            const valStr = String(g.value).trim();
            return valStr !== '' && valStr !== '-' && valStr !== '0' && !valStr.startsWith('0 ');
        });

        if (grades.length === 0) return '';

        return `
            <div class="price-row">
                ${grades.map(g => {
                    let displayPrice = g.value;
                    if (!String(displayPrice).includes('บ.')) {
                        displayPrice = `${displayPrice} ${unitSuffix}`;
                    }
                    return `
                    <div class="price-box">
                        <div class="grade">${g.label}</div>
                        <div class="price">${displayPrice}</div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Expose to window
    window.ProductGrade = {
        render
    };
})();
