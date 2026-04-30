'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trash2, Layout, Eye, MapPin } from 'lucide-react';
import AdminUnitForm from './AdminUnitForm';
import AddHotspotModal from './AddHotspotModal';
import { formatCentsToCurrency } from '@/lib/currency';
import { useEngineStore } from '@/engine/store/engine.store';
import type { Database } from '@/lib/database.types';
import type { InteriorHotspot } from '@/lib/database.types';
import type { CSSProperties } from 'react';

type UnitRow = Database['public']['Tables']['units']['Row'];

const STATUS_DOT: Record<string, string> = {
    available: 'status-available',
    pending: 'status-pending',
    sold: 'status-sold',
};
const STATUS_LABEL: Record<string, string> = {
    available: 'Available',
    pending: 'Pending',
    sold: 'Allocated',
};

const STUDIO_TEXT = '#715852';
const STUDIO_MUTED = '#AE928A';

function formatNairaFromCents(cents: number): string {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(cents / 100);
}

interface EngineSidebarSelectedUnitProps {
    selectedUnit: string | null;
    selectedUnitData: UnitRow | undefined;
    currentStatus: string | null;
    unitFormError: string | null;
    isAdmin: boolean;
    onOpenInteriorModal: () => void;
    deleteSubmitting: boolean;
    onReserve: () => void;
    onUnitSaved: () => void;
    onDeleteUnit: (unitId: string) => Promise<void>;
    setSelectedUnit: (id: string | null) => void;
    setUnitFormError: (msg: string | null) => void;
    onInteriorUploaded: () => void;
    onViewInterior: () => void;
    onSaveHotspots: (unitId: string, hotspots: InteriorHotspot[]) => void;
    setDeleteSubmitting: (v: boolean) => void;
    isFullView?: boolean;
    /** Match studio listings table (no world mesh exterior). */
    studioListingStyle?: boolean;
}

