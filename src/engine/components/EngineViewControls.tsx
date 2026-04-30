'use client';

import { useEngineStore } from '@/engine/store/engine.store';
import { useAuthStore } from '@/store/auth.store';
import type { Database } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

function isFootprintPrism(u: UnitRow | undefined): boolean {
    if (!u) return false;
    const f = (u as { footprint?: [number, number][] | null }).footprint;
    return Array.isArray(f) && f.length >= 3;
}

function isSectionPlanSourced(u: UnitRow | undefined): boolean {
    return u?.section_plan_sourced === true;
}

export default function EngineViewControls() {
    const viewMode = useEngineStore((s) => s.viewMode);
    const placementPadEditActive = useEngineStore((s) => s.placementPadEditActive);
    const selectedUnit = useEngineStore((s) => s.selectedUnit);
    const units = useEngineStore((s) => s.units);
    const isAdmin = useAuthStore((s) => s.profile?.role === 'admin');

    const selectedRow = selectedUnit ? units.find((u) => u.id === selectedUnit) : undefined;
    const prismSelected = isFootprintPrism(selectedRow);
    const showPrismAdminHints =
        viewMode === 'exterior' && isAdmin && prismSelected && !!selectedUnit && !isSectionPlanSourced(selectedRow);

    if (viewMode === 'interior') {
        return (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:block w-max max-w-[min(92vw,28rem)]">
                <div className="glass px-5 py-3 rounded-2xl border border-white/5">
                    <div className="text-[9px] tracking-[0.22em] uppercase text-[#C6A664]/90 mb-1">Interior</div>
                    <p className="text-[10px] leading-relaxed text-[#CBD5E1] tracking-wide">
                        <span className="text-[#94A3B8]">Drag</span> to orbit the camera around the scene.
                        <span className="mx-1.5 text-white/20">·</span>
                        <span className="text-[#94A3B8]">Scroll</span> to zoom in and out.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:block w-max max-w-[min(92vw,32rem)]">
            <div className="glass px-5 py-3 rounded-2xl border border-white/5 space-y-2.5">
                {placementPadEditActive ? (
                    <>
                        <div className="text-[9px] tracking-[0.22em] uppercase text-[#C6A664]/90">Ground placement</div>
                        <p className="text-[10px] leading-relaxed text-[#CBD5E1] tracking-wide">
                            <span className="text-[#94A3B8]">Scroll</span> to zoom.
                            <span className="mx-1.5 text-white/20">·</span>
                            Drag the pad handles in the scene to move or reshape the footprint.
                            <span className="mx-1.5 text-white/20">·</span>
                            Camera orbit is paused while editing.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="text-[9px] tracking-[0.22em] uppercase text-[#C6A664]/90">Scene</div>
                        <p className="text-[10px] leading-relaxed text-[#CBD5E1] tracking-wide">
                            <span className="text-[#94A3B8]">Left drag</span> to orbit the camera.
                            <span className="mx-1.5 text-white/20">·</span>
                            <span className="text-[#94A3B8]">Scroll</span> to zoom in and out.
                            <span className="mx-1.5 text-white/20">·</span>
                            <span className="text-[#64748B]">
                                {selectedUnit
                                    ? 'Focus eases onto the selected unit; switching units animates framing smoothly.'
                                    : 'Pan is disabled.'}
                            </span>
                        </p>
                    </>
                )}

                {showPrismAdminHints && !placementPadEditActive && (
                    <div className="pt-2 border-t border-white/10">
                        <div className="text-[9px] tracking-[0.22em] uppercase text-[#C6A664]/90 mb-1">Selected prism (admin)</div>
                        <ul className="text-[10px] leading-relaxed text-[#CBD5E1] tracking-wide space-y-1 list-none">
                            <li>
                                <span className="text-[#94A3B8]">Move:</span>{' '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">Shift</kbd>
                                {' + '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">↑</kbd>
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0] ml-0.5">↓</kbd>
                                {' / '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">←</kbd>
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0] ml-0.5">→</kbd>
                                {' — vertical up/down; horizontal slides on the ground relative to your view.'}
                            </li>
                            <li>
                                <span className="text-[#94A3B8]">Resize:</span> hold{' '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">L</kbd>
                                {' / '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">H</kbd>
                                {' / '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">B</kbd>
                                {', then '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">Shift</kbd>
                                {' + '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">↑</kbd>
                                {' / '}
                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-sans text-[#E2E8F0]">↓</kbd>
                                {' — length, height (grows upward from the ground), or breadth.'}
                            </li>
                            <li>
                                <span className="text-[#94A3B8]">Rotate:</span> use the{' '}
                                <span className="text-[#E2E8F0]">⟲</span> <span className="text-[#E2E8F0]">⟳</span> buttons above the unit in the 3D view.
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
