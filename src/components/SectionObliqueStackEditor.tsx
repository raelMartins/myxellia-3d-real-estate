'use client';

import { useCallback, useMemo, useState } from 'react';
import NumberInput from '@/components/NumberInput';
import SectionObliqueCanvas from '@/components/SectionObliqueCanvas';
import type { SectionPlan } from '@/lib/database.types';
import type { NewUnitSlot } from '@/lib/sectionPlanSlots';
import { clampVerticalSpan, snapYOutsideIntervals, yIntervalsOverlapInterior } from '@/lib/sectionPlanYRanges';

type StackRow = {
    id: string;
    yStart: number | null;
    yEnd: number | null;
    floorAnnotation: number;
};

function newRowId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultRowForSection(sectionId: string, stackIndex: number): StackRow {
    return { id: `${sectionId}-stack-${stackIndex}`, yStart: null, yEnd: null, floorAnnotation: stackIndex + 1 };
}

function defaultStacksForPlan(plan: SectionPlan): Record<string, StackRow[]> {
    const o: Record<string, StackRow[]> = {};
    for (const s of plan.sections) {
        o[s.id] = [defaultRowForSection(s.id, 0)];
    }
    return o;
}

function otherYIntervals(rows: StackRow[], excludeId: string): [number, number][] {
    return rows
        .filter((r) => r.id !== excludeId && r.yStart != null && r.yEnd != null)
        .map((r) => {
            const a = Math.min(r.yStart!, r.yEnd!);
            const b = Math.max(r.yStart!, r.yEnd!);
            return [a, b] as [number, number];
        });
}

function rowInterval(row: StackRow): [number, number] | null {
    if (row.yStart == null || row.yEnd == null) return null;
    return [Math.min(row.yStart, row.yEnd), Math.max(row.yStart, row.yEnd)];
}

interface SectionObliqueStackEditorProps {
    plan: SectionPlan;
    modelUrl: string;
    modelExtension?: string;
    onSlotsChange: (slots: NewUnitSlot[]) => void;
}

