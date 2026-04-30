'use client';

import { useCallback, useMemo, type ReactNode } from 'react';

import type { Database } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

const LABEL = '#6B534E';
const SEGMENT_TRACK = '#E9E1D8';
const SELECTED = '#6F5651';
const SLIDER_TRACK = 'rgba(111, 86, 81, 0.35)';
const PANEL = '#E9E1D8';

export type StudioUnitKind = 'all' | 'apartments' | 'commercial';

export type StudioFilterState = {
    onlyAvailable: boolean;
    unitKind: StudioUnitKind;
    /** 'all' or bedroom count 1–5 */
    rooms: 'all' | 1 | 2 | 3 | 4 | 5;
    floorMin: number;
    floorMax: number;
    areaMin: number;
    areaMax: number;
    priceMinCents: number;
    priceMaxCents: number;
    /** Matches `view_type` substring (case-insensitive), or 'all' */
    windowView: 'all' | 'sea' | 'roof terrace' | 'front' | 'back' | 'estate';
};

export type StudioFilterBounds = {
    floorMin: number;
    floorMax: number;
    areaMin: number;
    areaMax: number;
    priceMinCents: number;
    priceMaxCents: number;
};

export function computeStudioFilterBounds(units: UnitRow[]): StudioFilterBounds {
    if (units.length === 0) {
        return {
            floorMin: 1,
            floorMax: 1,
            areaMin: 0,
            areaMax: 1,
            priceMinCents: 0,
            priceMaxCents: 1,
        };
    }
    let floorMin = Infinity;
    let floorMax = -Infinity;
    let areaMin = Infinity;
    let areaMax = -Infinity;
    let priceMinCents = Infinity;
    let priceMaxCents = -Infinity;
    for (const u of units) {
        const f = u.floor ?? 1;
        floorMin = Math.min(floorMin, f);
        floorMax = Math.max(floorMax, f);
        const a = u.area_sqm;
        if (a != null && Number.isFinite(Number(a))) {
            const n = Number(a);
            areaMin = Math.min(areaMin, n);
            areaMax = Math.max(areaMax, n);
        }
        const p = u.price != null ? Number(u.price) : NaN;
        if (Number.isFinite(p) && p > 0) {
            priceMinCents = Math.min(priceMinCents, p);
            priceMaxCents = Math.max(priceMaxCents, p);
        }
    }
    if (!Number.isFinite(areaMin)) {
        areaMin = 0;
        areaMax = 1;
    }
    if (areaMin === areaMax) {
        areaMax = areaMin + 1;
    }
    if (!Number.isFinite(priceMinCents)) {
        priceMinCents = 0;
        priceMaxCents = 100_000_000;
    }
    if (priceMinCents === priceMaxCents) {
        priceMaxCents = priceMinCents + 1;
    }
    if (floorMin === Infinity) {
        floorMin = 1;
        floorMax = 1;
    }
    if (floorMin === floorMax) {
        floorMax = floorMin + 1;
    }
    return { floorMin, floorMax, areaMin, areaMax, priceMinCents, priceMaxCents };
}

export function defaultStudioFilterState(b: StudioFilterBounds): StudioFilterState {
    return {
        onlyAvailable: false,
        unitKind: 'all',
        rooms: 'all',
        floorMin: b.floorMin,
        floorMax: b.floorMax,
        areaMin: b.areaMin,
        areaMax: b.areaMax,
        priceMinCents: b.priceMinCents,
        priceMaxCents: b.priceMaxCents,
        windowView: 'all',
    };
}

function formatNairaLabel(cents: number): string {
    const whole = Math.round(cents / 100);
    return (
        '₦' +
        new Intl.NumberFormat('fr-FR', {
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
        })
            .format(whole)
            .replace(/\u202f/g, ' ')
    );
}

function formatSqm(n: number): string {
    return `${Math.round(n)} m²`;
}

function isApartmentUnit(u: UnitRow): boolean {
    return u.bedrooms != null && Number.isFinite(Number(u.bedrooms));
}

function isCommercialUnit(u: UnitRow): boolean {
    return !isApartmentUnit(u);
}

function viewMatches(vt: string | null | undefined, key: StudioFilterState['windowView']): boolean {
    if (key === 'all') return true;
    if (vt == null || !String(vt).trim()) return false;
    const s = String(vt).toLowerCase();
    if (key === 'roof terrace') return s.includes('roof') || s.includes('terrace');
    return s.includes(key);
}

