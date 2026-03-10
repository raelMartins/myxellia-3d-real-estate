/**
 * Currency utilities for Myxellia.
 * All amounts are handled as integers (cents/lowest unit) to avoid floating point issues.
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const DISPLAY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

/**
 * Formats cents into a display string with commas and 2 decimals (e.g. 125000 -> "1,250.00")
 */
export function formatCentsToFullDisplay(cents: number | null | undefined): string {
    if (cents == null) return '0.00';
    return CURRENCY_FORMATTER.format(cents / 100);
}

/**
 * Formats cents into a short display string without decimals if they are zero (e.g. 125000 -> "1,250")
 */
export function formatCentsToDisplay(cents: number | null | undefined): string {
    if (cents == null) return '0';
    const dollars = cents / 100;
    if (dollars % 1 === 0) {
        return DISPLAY_FORMATTER.format(dollars);
    }
    return CURRENCY_FORMATTER.format(dollars);
}

/**
 * Formats cents into a full currency string with prefix (e.g. 125000 -> "$1,250")
 */
export function formatCentsToCurrency(cents: number | null | undefined): string {
    if (cents == null) return '$0';
    return `$${formatCentsToDisplay(cents)}`;
}

/**
 * Formats cents into a short currency string (e.g. 54210000 -> "$542.1k", 4260000000 -> "$42.6M")
 */
export function formatCentsToShortCurrency(cents: number | null | undefined): string {
    if (cents == null || typeof cents !== 'number' || !Number.isFinite(cents)) return '$0';
    const dollars = cents / 100;
    if (dollars >= 1e6) {
        const m = dollars / 1e6;
        return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (dollars >= 1e3) {
        const k = dollars / 1e3;
        return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    return `$${Math.round(dollars)}`;
}

/**
 * Parses a display string into cents. 
 * It strips everything but digits and treats the result as the decimal value.
 * Example: "$1,250.50" -> 125050
 * Example: "1250" -> 125000
 */
export function parseToCents(value: string): number {
    // Strip everything but numbers and the first decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    if (!cleanValue) return 0;

    const [dollars, cents] = cleanValue.split('.');

    let totalCents = (parseInt(dollars || '0', 10) || 0) * 100;

    if (cents) {
        const centPart = cents.slice(0, 2).padEnd(2, '0');
        totalCents += parseInt(centPart, 10);
    }

    return totalCents;
}
