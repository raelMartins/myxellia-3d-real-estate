'use client';

import { ArrowLeft, Moon, Sun, SunMedium, Sunset } from 'lucide-react';
import type { LightingMode } from '@/engine/store/engine.store';

const LIGHTING_OPTS: { mode: LightingMode; icon: typeof Sun; label: string }[] = [
    { mode: 'morning', icon: Sun, label: 'Morning' },
    { mode: 'noon', icon: SunMedium, label: 'Noon' },
    { mode: 'golden', icon: Sunset, label: 'Golden hour' },
    { mode: 'night', icon: Moon, label: 'Night' },
];

/** Dark scene panel — matches `EngineRightPanel` inner rows (`glass-heavy` + `border-white/10`). */
const classicShell = 'glass-heavy rounded-xl border border-white/10 px-2 py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]';
const classicBackBtn =
    'glass-heavy rounded-xl border border-white/10 px-3 py-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase transition-colors hover:border-[#C6A664]/35 hover:text-[#C6A664] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]';
const classicLightingOuter = `flex items-stretch overflow-hidden ${classicShell} p-1`;
const classicLightingBtn = (isActive: boolean) =>
    `flex items-center justify-center px-2.5 py-2 min-w-[2.25rem] rounded-xl transition-all duration-300 border text-left ${
        isActive
            ? 'bg-[#C6A664]/25 border-[#C6A664]/50 text-[#F5F7FA]'
            : 'border-white/10 text-[#94A3B8] hover:text-[#F5F7FA] hover:border-white/20'
    }`;

/** Studio / no world mesh — matches `EngineSidebar` units table chrome. */
const STUDIO_TEXT = '#715852';
const studioShell =
    'rounded-xl border border-[rgba(113,88,82,0.25)] bg-[#E4DCD5]/85 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]';
const studioBackBtn = `rounded-xl border border-[rgba(113,88,82,0.35)] bg-[#E4DCD5]/85 backdrop-blur-md px-3 py-2 text-[10px] tracking-[0.25em] uppercase transition-colors hover:bg-[rgba(113,88,82,0.08)]`;
const studioLightingOuter = `flex items-stretch overflow-hidden ${studioShell} p-1`;
const studioLightingBtn = (isActive: boolean) =>
    `flex items-center justify-center px-2.5 py-2 min-w-[2.25rem] rounded-lg transition-all duration-200 border ${
        isActive
            ? 'border-[rgba(113,88,82,0.38)] bg-[rgba(113,88,82,0.14)] text-[#715852]'
            : 'border-transparent text-[#715852]/80 hover:bg-[rgba(113,88,82,0.08)] hover:text-[#715852]'
    }`;

export type EngineTopSceneBarProps = {
    onBack: () => void;
    viewMode: 'exterior' | 'interior';
    /** Same as canvas / sidebar: no ground world → studio beige UI. */
    noWorldMesh: boolean;
    lightingMode: LightingMode;
    onLightingMode: (mode: LightingMode) => void;
    lightingFromHdriSlots: boolean;
    worldPreviewMode: boolean;
    buildingWorldEnvironment: { label: string } | null;
};

export default function EngineTopSceneBar({
    onBack,
    viewMode,
    noWorldMesh,
    lightingMode,
    onLightingMode,
    lightingFromHdriSlots,
    worldPreviewMode,
    buildingWorldEnvironment,
}: EngineTopSceneBarProps) {
    const studio = noWorldMesh;
    const showWorldPreviewLabel = worldPreviewMode && !!buildingWorldEnvironment;
    const showLighting = viewMode === 'exterior';

    return (
        <div
            className="absolute top-8 left-4 z-[35] flex min-w-0 flex-wrap items-center gap-2 pointer-events-auto max-w-[min(96vw,calc(100vw-2rem))]"
            role="toolbar"
            aria-label="Scene controls"
        >
            <button
                type="button"
                onClick={onBack}
                className={studio ? studioBackBtn : classicBackBtn}
                style={studio ? { color: STUDIO_TEXT } : undefined}
                aria-label="Back in browser history"
            >
                <span className="inline-flex items-center gap-2">
                    <ArrowLeft size={14} className="shrink-0" strokeWidth={1.75} />
                    Back
                </span>
            </button>

            {showLighting && (
                <div
                    className={`${studio ? studioLightingOuter : classicLightingOuter} ${
                        lightingFromHdriSlots ? 'opacity-40 pointer-events-none' : ''
                    }`}
                    title={lightingFromHdriSlots ? 'Lighting is driven by the sky collection' : undefined}
                >
                    {LIGHTING_OPTS.map((opt) => {
                        const Icon = opt.icon;
                        const isActive = lightingMode === opt.mode;
                        return (
                            <button
                                key={opt.mode}
                                type="button"
                                onClick={() => onLightingMode(opt.mode)}
                                title={opt.label}
                                aria-label={opt.label}
                                aria-pressed={isActive}
                                className={studio ? studioLightingBtn(isActive) : classicLightingBtn(isActive)}
                            >
                                <Icon
                                    size={15}
                                    className={isActive ? '' : studio ? 'opacity-75' : 'opacity-70'}
                                    strokeWidth={1.75}
                                />
                            </button>
                        );
                    })}
                </div>
            )}

            {viewMode === 'exterior' && showWorldPreviewLabel && (
                <div
                    className={
                        studio
                            ? `flex min-w-0 max-w-[min(18rem,55vw)] items-center px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${studioShell}`
                            : `glass-heavy flex min-w-0 max-w-[min(18rem,55vw)] items-center rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#F5F7FA]/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]`
                    }
                    style={studio ? { color: STUDIO_TEXT } : undefined}
                    title={buildingWorldEnvironment?.label}
                >
                    <span className="truncate">{buildingWorldEnvironment?.label}</span>
                </div>
            )}
        </div>
    );
}
