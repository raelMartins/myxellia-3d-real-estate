'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Loader2, PanelLeftClose, Sun } from 'lucide-react';
import SetDefaultSkyboxButton from '@/components/SetDefaultSkyboxButton';
import CustomSelect from '@/components/CustomSelect';
import type { SurroundCatalogAssetRow } from '@/lib/database.types';
import {
    BUILDING_VERTICAL_OFFSET_MAX_M,
    BUILDING_VERTICAL_OFFSET_MIN_M,
} from '@/lib/groundPlacementPad';
import type { SurroundLayoutMode } from '@/lib/worldEnvironments';
import type { SkyboxCollectionWithSlots } from '@/lib/skyboxCollections';
import type { SkyboxSlotRow } from '@/lib/skyboxEnvResolve';
const PANEL_WIDTH_EXPANDED = 320;
const PANEL_COLLAPSED_SIZE = 48;
const INSET = 16;
/** Extra offset from top `INSET` so the panel clears the top scene bar (back + lighting + world row). */
const LEFT_PANEL_TOP_BELOW_BACK_PX = 76;
const LEFT_PANEL_TOP = INSET + LEFT_PANEL_TOP_BELOW_BACK_PX;

/** Shared with `EngineNoMeshLeftFilterPanel` so the studio filter replaces the same left slot. */
export const ENGINE_SCENE_SIDE_INSET = INSET;
export const ENGINE_SCENE_SIDE_PANEL_TOP = LEFT_PANEL_TOP;
export const ENGINE_SCENE_SIDE_PANEL_WIDTH_EXPANDED = PANEL_WIDTH_EXPANDED;
export const ENGINE_SCENE_SIDE_PANEL_COLLAPSED = PANEL_COLLAPSED_SIZE;

const STORAGE_KEY = 'engineRightPanelCollapsed';

export interface EngineRightPanelProps {
    viewMode: 'exterior' | 'interior';
    isAdmin: boolean;
    buildingId: string | undefined;
    hideSkyboxCatalog: boolean;
    skyboxCollections: SkyboxCollectionWithSlots[];
    selectedCatalogCollectionId: string | null;
    selectedSkyboxSlotId: string | null;
    onSkyboxSlotChange: (slotId: string | null) => void;
    skySlotsForPicker: SkyboxSlotRow[];
    showSkySlotPicker: boolean;
    resolvedHdriUrl: string | null;
    selectedSkyboxUrl: string | null;
    onSkyboxChange: (value: string | null) => void;
    /** World preview only: upload HDR, add to library, PATCH world skybox */
    onWorldPreviewSkyboxFile?: (file: File) => void | Promise<void>;
    worldPreviewSkyboxUploading?: boolean;
    onSkyboxDefaultSaved: () => void;
    /** Ground pad controls — wired when store exposes these */
    hasGroundMesh: boolean;
    placementPadEditActive: boolean;
    onTogglePadEdit: () => void;
    padDisplayMode: 'flat' | 'followTerrain';
    onPadDisplayMode: (mode: 'flat' | 'followTerrain') => void;
    padSaveDisabled: boolean;
    padSaving: boolean;
    onSavePad: () => void | Promise<void>;
    onClearPad: () => void | Promise<void>;
    hasPlacementPad: boolean;
    /** Engine opened from /engine/world/[id] — no building */
    worldPreviewMode?: boolean;
    /** Extra rotation on the pad (degrees), on top of auto lengthwise 0/90° fit */
    showBuildingOrientation?: boolean;
    buildingOrientationDegrees?: number;
    onBuildingOrientationDegreesChange?: (deg: number) => void;
    /** Shift building up (+) / down (-) in meters after base-on-ground alignment */
    buildingVerticalOffsetM?: number;
    onBuildingVerticalOffsetMChange?: (meters: number) => void;
    /** Surround props from global catalog: pick asset and spacing (packed / spread / sparse). */
    showSurroundFill?: boolean;
    surroundCatalogAssets?: SurroundCatalogAssetRow[];
    activeSurroundCatalogAssetId?: string | null;
    surroundLayoutMode?: SurroundLayoutMode | null;
    surroundSaving?: boolean;
    onSurroundCatalogAssetChange?: (assetId: string | null) => void | Promise<void>;
    onSurroundLayoutModeChange?: (mode: SurroundLayoutMode | null) => void | Promise<void>;
}

function PanelLeftOpenIcon({ size = 22 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
        </svg>
    );
}

