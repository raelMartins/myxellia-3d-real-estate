'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export type CustomSelectOption = { value: string; label: string };

export type CustomSelectProps = {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: CustomSelectOption[];
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    /** Dense styling for toolbars and side panels. */
    variant?: 'default' | 'compact';
    /**
     * `field` — full control chrome (default).
     * `inline` — text + chevron only; use when the select already sits inside a glass/card row so borders are not doubled.
     */
    frame?: 'field' | 'inline';
    buttonStyle?: CSSProperties;
    disabled?: boolean;
    /** When false, the root does not force `w-full` (e.g. compact rows with a fixed max width). Default true. */
    fullWidth?: boolean;
    'aria-label'?: string;
    onBlur?: () => void;
};

export default function CustomSelect({
    id: idProp,
    value,
    onChange,
    options,
    placeholder = 'Select…',
    className = '',
    buttonClassName = '',
    variant = 'default',
    frame = 'field',
    buttonStyle,
    disabled = false,
    fullWidth = true,
    'aria-label': ariaLabel,
    onBlur,
}: CustomSelectProps) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const listId = `${id}-listbox`;
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });

    const updatePosition = useCallback(() => {
        const el = btnRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const maxH = Math.min(280, window.innerHeight - r.bottom - 12);
        setMenuStyle({
            position: 'fixed',
            left: r.left,
            top: r.bottom + 4,
            width: r.width,
            maxHeight: Math.max(120, maxH),
            zIndex: 9999,
            visibility: 'visible',
        });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
        const onScroll = () => updatePosition();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            setOpen(false);
            onBlur?.();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                onBlur?.();
                btnRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onBlur]);

    const selected = options.find((o) => o.value === value);
    const label = selected?.label ?? (value ? value : placeholder);

    const baseBtn =
        'w-full min-w-0 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#1F1F23]/90 px-3 py-2.5 text-left text-sm text-[#F5F7FA] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] transition-colors hover:border-[#C6A664]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A664]/40 disabled:cursor-not-allowed disabled:opacity-50';
    const compactBtn =
        'w-full min-w-0 flex-1 flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-[#1F1F23]/90 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[#F5F7FA] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] transition-colors hover:border-[#C6A664]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A664]/40 disabled:cursor-not-allowed disabled:opacity-50';
    const inlineFieldBtn =
        'w-full min-w-0 flex items-center justify-between gap-2 rounded-none border-0 bg-transparent px-0 py-0.5 text-left text-sm text-[#F5F7FA] shadow-none transition-colors hover:text-[#F5F7FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A664]/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';
    const inlineCompactBtn =
        'w-full min-w-0 flex-1 flex items-center justify-between gap-1 rounded-none border-0 bg-transparent px-0 py-0.5 text-left text-[10px] font-bold uppercase tracking-widest text-[#F5F7FA] shadow-none transition-colors hover:text-[#C6A664] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A664]/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

    const isCompact = variant === 'compact';
    const fieldChrome = isCompact ? compactBtn : baseBtn;
    const inlineChrome = isCompact ? inlineCompactBtn : inlineFieldBtn;
    const triggerClass = `${frame === 'inline' ? inlineChrome : fieldChrome} ${buttonClassName}`.trim();

    const menu = (
        <div
            ref={menuRef}
            id={listId}
            role="listbox"
            className="overflow-y-auto rounded-lg border border-white/12 bg-[#1F1F23] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
            style={menuStyle}
        >
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value === '' ? '__empty__' : opt.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            active
                                ? 'bg-[#C6A664]/20 text-[#F5F7FA]'
                                : 'text-[#F5F7FA]/90 hover:bg-white/[0.07]'
                        }`}
                        onClick={() => {
                            onChange(opt.value);
                            setOpen(false);
                            onBlur?.();
                            btnRef.current?.focus();
                        }}
                    >
                        <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div
            ref={wrapRef}
            className={`relative min-w-0 ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
        >
            <button
                ref={btnRef}
                type="button"
                id={id}
                disabled={disabled}
                style={buttonStyle}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={ariaLabel}
                className={triggerClass}
                onClick={() => {
                    if (disabled) return;
                    setOpen((o) => !o);
                }}
            >
                <span className={`min-w-0 flex-1 truncate ${!selected && !value ? 'text-[#94A3B8]' : ''}`}>{label}</span>
                <ChevronDown
                    size={isCompact ? 14 : 16}
                    className={`ml-auto shrink-0 text-[#C6A664] transition-transform ${open ? 'rotate-180' : ''}`}
                    strokeWidth={1.75}
                    aria-hidden
                />
            </button>
            {open && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
        </div>
    );
}
