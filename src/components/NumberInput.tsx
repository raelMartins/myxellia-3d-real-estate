'use client';

import { forwardRef, useState } from 'react';

export type NumberInputProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'defaultValue' | 'inputMode'
> & {
    value: number;
    onChange: (value: number) => void;
    /** When set, parsed value is clamped before calling onChange. */
    min?: number;
    max?: number;
    /** Allow a single decimal point and parse as float. */
    allowDecimal?: boolean;
    /** When true, the field appears empty if the numeric value is exactly 0. */
    hideZeroAsEmpty?: boolean;
    /** When set, values strictly below this (and ≥ 0) render as an empty field (e.g. invalid draft counts). */
    hideWhenBelow?: number;
};

function filterNumeric(raw: string, allowDecimal: boolean): string {
    let out = '';
    let dot = false;
    for (const c of raw) {
        if (c >= '0' && c <= '9') {
            out += c;
            continue;
        }
        if (allowDecimal && c === '.' && !dot) {
            out += c;
            dot = true;
        }
    }
    return out;
}

function parseNumeric(filtered: string, allowDecimal: boolean): number {
    if (filtered === '' || filtered === '.') return 0;
    const n = allowDecimal ? parseFloat(filtered) : parseInt(filtered, 10);
    return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min?: number, max?: number): number {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
}

function formatShown(
    value: number,
    allowDecimal: boolean,
    hideZeroAsEmpty: boolean,
    hideWhenBelow?: number
): string {
    if (hideWhenBelow !== undefined && value >= 0 && value < hideWhenBelow) return '';
    if (hideZeroAsEmpty && value === 0) return '';
    if (allowDecimal && Number.isInteger(value)) return String(value);
    return String(value);
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
    {
        value,
        onChange,
        min,
        max,
        allowDecimal = false,
        hideZeroAsEmpty = false,
        hideWhenBelow,
        onFocus,
        onBlur,
        disabled,
        className,
        ...rest
    },
    ref
) {
    const setRefs = (el: HTMLInputElement | null) => {
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
    };

    /** Non-null while the field is focused — local typing buffer. */
    const [draft, setDraft] = useState<string | null>(null);
    const committedDisplay = formatShown(value, allowDecimal, hideZeroAsEmpty, hideWhenBelow);
    const inputValue = draft !== null ? draft : committedDisplay;

    return (
        <input
            {...rest}
            ref={setRefs}
            type="text"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            autoComplete="off"
            disabled={disabled}
            className={className}
            value={inputValue}
            onChange={(e) => {
                const filtered = filterNumeric(e.target.value, allowDecimal);
                setDraft(filtered);
                const parsed = parseNumeric(filtered, allowDecimal);
                onChange(clamp(parsed, min, max));
            }}
            onFocus={(e) => {
                setDraft(String(value));
                onFocus?.(e);
            }}
            onBlur={(e) => {
                const parsed = parseNumeric(filterNumeric(e.target.value, allowDecimal), allowDecimal);
                const next = clamp(parsed, min, max);
                onChange(next);
                setDraft(null);
                onBlur?.(e);
            }}
        />
    );
});

export default NumberInput;
