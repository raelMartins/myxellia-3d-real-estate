'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trash2, Layout, Eye, MapPin } from 'lucide-react';
import AdminUnitForm from './AdminUnitForm';
import AddHotspotModal from './AddHotspotModal';
import { formatCentsToCurrency } from '@/lib/currency';
import { useEngineStore } from '@/engine/store/engine.store';
import type { Database } from '@/lib/database.types';
import type { InteriorHotspot } from '@/lib/database.types';

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
}: EngineSidebarSelectedUnitProps) {
    const { hotspotPlacementMode, setHotspotPlacementMode, capturedHotspotPosition, setCapturedHotspotPosition } = useEngineStore();

    return (
        <>
            <AnimatePresence mode="wait">
                {selectedUnit && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className={isFullView ? 'p-8 glass-heavy' : 'p-8 pt-6 border-t border-white/5 glass-heavy'}
                    >
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <div className="text-[9px] tracking-[0.25em] text-[#C6A664] uppercase mb-1.5">Selected Inventory</div>
                                <h4 className="text-2xl font-serif-display text-[#F5F7FA]">Unit {selectedUnitData?.unit_number}</h4>
                            </div>
                            <div className="text-right">
                                <div className={`text-[10px] tracking-widest uppercase mb-1.5 ${STATUS_DOT[currentStatus ?? 'available']}`}>
                                    {STATUS_LABEL[currentStatus ?? 'available']}
                                </div>
                                <div className="text-xl font-light text-[#F5F7FA]">
                                    {selectedUnitData?.price ? formatCentsToCurrency(Number(selectedUnitData.price)) : ''}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {isAdmin && selectedUnitData ? (
                                <>
                                    {selectedUnitData.internal_model_url ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={onViewInterior}
                                                className="py-2.5 rounded-xl bg-[#C6A664]/20 border border-[#C6A664]/50 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-1.5 hover:bg-[#C6A664]/30 transition-colors"
                                            >
                                                <Eye size={12} />
                                                View interior
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onOpenInteriorModal}
                                                className="py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-1.5 hover:bg-[#C6A664]/10 transition-colors"
                                            >
                                                <Layout size={12} />
                                                Replace
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={onOpenInteriorModal}
                                            className="w-full py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-[#C6A664]/10 transition-colors"
                                        >
                                            <Layout size={12} />
                                            Add interior view
                                        </button>
                                    )}
                                    {selectedUnitData.internal_model_url && (
                                        <div className="space-y-2">
                                            <div className="text-[9px] tracking-[0.2em] text-[#C6A664] uppercase">Hotspots</div>
                                            <button
                                                type="button"
                                                onClick={() => setHotspotPlacementMode(true)}
                                                className="w-full py-2 rounded-xl border border-white/10 text-[#94A3B8] text-[10px] tracking-wider uppercase flex items-center justify-center gap-1.5 hover:bg-white/5"
                                            >
                                                <MapPin size={11} />
                                                {hotspotPlacementMode ? 'Click in view to place…' : 'Add hotspot'}
                                            </button>
                                            {(selectedUnitData.hotspots?.length ?? 0) > 0 && (
                                                <ul className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                                                    {selectedUnitData.hotspots!.map((h) => (
                                                        <li key={h.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-white/5">
                                                            <span className="text-[11px] text-[#F5F7FA] truncate">{h.title}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = selectedUnitData.hotspots!.filter((x) => x.id !== h.id);
                                                                    onSaveHotspots(selectedUnitData.id, next);
                                                                }}
                                                                className="p-1 rounded text-red-400 hover:bg-red-500/20"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 -mr-1">
                                        <AdminUnitForm
                                            unit={selectedUnitData}
                                            onSaved={onUnitSaved}
                                            onError={setUnitFormError}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!selectedUnitData?.id || !window.confirm(`Remove unit ${selectedUnitData.unit_number}? This cannot be undone.`)) return;
                                            setDeleteSubmitting(true);
                                            setUnitFormError(null);
                                            await onDeleteUnit(selectedUnitData.id);
                                            setDeleteSubmitting(false);
                                        }}
                                        disabled={deleteSubmitting}
                                        className="w-full mt-3 py-2.5 rounded-xl border border-red-500/40 text-red-400 text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={12} />
                                        Delete unit box
                                    </button>
                                    {unitFormError && (
                                        <p className="text-red-400 text-xs mt-2">{unitFormError}</p>
                                    )}
                                </>
                            ) : !isAdmin ? (
                                <>
                                    {currentStatus === 'available' ? (
                                        <button
                                            onClick={onReserve}
                                            className="w-full py-4 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-[#C6A664]/20"
                                        >
                                            Request Allocation
                                        </button>
                                    ) : (
                                        <div className="w-full py-4 rounded-xl border border-white/5 bg-white/5 text-[#94A3B8] text-[11px] tracking-[0.2em] font-bold uppercase text-center flex items-center justify-center gap-2">
                                            <Lock size={12} />
                                            Unit Not Available
                                        </div>
                                    )}
                                </>
                            ) : null}
                            <button
                                onClick={() => { setSelectedUnit(null); setUnitFormError(null); }}
                                className="w-full py-3.5 rounded-xl border border-white/5 text-[#94A3B8] text-[10px] tracking-[0.2em] uppercase hover:bg-white/5 transition-colors"
                            >
                                Dismiss Selection
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