export default function EngineSidebarSelectedUnit({
    selectedUnit,
    selectedUnitData,
    currentStatus,
    unitFormError,
    isAdmin,
    onOpenInteriorModal,
    deleteSubmitting,
    onReserve,
    onUnitSaved,
    onDeleteUnit,
    setSelectedUnit,
    setUnitFormError,
    onInteriorUploaded: _onInteriorUploaded,
    onViewInterior,
    onSaveHotspots,
    setDeleteSubmitting,
    isFullView = false,
    studioListingStyle = false,
}: EngineSidebarSelectedUnitProps) {
    const { hotspotPlacementMode, setHotspotPlacementMode, capturedHotspotPosition, setCapturedHotspotPosition, viewMode } =
        useEngineStore();
    const footprint = selectedUnitData ? (selectedUnitData as { footprint?: [number, number][] | null }).footprint : null;
    const isFootprintPrism = Array.isArray(footprint) && footprint.length >= 3;
    const geometryLocked = selectedUnitData?.section_plan_sourced === true;

    const studio = studioListingStyle;
    const studioCardStyle: CSSProperties | undefined = studio
        ? {
              background: '#E4DCD5CC',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 12,
              lineHeight: '150%',
              letterSpacing: '0',
              color: STUDIO_TEXT,
          }
        : undefined;

    const statusKey = currentStatus ?? 'available';
    const clientCanReserve = statusKey === 'available';

    return (
        <>
            <AnimatePresence mode="wait">
                {selectedUnit && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        style={studioCardStyle}
                        className={
                            studio
                                ? 'p-6 rounded-lg border border-[rgba(113,88,82,0.18)]'
                                : isFullView
                                  ? 'p-8 glass-heavy'
                                  : 'p-8 pt-6 border-t border-white/5 glass-heavy'
                        }
                    >
                        <div className="flex justify-between items-end mb-6 gap-3">
                            <div className="min-w-0">
                                <div
                                    className={`text-[10px] uppercase mb-1.5 tracking-[0.2em] ${studio ? '' : 'text-[#C6A664] tracking-[0.25em]'}`}
                                    style={studio ? { color: `${STUDIO_TEXT}99` } : undefined}
                                >
                                    Selected inventory
                                </div>
                                <h4
                                    className={`text-2xl ${studio ? 'font-semibold tracking-tight' : 'font-serif-display text-[#F5F7FA]'}`}
                                    style={studio ? { color: STUDIO_TEXT } : undefined}
                                >
                                    Unit {selectedUnitData?.unit_number}
                                </h4>
                            </div>
                            <div className="text-right shrink-0">
                                {studio ? (
                                    <>
                                        <div
                                            className="text-[10px] tracking-widest uppercase mb-1.5"
                                            style={{ color: clientCanReserve ? STUDIO_TEXT : STUDIO_MUTED }}
                                        >
                                            {STATUS_LABEL[statusKey] ?? statusKey}
                                        </div>
                                        <div className="text-xl font-medium tabular-nums" style={{ color: STUDIO_TEXT }}>
                                            {selectedUnitData?.price
                                                ? formatNairaFromCents(Number(selectedUnitData.price))
                                                : '—'}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={`text-[10px] tracking-widest uppercase mb-1.5 ${STATUS_DOT[statusKey]}`}>
                                            {STATUS_LABEL[statusKey]}
                                        </div>
                                        <div className="text-xl font-light text-[#F5F7FA]">
                                            {selectedUnitData?.price ? formatCentsToCurrency(Number(selectedUnitData.price)) : ''}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        {isAdmin && isFootprintPrism && viewMode === 'exterior' && !geometryLocked && (
                            <p
                                className={`text-[9px] leading-relaxed tracking-wide mb-4 max-w-[280px] ${studio ? '' : 'text-white/45'}`}
                                style={studio ? { color: `${STUDIO_TEXT}aa` } : undefined}
                            >
                                3D: Shift+arrows move · L/H/B+Shift+↑↓ resize length / height / breadth (height grows upward).
                            </p>
                        )}
                        <div className="space-y-3">
                            {isAdmin && selectedUnitData ? (
                                <>
                                    {selectedUnitData.internal_model_url ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={onViewInterior}
                                                className={
                                                    studio
                                                        ? 'py-2.5 rounded-lg border border-[rgba(113,88,82,0.35)] bg-white/35 text-[11px] tracking-wide uppercase font-medium flex items-center justify-center gap-1.5 hover:bg-white/55 transition-colors'
                                                        : 'py-2.5 rounded-xl bg-[#C6A664]/20 border border-[#C6A664]/50 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-1.5 hover:bg-[#C6A664]/30 transition-colors'
                                                }
                                                style={studio ? { color: STUDIO_TEXT } : undefined}
                                            >
                                                <Eye size={12} />
                                                View interior
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onOpenInteriorModal}
                                                className={
                                                    studio
                                                        ? 'py-2.5 rounded-lg border border-[rgba(113,88,82,0.35)] bg-white/25 text-[11px] tracking-wide uppercase font-medium flex items-center justify-center gap-1.5 hover:bg-white/45 transition-colors'
                                                        : 'py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-1.5 hover:bg-[#C6A664]/10 transition-colors'
                                                }
                                                style={studio ? { color: STUDIO_TEXT } : undefined}
                                            >
                                                <Layout size={12} />
                                                Replace
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={onOpenInteriorModal}
                                            className={
                                                studio
                                                    ? 'w-full py-2.5 rounded-lg border border-[rgba(113,88,82,0.35)] bg-white/30 text-[11px] tracking-wide uppercase font-medium flex items-center justify-center gap-2 hover:bg-white/45 transition-colors'
                                                    : 'w-full py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-[#C6A664]/10 transition-colors'
                                            }
                                            style={studio ? { color: STUDIO_TEXT } : undefined}
                                        >
                                            <Layout size={12} />
                                            Add interior view
                                        </button>
                                    )}
                                    {selectedUnitData.internal_model_url && (
                                        <div className="space-y-2">
                                            <div
                                                className={`text-[10px] uppercase tracking-[0.15em] ${studio ? '' : 'text-[#C6A664] tracking-[0.2em]'}`}
                                                style={studio ? { color: `${STUDIO_TEXT}aa` } : undefined}
                                            >
                                                Hotspots
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setHotspotPlacementMode(true)}
                                                className={
                                                    studio
                                                        ? 'w-full py-2 rounded-lg border border-[rgba(113,88,82,0.28)] bg-white/35 text-[10px] tracking-wide uppercase flex items-center justify-center gap-1.5 hover:bg-white/50 transition-colors'
                                                        : 'w-full py-2 rounded-xl border border-white/10 text-[#94A3B8] text-[10px] tracking-wider uppercase flex items-center justify-center gap-1.5 hover:bg-white/5'
                                                }
                                                style={studio ? { color: STUDIO_TEXT } : undefined}
                                            >
                                                <MapPin size={11} />
                                                {hotspotPlacementMode ? 'Click in view to place…' : 'Add hotspot'}
                                            </button>
                                            {(selectedUnitData.hotspots?.length ?? 0) > 0 && (
                                                <ul
                                                    className={`space-y-1 max-h-24 overflow-y-auto pr-0.5 ${studio ? 'engine-units-scroll' : 'custom-scrollbar'}`}
                                                >
                                                    {selectedUnitData.hotspots!.map((h) => (
                                                        <li
                                                            key={h.id}
                                                            className={
                                                                studio
                                                                    ? 'flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg border border-[rgba(113,88,82,0.2)] bg-white/40'
                                                                    : 'flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-white/5'
                                                            }
                                                        >
                                                            <span
                                                                className={`text-[11px] truncate ${studio ? '' : 'text-[#F5F7FA]'}`}
                                                                style={studio ? { color: STUDIO_TEXT } : undefined}
                                                            >
                                                                {h.title}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = selectedUnitData.hotspots!.filter((x) => x.id !== h.id);
                                                                    onSaveHotspots(selectedUnitData.id, next);
                                                                }}
                                                                className={
                                                                    studio
                                                                        ? 'p-1 rounded text-red-700/90 hover:bg-red-600/15'
                                                                        : 'p-1 rounded text-red-400 hover:bg-red-500/20'
                                                                }
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={`max-h-[50vh] overflow-y-auto pr-1 -mr-1 ${studio ? 'engine-units-scroll' : 'custom-scrollbar'}`}
                                    >
                                        <AdminUnitForm
                                            unit={selectedUnitData}
                                            onSaved={onUnitSaved}
                                            onError={setUnitFormError}
                                            geometryLocked={geometryLocked}
                                            studioListingStyle={studio}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!selectedUnitData?.id || !window.confirm(`Remove unit ${selectedUnitData.unit_number}? This cannot be undone.`))
                                                return;
                                            setDeleteSubmitting(true);
                                            setUnitFormError(null);
                                            await onDeleteUnit(selectedUnitData.id);
                                            setDeleteSubmitting(false);
                                        }}
                                        disabled={deleteSubmitting}
                                        className={
                                            studio
                                                ? 'w-full mt-3 py-2.5 rounded-lg border border-red-700/35 text-red-800 text-[10px] tracking-[0.15em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-red-600/10 transition-colors disabled:opacity-50'
                                                : 'w-full mt-3 py-2.5 rounded-xl border border-red-500/40 text-red-400 text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors disabled:opacity-50'
                                        }
                                    >
                                        <Trash2 size={12} />
                                        Delete unit box
                                    </button>
                                    {unitFormError && (
                                        <p className={`text-xs mt-2 ${studio ? 'text-red-800' : 'text-red-400'}`}>{unitFormError}</p>
                                    )}
                                </>
                            ) : !isAdmin ? (
                                <>
                                    {clientCanReserve ? (
                                        <button
                                            onClick={onReserve}
                                            className={
                                                studio
                                                    ? 'w-full py-4 rounded-lg text-[11px] tracking-[0.15em] font-bold uppercase transition-transform active:scale-[0.98] shadow-sm'
                                                    : 'w-full py-4 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-[#C6A664]/20'
                                            }
                                            style={studio ? { background: STUDIO_TEXT, color: '#F5F0EB' } : undefined}
                                        >
                                            Request allocation
                                        </button>
                                    ) : (
                                        <div
                                            className={
                                                studio
                                                    ? 'w-full py-4 rounded-lg border text-[11px] tracking-[0.15em] font-bold uppercase text-center flex items-center justify-center gap-2'
                                                    : 'w-full py-4 rounded-xl border border-white/5 bg-white/5 text-[#94A3B8] text-[11px] tracking-[0.2em] font-bold uppercase text-center flex items-center justify-center gap-2'
                                            }
                                            style={
                                                studio
                                                    ? {
                                                          borderColor: 'rgba(113,88,82,0.25)',
                                                          background: 'rgba(255,255,255,0.35)',
                                                          color: STUDIO_MUTED,
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <Lock size={12} />
                                            Unit not available
                                        </div>
                                    )}
                                </>
                            ) : null}
                            <button
                                onClick={() => {
                                    setSelectedUnit(null);
                                    setUnitFormError(null);
                                }}
                                className={
                                    studio
                                        ? 'w-full py-3.5 rounded-lg border border-[rgba(113,88,82,0.3)] text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-white/35 transition-colors'
                                        : 'w-full py-3.5 rounded-xl border border-white/5 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors'
                                }
                                style={studio ? { color: STUDIO_TEXT } : undefined}
                            >
                                Dismiss selection
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AddHotspotModal
                open={capturedHotspotPosition !== null}
                position={capturedHotspotPosition}
                onSave={(data) => {
                    if (!selectedUnitData?.id || !capturedHotspotPosition) return;
                    const newHotspot: InteriorHotspot = {
                        id: crypto.randomUUID(),
                        position: capturedHotspotPosition,
                        title: data.title,
                        material: data.material || undefined,
                        description: data.description || undefined,
                    };
                    const next = [...(selectedUnitData.hotspots ?? []), newHotspot];
                    onSaveHotspots(selectedUnitData.id, next);
                    setCapturedHotspotPosition(null);
                }}
                onCancel={() => setCapturedHotspotPosition(null)}
            />
        </>
    );
}
