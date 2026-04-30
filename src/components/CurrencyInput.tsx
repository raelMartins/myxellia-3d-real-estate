'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatCentsToDisplay, parseToCents } from '@/lib/currency';

interface CurrencyInputProps {
    value: number | null;
    onChange: (cents: number | null) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    /** Brown studio field styling (prefix color). */
    studioListingStyle?: boolean;
}

export function CurrencyInput({
    value,
    onChange,
    placeholder = '0',
    className = '',
    required = false,
    studioListingStyle = false,
}: CurrencyInputProps) {
    // Use local state to handle the raw input string
    const [localValue, setLocalValue] = useState<string>('');
    const isFocused = useRef(false);

    // Sync internal display value when external value changes only if not focused
    useEffect(() => {
        if (!isFocused.current) {
            setLocalValue(value ? formatCentsToDisplay(value) : '');
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value;

        // Strip non-numeric/separator characters
        // Allow digits, one dot, and commas
        raw = raw.replace(/[^\d.]/g, '');

        // Ensure only one decimal point
        const parts = raw.split('.');
        if (parts.length > 2) {
            raw = parts[0] + '.' + parts.slice(1).join('');
        }

        // Format the integer part with commas in real-time
        let formatted = raw;
        if (parts[0]) {
            const num = parseInt(parts[0].replace(/,/g, ''), 10);
            if (!isNaN(num)) {
                const fmtInt = new Intl.NumberFormat('en-US').format(num);
                formatted = fmtInt + (raw.includes('.') ? '.' + (parts[1] || '') : '');
            }
        } else if (raw.startsWith('.')) {
            formatted = '0' + raw;
        }

        setLocalValue(formatted);

        // Parse to cents and notify parent
        const cents = parseToCents(formatted);
        onChange(cents || null);
    };

    const handleBlur = () => {
        isFocused.current = false;
        if (value) {
            setLocalValue(formatCentsToDisplay(value));
        } else {
            setLocalValue('');
        }
    };

    const handleFocus = () => {
        isFocused.current = true;
    };

    return (
        <div className="relative w-full group">
            <input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                placeholder={placeholder}
                required={required}
                className={`${className} pl-12`} // Increased padding for icon
                style={{ paddingLeft: '3rem' }} // Inline fallback to be absolutely sure
            />

            {/* Currency Prefix - Always on top */}
            <div
                className={`absolute left-5 top-1/2 -translate-y-1/2 font-medium pointer-events-none select-none z-20 ${
                    studioListingStyle ? 'text-[#715852]/75' : 'text-[#C6A664]'
                }`}
            >
                $
            </div>
        </div>
    );
}