export default function EngineRightPanel({
    viewMode,
    isAdmin,
    buildingId,
    hideSkyboxCatalog,
    skyboxCollections,
    selectedCatalogCollectionId,
    selectedSkyboxSlotId,
    onSkyboxSlotChange,
    skySlotsForPicker,
    showSkySlotPicker,
    resolvedHdriUrl,
    selectedSkyboxUrl,
    onSkyboxChange,
    onWorldPreviewSkyboxFile,
    worldPreviewSkyboxUploading = false,
    onSkyboxDefaultSaved,
    hasGroundMesh,
    placementPadEditActive,
    onTogglePadEdit,
    padDisplayMode,
    onPadDisplayMode,
    padSaveDisabled,
    padSaving,
    onSavePad,
    onClearPad,
    hasPlacementPad,
    worldPreviewMode = false,
    showBuildingOrientation = false,
    buildingOrientationDegrees = 0,
    onBuildingOrientationDegreesChange,
    buildingVerticalOffsetM = 0,
    onBuildingVerticalOffsetMChange,
    showSurroundFill = false,
    surroundCatalogAssets = [],
    activeSurroundCatalogAssetId = null,
    surroundLayoutMode = null,
    surroundSaving = false,
    onSurroundCatalogAssetChange,
    onSurroundLayoutModeChange,
}: EngineRightPanelProps) {
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    });
    const [expandedHeight, setExpandedHeight] = useState(
        typeof window !== 'undefined' ? window.innerHeight - LEFT_PANEL_TOP - INSET : 500
    );
    const worldPreviewHdrInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
        } catch {
            /* ignore */
        }
    }, [collapsed]);

    useEffect(() => {
        const onResize = () => setExpandedHeight(window.innerHeight - LEFT_PANEL_TOP - INSET);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <motion.div
            className="absolute z-20 overflow-hidden glass-heavy flex flex-col pointer-events-auto"
            style={{ left: INSET, top: LEFT_PANEL_TOP }}
            initial={{ x: -60, opacity: 0 }}
            animate={{
                x: 0,
                opacity: 1,
                width: collapsed ? PANEL_COLLAPSED_SIZE : PANEL_WIDTH_EXPANDED,
                height: collapsed ? PANEL_COLLAPSED_SIZE : expandedHeight,
                borderRadius: collapsed ? PANEL_COLLAPSED_SIZE / 2 : 12,
            }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
            {collapsed ? (
                <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="w-full h-full flex items-center justify-center rounded-full text-[#94A3B8] hover:text-[#C6A664] transition-colors"
                    aria-label="Open scene panel"
                >
                    <PanelLeftOpenIcon size={22} />
                </button>
            ) : (
                <>
                    <div className="shrink-0 p-3 flex items-center justify-between gap-2 border-b border-white/5">
                        <span className="text-[10px] tracking-[0.25em] text-[#C6A664] uppercase font-bold truncate">Scene</span>
                        <button
                            type="button"
                            onClick={() => setCollapsed(true)}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors shrink-0"
                            aria-label="Collapse scene panel"
                        >
                            <PanelLeftClose size={18} strokeWidth={1.5} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-4 pt-2 flex flex-col gap-5">
                        {viewMode === 'exterior' && (
                            <>
                                {(worldPreviewMode || (skyboxCollections.length > 0 && !hideSkyboxCatalog)) && (
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">Sky collection</span>
                                        {worldPreviewMode && onWorldPreviewSkyboxFile && (
                                            <>
                                                <input
                                                    ref={worldPreviewHdrInputRef}
                                                    type="file"
                                                    accept=".hdr,.hdri"
                                                    className="sr-only"
                                                    aria-label="Upload HDR skybox"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) void onWorldPreviewSkyboxFile(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={worldPreviewSkyboxUploading}
                                                    onClick={() => worldPreviewHdrInputRef.current?.click()}
                                                    className="glass-heavy w-full px-3 py-2 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-[10px] tracking-widest uppercase font-bold text-[#C6A664] hover:bg-[#C6A664]/10 transition-colors disabled:opacity-50"
                                                >
                                                    {worldPreviewSkyboxUploading ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <ImagePlus size={14} />
                                                    )}
                                                    Upload HDR skybox
                                                </button>
                                                <p className="text-[10px] text-[#94A3B8]/80 leading-relaxed">
                                                    Adds a sky collection (one HDR slot) and attaches it to this world.
                                                </p>
                                            </>
                                        )}
                                        {skyboxCollections.length > 0 && (
                                            <div className="glass-heavy w-full min-w-0 px-2 py-2 rounded-xl border border-white/10 flex flex-wrap items-center gap-2">
                                                <CustomSelect
                                                    variant="compact"
                                                    frame="inline"
                                                    value={
                                                        selectedSkyboxUrl === '__none__'
                                                            ? '__none__'
                                                            : (selectedCatalogCollectionId ?? '')
                                                    }
                                                    onChange={(v) => onSkyboxChange(v === '' ? null : v)}
                                                    className="min-w-0 w-full flex-1"
                                                    options={[
                                                        { value: '', label: 'Default sky' },
                                                        { value: '__none__', label: 'No skybox' },
                                                        ...skyboxCollections.map((c) => ({
                                                            value: c.id,
                                                            label: c.label,
                                                        })),
                                                    ]}
                                                />
                                                {isAdmin &&
                                                    resolvedHdriUrl &&
                                                    selectedSkyboxUrl !== '__none__' &&
                                                    buildingId && (
                                                    <SetDefaultSkyboxButton
                                                        buildingId={buildingId}
                                                        url={resolvedHdriUrl}
                                                        onSaved={onSkyboxDefaultSaved}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {showSkySlotPicker && skySlotsForPicker.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">Time of day</span>
                                        <div className="flex flex-col gap-1.5">
                                            {skySlotsForPicker.map((slot, idx) => {
                                                const isFirst = idx === 0;
                                                const isActive =
                                                    selectedSkyboxSlotId === slot.id ||
                                                    (selectedSkyboxSlotId === null && isFirst);
                                                return (
                                                    <button
                                                        key={slot.id}
                                                        type="button"
                                                        onClick={() => onSkyboxSlotChange(isFirst ? null : slot.id)}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 border text-left ${
                                                            isActive
                                                                ? 'bg-[#C6A664]/25 border-[#C6A664]/50 text-[#F5F7FA]'
                                                                : 'border-white/10 text-[#94A3B8] hover:text-[#F5F7FA] hover:border-white/20'
                                                        }`}
                                                    >
                                                        <Sun size={14} className={isActive ? '' : 'opacity-60'} />
                                                        <span className="text-[10px] tracking-widest uppercase font-bold">{slot.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {showSurroundFill && onSurroundCatalogAssetChange && onSurroundLayoutModeChange && (
                                    <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                                        <span className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                            Surround fill
                                        </span>
                                        <p className="text-[10px] text-[#94A3B8]/80 leading-relaxed">
                                            Choose a library prop and how densely it fills the ring outside the ground
                                            mesh. Both are required for props to appear; clear the prop to remove them.
                                        </p>
                                        <div className="glass-heavy w-full min-w-0 px-2 py-2 rounded-xl border border-white/10 flex flex-col gap-2">
                                            <CustomSelect
                                                variant="compact"
                                                frame="inline"
                                                value={activeSurroundCatalogAssetId ?? ''}
                                                onChange={(v) => void onSurroundCatalogAssetChange(v === '' ? null : v)}
                                                disabled={surroundSaving}
                                                className="w-full min-w-0"
                                                options={[
                                                    { value: '', label: 'Choose prop…' },
                                                    ...surroundCatalogAssets.map((a) => ({
                                                        value: a.id,
                                                        label: a.label,
                                                    })),
                                                ]}
                                            />
                                            <CustomSelect
                                                variant="compact"
                                                frame="inline"
                                                value={surroundLayoutMode ?? ''}
                                                onChange={(v) =>
                                                    void onSurroundLayoutModeChange(
                                                        v === '' ? null : (v as SurroundLayoutMode)
                                                    )
                                                }
                                                disabled={surroundSaving}
                                                className="w-full min-w-0"
                                                options={[
                                                    { value: '', label: 'Choose spacing…' },
                                                    { value: 'packed', label: 'Packed (grid)' },
                                                    { value: 'spread', label: 'Spread' },
                                                    { value: 'sparse', label: 'Sparse' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                )}

                                {hasGroundMesh && ((isAdmin && !!buildingId) || worldPreviewMode) && (
                                    <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                                        <span className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                            {worldPreviewMode ? 'Default placement pad' : 'Ground placement'}
                                        </span>
                                        <p className="text-[10px] text-[#94A3B8]/80 leading-relaxed">
                                            {worldPreviewMode
                                                ? 'With editing on: new pads snap to the ground footprint. Drag the gold pad to move it on the ground; drag corners to resize. Shift + Arrow Up/Down nudges the pad vertically. Save sets the world default when a building has no pad.'
                                                : 'With editing on: drag the gold pad body to move it on the ground; drag corners to resize (axis-aligned rectangle). Corners show a resize cursor; the body shows a grab cursor while dragging. Shift + Arrow Up/Down moves the pad vertically. The building scales to fit inside the pad (contain).'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={onTogglePadEdit}
                                            className={`w-full py-2 rounded-xl text-[10px] tracking-widest uppercase font-bold border transition-colors ${
                                                placementPadEditActive
                                                    ? 'border-[#C6A664] bg-[#C6A664]/15 text-[#C6A664]'
                                                    : 'border-white/10 text-[#F5F7FA] hover:bg-white/5'
                                            }`}
                                        >
                                            {placementPadEditActive ? 'Done editing' : 'Edit placement pad'}
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onPadDisplayMode('flat')}
                                                className={`flex-1 py-2 rounded-lg text-[9px] tracking-wider uppercase font-bold border ${
                                                    padDisplayMode === 'flat'
                                                        ? 'border-[#C6A664]/50 bg-[#C6A664]/10 text-[#C6A664]'
                                                        : 'border-white/10 text-[#94A3B8]'
                                                }`}
                                            >
                                                Flat pad
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onPadDisplayMode('followTerrain')}
                                                className={`flex-1 py-2 rounded-lg text-[9px] tracking-wider uppercase font-bold border ${
                                                    padDisplayMode === 'followTerrain'
                                                        ? 'border-[#C6A664]/50 bg-[#C6A664]/10 text-[#C6A664]'
                                                        : 'border-white/10 text-[#94A3B8]'
                                                }`}
                                            >
                                                Follow terrain
                                            </button>
                                        </div>
                                        {showBuildingOrientation && onBuildingOrientationDegreesChange && viewMode === 'exterior' ? (
                                            <div className="flex flex-col gap-1.5 pt-1">
                                                <span className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                                    Building orientation
                                                </span>
                                                <p className="text-[9px] text-[#94A3B8]/75 leading-snug">
                                                    Long edge is auto-aligned to the pad’s long edge (0° or 90°). Use the slider
                                                    to fine-tune, then save the pad.
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min={-180}
                                                        max={180}
                                                        step={1}
                                                        value={buildingOrientationDegrees}
                                                        onChange={(e) => onBuildingOrientationDegreesChange(Number(e.target.value))}
                                                        className="flex-1 accent-[#C6A664] h-1.5"
                                                    />
                                                    <span className="text-[10px] tabular-nums text-[#C6A664] w-10 text-right shrink-0">
                                                        {buildingOrientationDegrees}°
                                                    </span>
                                                </div>
                                            </div>
                                        ) : null}
                                        {viewMode === 'exterior' && hasPlacementPad && onBuildingVerticalOffsetMChange ? (
                                            <div className="flex flex-col gap-1.5 pt-1">
                                                <span className="text-[9px] tracking-[0.2em] text-[#94A3B8] uppercase">
                                                    Building height on pad
                                                </span>
                                                <p className="text-[9px] text-[#94A3B8]/75 leading-snug">
                                                    Moves the fitted building up or down in world space after the red base
                                                    sits on the ground. The gold pad stays on the terrain; use this to tuck
                                                    the base in or lift slightly above the mesh.
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min={BUILDING_VERTICAL_OFFSET_MIN_M}
                                                        max={BUILDING_VERTICAL_OFFSET_MAX_M}
                                                        step={0.05}
                                                        value={buildingVerticalOffsetM}
                                                        onChange={(e) =>
                                                            onBuildingVerticalOffsetMChange(Number(e.target.value))
                                                        }
                                                        className="flex-1 accent-[#C6A664] h-1.5"
                                                    />
                                                    <span className="text-[10px] tabular-nums text-[#C6A664] w-14 text-right shrink-0">
                                                        {buildingVerticalOffsetM >= 0 ? '+' : ''}
                                                        {buildingVerticalOffsetM.toFixed(2)} m
                                                    </span>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={padSaveDisabled || padSaving}
                                                onClick={() => void onSavePad()}
                                                className="flex-1 py-2 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                                            >
                                                {padSaving ? 'Saving…' : 'Save pad'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!hasPlacementPad || padSaving}
                                                onClick={() => void onClearPad()}
                                                className="flex-1 py-2 rounded-xl border border-white/15 text-[#94A3B8] text-[10px] tracking-widest uppercase disabled:opacity-40"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {viewMode === 'interior' && (
                            <p className="text-[10px] text-[#94A3B8] tracking-wide">Scene options apply in exterior view.</p>
                        )}
                    </div>
                </>
            )}
        </motion.div>
    );
}