export function unitPassesStudioFilters(
    unit: UnitRow,
    state: StudioFilterState,
    bounds: StudioFilterBounds,
    opts: { status: string; allocatedToOther: boolean }
): boolean {
    if (state.onlyAvailable) {
        if (opts.allocatedToOther || opts.status !== 'available') return false;
    }
    if (state.unitKind === 'apartments' && !isApartmentUnit(unit)) return false;
    if (state.unitKind === 'commercial' && !isCommercialUnit(unit)) return false;
    if (state.rooms !== 'all') {
        const br = unit.bedrooms;
        if (br == null || Number(br) !== state.rooms) return false;
    }
    const fl = unit.floor ?? 1;
    if (fl < state.floorMin || fl > state.floorMax) return false;

    const areaFull = state.areaMin <= bounds.areaMin && state.areaMax >= bounds.areaMax;
    const a = unit.area_sqm;
    if (a == null || !Number.isFinite(Number(a))) {
        if (!areaFull) return false;
    } else {
        const n = Number(a);
        if (n < state.areaMin || n > state.areaMax) return false;
    }

    const priceFull = state.priceMinCents <= bounds.priceMinCents && state.priceMaxCents >= bounds.priceMaxCents;
    const p = unit.price != null ? Number(unit.price) : NaN;
    if (!Number.isFinite(p) || p <= 0) {
        if (!priceFull) return false;
    } else {
        if (p < state.priceMinCents || p > state.priceMaxCents) return false;
    }

    if (!viewMatches(unit.view_type, state.windowView)) return false;
    return true;
}

function SectionLabel({ children }: { children: string }) {
    return (
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] mb-1.5" style={{ color: LABEL }}>
            {children}
        </p>
    );
}

function SegmentedGroup({ children }: { children: ReactNode }) {
    return (
        <div
            className="flex w-full flex-wrap rounded-lg p-0.5 gap-0.5"
            style={{ background: SEGMENT_TRACK }}
            role="group"
        >
            {children}
        </div>
    );
}

function SegBtn({
    active,
    children,
    onClick,
    className = '',
}: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`min-h-[32px] px-2 rounded-md text-[11px] font-medium transition-colors ${className}`}
            style={
                active
                    ? { background: SELECTED, color: '#fff' }
                    : { background: 'transparent', color: LABEL }
            }
        >
            {children}
        </button>
    );
}