export default function SectionObliqueStackEditor({
    plan,
    modelUrl,
    modelExtension,
    onSlotsChange,
}: SectionObliqueStackEditorProps) {
    const showCanvas = modelUrl.trim().length > 0;

    const [stacksBySection, setStacksBySection] = useState<Record<string, StackRow[]>>(() => defaultStacksForPlan(plan));
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(() => plan.sections[0]?.id ?? null);
    const [activeRowId, setActiveRowId] = useState<string | null>(() => {
        const sid = plan.sections[0]?.id;
        if (!sid) return null;
        return defaultStacksForPlan(plan)[sid][0].id;
    });
    const [error, setError] = useState<string | null>(null);

    const selected = useMemo(
        () => plan.sections.find((s) => s.id === selectedSectionId) ?? plan.sections[0] ?? null,
        [plan.sections, selectedSectionId]
    );

    const rows = selected ? stacksBySection[selected.id] ?? [] : [];
    const activeRow = rows.find((r) => r.id === activeRowId) ?? null;

    const pickPhase = useMemo(() => {
        if (!activeRow) return 'idle' as const;
        if (activeRow.yStart == null) return 'need_start' as const;
        if (activeRow.yEnd == null) return 'need_end' as const;
        return 'idle' as const;
    }, [activeRow]);

    const pickEnabled = showCanvas && !!selected && pickPhase !== 'idle';

    const updateRow = useCallback((sectionId: string, rowId: string, patch: Partial<StackRow>) => {
        setStacksBySection((prev) => ({
            ...prev,
            [sectionId]: (prev[sectionId] ?? []).map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
        }));
    }, []);

    const handleWorldPickY = useCallback(
        (y: number) => {
            if (!selected || !activeRowId) return;
            const sectionId = selected.id;
            const sectionRows = stacksBySection[sectionId] ?? [];
            const row = sectionRows.find((r) => r.id === activeRowId);
            if (!row) return;
            const others = otherYIntervals(sectionRows, row.id);

            if (row.yStart == null) {
                const ys = snapYOutsideIntervals(y, others);
                updateRow(sectionId, row.id, { yStart: ys });
                return;
            }
            if (row.yEnd == null) {
                const s = row.yStart;
                const rawLo = Math.min(s, y);
                const rawHi = Math.max(s, y);
                const [lo, hi] = clampVerticalSpan(rawLo, rawHi, others, 0.05);
                updateRow(sectionId, row.id, { yStart: lo, yEnd: hi });
            }
        },
        [selected, activeRowId, stacksBySection, updateRow]
    );

    const addRow = useCallback((sectionId: string) => {
        let newId = '';
        setStacksBySection((prev) => {
            const cur = prev[sectionId] ?? [defaultRowForSection(sectionId, 0)];
            const last = cur[cur.length - 1];
            if (last.yStart == null || last.yEnd == null) return prev;
            const lo = Math.min(last.yStart, last.yEnd);
            const hi = Math.max(last.yStart, last.yEnd);
            const h = Math.max(0.05, hi - lo);
            newId = newRowId();
            const row: StackRow = {
                id: newId,
                yStart: hi,
                yEnd: hi + h,
                floorAnnotation: last.floorAnnotation + 1,
            };
            return { ...prev, [sectionId]: [...cur, row] };
        });
        if (newId) setActiveRowId(newId);
    }, []);

    const removeRow = useCallback((sectionId: string, rowId: string) => {
        let nextFirst: string | null = null;
        setStacksBySection((prev) => {
            const cur = prev[sectionId] ?? [];
            if (cur.length <= 1) return prev;
            const next = cur.filter((r) => r.id !== rowId);
            nextFirst = next[0]?.id ?? null;
            return { ...prev, [sectionId]: next };
        });
        if (nextFirst) setActiveRowId(nextFirst);
    }, []);

    const buildSlots = useCallback((): { ok: true; slots: NewUnitSlot[] } | { ok: false; message: string } => {
        for (const sec of plan.sections) {
            const sectionRows = stacksBySection[sec.id] ?? [];
            const intervals: [number, number][] = [];
            for (const row of sectionRows) {
                const iv = rowInterval(row);
                if (!iv) {
                    return { ok: false, message: `Complete every stack with two clicks on the building (${sec.label}).` };
                }
                const [lo, hi] = iv;
                if (hi - lo < 0.05) {
                    return { ok: false, message: `Each stack needs at least 0.05 m height (${sec.label}).` };
                }
                for (const ex of intervals) {
                    if (yIntervalsOverlapInterior(iv, ex)) {
                        return { ok: false, message: `Two stacks overlap in Y within “${sec.label}”. Adjust or re-pick.` };
                    }
                }
                intervals.push(iv);
            }
        }

        const out: NewUnitSlot[] = [];
        for (const sec of plan.sections) {
            const sectionRows = stacksBySection[sec.id] ?? [];
            for (const row of sectionRows) {
                const iv = rowInterval(row)!;
                const [yLo, yHi] = iv;
                out.push({
                    sectionId: sec.id,
                    sectionLabel: sec.label,
                    footprint: sec.footprint,
                    yStart: yLo,
                    yEnd: yHi,
                    floorAnnotation: Math.max(1, Math.round(row.floorAnnotation)),
                });
            }
        }
        return { ok: true, slots: out };
    }, [plan.sections, stacksBySection]);

    const handleContinue = useCallback(() => {
        const result = buildSlots();
        if (!result.ok) {
            setError(result.message);
            return;
        }
        setError(null);
        onSlotsChange(result.slots);
    }, [buildSlots, onSlotsChange]);

    const previews = rows.map((r) => ({ id: r.id, yStart: r.yStart, yEnd: r.yEnd }));
    const lastRow = rows.length ? rows[rows.length - 1] : null;
    const canAddStack =
        lastRow &&
        lastRow.yStart != null &&
        lastRow.yEnd != null &&
        Math.abs(lastRow.yEnd - lastRow.yStart) >= 0.05;

    return (
        <div className="space-y-5">
            <p className="text-[#94A3B8] text-sm leading-relaxed">
                <span className="text-[#F5F7FA]">First unit per section:</span> click the building for <strong>start Y</strong>, then
                click again for <strong>end Y</strong> (only building mesh; footprint stays the section).{' '}
                <span className="text-[#F5F7FA]">Next stacks</span> snap above the previous with the same height and floor +1.{' '}
                <span className="text-[#F5F7FA]">Floor</span> is listing metadata only.
                {!showCanvas && (
                    <span className="block mt-2 text-amber-200/80 text-xs">No model URL — two-click picking is disabled.</span>
                )}
            </p>

            <div className="flex flex-wrap gap-2">
                {plan.sections.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                            setSelectedSectionId(s.id);
                            const first = stacksBySection[s.id]?.[0];
                            setActiveRowId(first?.id ?? null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase border transition-colors ${
                            selected?.id === s.id
                                ? 'bg-[#C6A664]/20 border-[#C6A664]/50 text-[#F5F7FA]'
                                : 'bg-white/5 border-white/10 text-[#94A3B8] hover:border-white/20'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {selected && rows.length > 0 && (
                <div className={`grid grid-cols-1 gap-6 min-h-0 ${showCanvas ? 'lg:grid-cols-5' : ''}`}>
                    {showCanvas && (
                        <div className="lg:col-span-3 min-w-0">
                            <SectionObliqueCanvas
                                modelUrl={modelUrl}
                                modelExtension={modelExtension}
                                plan={plan}
                                sectionFootprint={selected.footprint}
                                stacks={previews}
                                activeStackId={activeRowId}
                                pickEnabled={pickEnabled}
                                onPickWorldY={handleWorldPickY}
                                height={380}
                            />
                            <p className="text-[9px] text-[#64748B] mt-2 tracking-wide">
                                {pickEnabled ? (
                                    <span className="text-[#C6A664]">
                                        {pickPhase === 'need_start' ? 'Click the building to set start Y.' : 'Click the building to set end Y.'} Orbit
                                        is off while picking.
                                    </span>
                                ) : (
                                    <span>
                                        Faint gold volume: full model height for this section. Brighter prism: selected stack. Drag to orbit when not
                                        picking.
                                    </span>
                                )}
                            </p>
                        </div>
                    )}
                    <div className={showCanvas ? 'lg:col-span-2 space-y-3' : 'max-w-xl space-y-3'}>
                        <div className="text-[9px] tracking-[0.2em] text-[#C6A664] uppercase">Stacks for {selected.label}</div>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                            {rows.map((row) => {
                                const iv = rowInterval(row);
                                const h = iv ? iv[1] - iv[0] : null;
                                const invalid = h != null && h < 0.05;
                                const incomplete = row.yStart == null || row.yEnd == null;
                                return (
                                    <div
                                        key={row.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setActiveRowId(row.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') setActiveRowId(row.id);
                                        }}
                                        className={`rounded-xl border p-3 space-y-2 text-left cursor-pointer transition-colors ${
                                            activeRowId === row.id ? 'border-[#C6A664]/60 bg-[#C6A664]/10' : 'border-white/10 bg-white/5'
                                        }`}
                                    >
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[8px] text-[#94A3B8] uppercase mb-1">Y start</label>
                                                {row.yStart == null ? (
                                                    <div className="rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 text-xs text-[#64748B]">—</div>
                                                ) : (
                                                    <NumberInput
                                                        allowDecimal
                                                        value={row.yStart}
                                                        onChange={(n) => updateRow(selected.id, row.id, { yStart: n })}
                                                        className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 text-xs text-[#F5F7FA]"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[8px] text-[#94A3B8] uppercase mb-1">Y end</label>
                                                {row.yEnd == null ? (
                                                    <div className="rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 text-xs text-[#64748B]">—</div>
                                                ) : (
                                                    <NumberInput
                                                        allowDecimal
                                                        value={row.yEnd}
                                                        onChange={(n) => updateRow(selected.id, row.id, { yEnd: n })}
                                                        className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 text-xs text-[#F5F7FA]"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 text-[10px] text-[#94A3B8]">
                                            <span>
                                                Height: {h == null ? '—' : `${h.toFixed(2)} m`}
                                                {invalid ? ' (too small)' : ''}
                                                {incomplete ? ' · use two clicks on model' : ''}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <label className="text-[8px] uppercase shrink-0">Floor</label>
                                                <NumberInput
                                                    min={1}
                                                    value={row.floorAnnotation}
                                                    onChange={(n) => updateRow(selected.id, row.id, { floorAnnotation: Math.max(1, n) })}
                                                    className="w-14 rounded bg-black/30 border border-white/10 px-1.5 py-1 text-xs text-[#F5F7FA]"
                                                />
                                            </div>
                                        </div>
                                        {row.yStart != null && row.yEnd != null && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateRow(selected.id, row.id, { yStart: null, yEnd: null });
                                                }}
                                                className="text-[9px] uppercase tracking-wider text-[#C6A664]/90 hover:text-[#C6A664]"
                                            >
                                                Re-pick Y on model
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeRow(selected.id, row.id);
                                            }}
                                            disabled={rows.length <= 1}
                                            className="text-[9px] uppercase tracking-wider text-red-400/90 hover:text-red-300 disabled:opacity-30"
                                        >
                                            Remove stack
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => addRow(selected.id)}
                            disabled={!canAddStack}
                            title={!canAddStack ? 'Finish the current stack (two Y clicks) before adding another.' : undefined}
                            className="w-full py-2 rounded-lg border border-dashed border-white/15 text-[10px] uppercase tracking-widest text-[#94A3B8] hover:border-[#C6A664]/40 hover:text-[#C6A664] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            + Add stack in this section
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-amber-400/90 text-xs">{error}</p>}

            <button
                type="button"
                onClick={handleContinue}
                className="px-8 py-3 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase hover:opacity-90"
            >
                Preview & continue
            </button>
        </div>
    );
}