function DualRangeSlider({
    min,
    max,
    lo,
    hi,
    onLo,
    onHi,
    formatLo,
    formatHi,
    step = 1,
}: {
    min: number;
    max: number;
    lo: number;
    hi: number;
    onLo: (v: number) => void;
    onHi: (v: number) => void;
    formatLo: (v: number) => string;
    formatHi: (v: number) => string;
    step?: number;
}) {
    const span = Math.max(max - min, 1e-6);
    const pctLo = ((lo - min) / span) * 100;
    const pctHi = ((hi - min) / span) * 100;
    const fillLeft = Math.min(pctLo, pctHi);
    const fillW = Math.abs(pctHi - pctLo);

    const clampLo = useCallback(
        (v: number) => {
            const x = Math.min(max, Math.max(min, v));
            return Math.min(x, hi);
        },
        [min, max, hi]
    );
    const clampHi = useCallback(
        (v: number) => {
            const x = Math.min(max, Math.max(min, v));
            return Math.max(x, lo);
        },
        [min, max, lo]
    );

    return (
        <div
            className="rounded-lg px-3 pt-3 pb-2"
            style={{ background: PANEL }}
        >
            <div className="relative h-7 mb-2">
                <div
                    className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full pointer-events-none"
                    style={{ background: SLIDER_TRACK }}
                />
                <div
                    className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full pointer-events-none"
                    style={{
                        left: `${fillLeft}%`,
                        width: `${fillW}%`,
                        background: SELECTED,
                        opacity: 0.85,
                    }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={lo}
                    onChange={(e) => onLo(clampLo(Number(e.target.value)))}
                    className="studio-dual-range absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent z-[2]"
                    aria-label="Range minimum"
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={hi}
                    onChange={(e) => onHi(clampHi(Number(e.target.value)))}
                    className="studio-dual-range absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent z-[3]"
                    aria-label="Range maximum"
                />
            </div>
            <div className="flex justify-between items-center text-[11px] tabular-nums font-medium" style={{ color: LABEL }}>
                <span>{formatLo(lo)}</span>
                <span className="opacity-40">—</span>
                <span>{formatHi(hi)}</span>
            </div>
        </div>
    );
}

const WINDOW_VIEW_OPTIONS: { key: StudioFilterState['windowView']; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sea', label: 'Sea' },
    { key: 'roof terrace', label: 'Roof terrace' },
    { key: 'front', label: 'Front' },
    { key: 'back', label: 'Back' },
    { key: 'estate', label: 'Estate' },
];

export default function EngineNoMeshFilterControls({
    bounds,
    state,
    onChange,
}: {
    bounds: StudioFilterBounds;
    state: StudioFilterState;
    onChange: (patch: Partial<StudioFilterState>) => void;
}) {
    const priceStep = useMemo(() => {
        const span = bounds.priceMaxCents - bounds.priceMinCents;
        if (span <= 0) return 100;
        return Math.max(100, Math.round(span / 500));
    }, [bounds.priceMaxCents, bounds.priceMinCents]);

    const areaStep = useMemo(() => {
        const span = bounds.areaMax - bounds.areaMin;
        if (span <= 0) return 0.1;
        return Math.max(0.1, Math.round((span / 200) * 10) / 10);
    }, [bounds.areaMax, bounds.areaMin]);

    const patch = onChange;

    return (
        <div className="space-y-4 pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={state.onlyAvailable}
                    onChange={(e) => patch({ onlyAvailable: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border shrink-0 cursor-pointer"
                    style={{ accentColor: SELECTED, borderColor: 'rgba(107,83,78,0.45)' }}
                />
                <span className="text-[12px] font-medium" style={{ color: LABEL }}>
                    Only available units
                </span>
            </label>

            <div>
                <SectionLabel>Units</SectionLabel>
                <SegmentedGroup>
                    {(
                        [
                            ['all', 'All'],
                            ['apartments', 'Apartments'],
                            ['commercial', 'Commercial'],
                        ] as const
                    ).map(([key, label]) => (
                        <SegBtn
                            key={key}
                            active={state.unitKind === key}
                            onClick={() => patch({ unitKind: key })}
                            className="flex-1 min-w-[4.5rem]"
                        >
                            {label}
                        </SegBtn>
                    ))}
                </SegmentedGroup>
            </div>

            <div>
                <SectionLabel>Rooms</SectionLabel>
                <div className="rounded-lg p-0.5 space-y-0.5" style={{ background: SEGMENT_TRACK }}>
                    <div className="flex gap-0.5">
                        {(['all', 1, 2, 3, 4] as const).map((r) => (
                            <SegBtn
                                key={String(r)}
                                active={state.rooms === r}
                                onClick={() => patch({ rooms: r })}
                                className="flex-1"
                            >
                                {r === 'all' ? 'All' : r}
                            </SegBtn>
                        ))}
                    </div>
                    <div className="flex justify-center">
                        <SegBtn active={state.rooms === 5} onClick={() => patch({ rooms: 5 })} className="min-w-[3.5rem]">
                            5
                        </SegBtn>
                    </div>
                </div>
            </div>

            <div>
                <SectionLabel>Floors</SectionLabel>
                <DualRangeSlider
                    min={bounds.floorMin}
                    max={bounds.floorMax}
                    lo={state.floorMin}
                    hi={state.floorMax}
                    onLo={(floorMin) => patch({ floorMin })}
                    onHi={(floorMax) => patch({ floorMax })}
                    formatLo={(v) => String(Math.round(v))}
                    formatHi={(v) => String(Math.round(v))}
                    step={1}
                />
            </div>

            <div>
                <SectionLabel>Size</SectionLabel>
                <DualRangeSlider
                    min={bounds.areaMin}
                    max={bounds.areaMax}
                    lo={state.areaMin}
                    hi={state.areaMax}
                    onLo={(areaMin) => patch({ areaMin })}
                    onHi={(areaMax) => patch({ areaMax })}
                    formatLo={formatSqm}
                    formatHi={formatSqm}
                    step={areaStep}
                />
            </div>

            <div>
                <SectionLabel>Price</SectionLabel>
                <DualRangeSlider
                    min={bounds.priceMinCents}
                    max={bounds.priceMaxCents}
                    lo={state.priceMinCents}
                    hi={state.priceMaxCents}
                    onLo={(priceMinCents) => patch({ priceMinCents })}
                    onHi={(priceMaxCents) => patch({ priceMaxCents })}
                    formatLo={formatNairaLabel}
                    formatHi={formatNairaLabel}
                    step={priceStep}
                />
            </div>

            <div>
                <SectionLabel>View from window</SectionLabel>
                <div className="grid grid-cols-3 gap-0.5 rounded-lg p-0.5" style={{ background: SEGMENT_TRACK }}>
                    {WINDOW_VIEW_OPTIONS.map(({ key, label }) => (
                        <SegBtn
                            key={key}
                            active={state.windowView === key}
                            onClick={() => patch({ windowView: key })}
                            className="w-full text-[10px] leading-tight py-2 px-1"
                        >
                            {label}
                        </SegBtn>
                    ))}
                </div>
            </div>
        </div>
    );
}
