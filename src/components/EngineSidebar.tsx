'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, PanelLeft, PanelLeftClose } from 'lucide-react';
import EngineSidebarSelectedUnit from './EngineSidebarSelectedUnit';
import AddUnitsModal from './AddUnitsModal';
import type { UnitIdentityValues } from './UnitIdentityForm';
import type { GeometryData } from './UnitGeometryStep';
import { useEngineStore } from '@/engine/store/engine.store';
import { formatCentsToCurrency } from '@/lib/currency';
import type { Database } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];

const SIDEBAR_WIDTH_EXPANDED = 320;
const SIDEBAR_COLLAPSED_SIZE = 48;
const INSET = 16;
const STATUS_DOT: Record<string, string> = {
    available: 'status-available',
    pending: 'status-pending',
    sold: 'status-sold',
};

interface EngineSidebarProps {
    floors: { id: string; name: string; units: UnitRow[] }[];
    selectedUnitData: UnitRow | undefined;
    currentStatus: string | null;
    unitFormError: string | null;
    isAdmin: boolean;
    singleUnitMode?: boolean;
    onReserve: () => void;
    onUnitSaved: () => void;
    onAddUnit: (unitNumber: string, floor: number) => Promise<void>;
    onDeleteUnit: (unitId: string) => Promise<void>;
    setUnitFormError: (msg: string | null) => void;
    onInteriorUploaded: () => void;
    onViewInterior: () => void;
    onSaveHotspots: (unitId: string, hotspots: import('@/lib/database.types').InteriorHotspot[]) => void;
    onOpenInteriorModal: () => void;
    onCreateUnitComplete: (identity: UnitIdentityValues, geometry: GeometryData, interiorFile: File | null) => Promise<import('./AddUnitsModal').UnitCreateResult | null>;
    onUnitCreatedWithInterior?: (unitId: string) => void;
    onOpenBuildingPlan?: () => void;
    /** World-only engine preview (no building) */
    worldPreviewMode?: boolean;
    worldPreviewLabel?: string;
}

export default function EngineSidebar({
    floors,
    selectedUnitData,
    currentStatus,
    unitFormError,
    isAdmin,
    singleUnitMode = false,
    onReserve,
    onUnitSaved,
    onAddUnit: _onAddUnit,
    onDeleteUnit,
    setUnitFormError,
    onInteriorUploaded,
    onViewInterior,
    onSaveHotspots,
    onOpenInteriorModal,
    onCreateUnitComplete,
    onUnitCreatedWithInterior,
    onOpenBuildingPlan,
    worldPreviewMode = false,
    worldPreviewLabel = 'World',
}: EngineSidebarProps) {
    const params = useParams();
    const buildingId = (params?.buildingId as string | undefined) ?? undefined;
    const router = useRouter();
    const {
        building, selectedUnit, hoveredUnit, unitStatuses,
        setSelectedUnit, setHoveredUnit,
    } = useEngineStore();
    const [addUnitsModalOpen, setAddUnitsModalOpen] = useState(false);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [expandedHeight, setExpandedHeight] = useState(
        typeof window !== 'undefined' ? window.innerHeight - INSET * 2 : 500
    );

    useEffect(() => {
        if (selectedUnit) setCollapsed(false);
    }, [selectedUnit]);

    useEffect(() => {
        const onResize = () => setExpandedHeight(window.innerHeight - INSET * 2);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <motion.div
            className="absolute z-20 overflow-hidden glass-heavy flex flex-col"
            style={{ left: INSET, top: INSET }}
            initial={{ x: -60, opacity: 0 }}
            animate={{
                x: 0,
                opacity: 1,
                width: collapsed ? SIDEBAR_COLLAPSED_SIZE : SIDEBAR_WIDTH_EXPANDED,
                height: collapsed ? SIDEBAR_COLLAPSED_SIZE : expandedHeight,
                borderRadius: collapsed ? SIDEBAR_COLLAPSED_SIZE / 2 : 12,
            }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
            {collapsed ? (
                <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="w-full h-full flex items-center justify-center rounded-full text-[#94A3B8] hover:text-[#C6A664] transition-colors"
                    aria-label="Open sidebar"
                >
                    <PanelLeft size={22} strokeWidth={1.5} />
                </button>
            ) : worldPreviewMode ? (
                <>
                    <div className="shrink-0 p-6 pb-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => router.push('/world-environments')}
                                className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase hover:text-[#C6A664] transition-colors group"
                            >
                                <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                                World environments
                            </button>
                            <button
                                type="button"
                                onClick={() => setCollapsed(true)}
                                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors"
                                aria-label="Collapse sidebar"
                            >
                                <PanelLeftClose size={18} strokeWidth={1.5} />
                            </button>
                        </div>
                        <div>
                            <p className="text-[9px] tracking-[0.3em] text-[#C6A664] uppercase mb-2">World preview</p>
                            <h2 className="font-serif-display text-2xl tracking-tight text-[#F5F7FA] leading-tight">{worldPreviewLabel}</h2>
                            <p className="text-[11px] text-[#94A3B8] mt-3 leading-relaxed">
                                Orbit the scene. Use the right panel to edit the default placement pad for projects that use this world (buildings without their own pad inherit it).
                            </p>
                        </div>
                    </div>
                </>
            ) : selectedUnit || singleUnitMode ? (
                <>
                    <div className="shrink-0 p-4 pb-2 flex items-center justify-between gap-2">
                        <button
                            onClick={() => {
                                if (singleUnitMode) {
                                    if (buildingId) router.push(`/detail/${buildingId}`);
                                    else router.push('/');
                                } else {
                                    setSelectedUnit(null);
                                    setUnitFormError(null);
                                }
                            }}
                            className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase hover:text-[#C6A664] transition-colors group"
                        >
                            <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                            {singleUnitMode ? 'Back' : 'Back'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setCollapsed(true)}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors"
                            aria-label="Collapse sidebar"
                        >
                            <PanelLeftClose size={18} strokeWidth={1.5} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar min-w-0">
                        <EngineSidebarSelectedUnit
                            selectedUnit={selectedUnit}
                            selectedUnitData={selectedUnitData}
                            currentStatus={currentStatus}
                            unitFormError={unitFormError}
                            isAdmin={isAdmin}
                            onOpenInteriorModal={onOpenInteriorModal}
                            deleteSubmitting={deleteSubmitting}
                            onReserve={onReserve}
                            onUnitSaved={onUnitSaved}
                            onDeleteUnit={onDeleteUnit}
                            setSelectedUnit={setSelectedUnit}
                            setUnitFormError={setUnitFormError}
                            onInteriorUploaded={onInteriorUploaded}
                            onViewInterior={onViewInterior}
                            onSaveHotspots={onSaveHotspots}
                            setDeleteSubmitting={setDeleteSubmitting}
                            isFullView
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="flex-1 flex flex-col min-h-0 glass-heavy">
                        <div className="p-5 pb-3">
                            <div className="flex items-center justify-between gap-2 mb-4">
                            <button
                                onClick={() => router.push(`/detail/${buildingId}`)}
                                className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase hover:text-[#C6A664] transition-colors group"
                            >
                                <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                                Back to Summary
                            </button>
                            <button
                                type="button"
                                onClick={() => setCollapsed(true)}
                                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors"
                                aria-label="Collapse sidebar"
                            >
                                <PanelLeftClose size={18} strokeWidth={1.5} />
                            </button>
                        </div>
                        <h2 className="font-serif-display text-3xl tracking-tight text-[#F5F7FA] leading-none mb-1.5">
                            {building?.name || 'Project'}
                        </h2>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse-neon" />
                            <span className="text-[9px] tracking-[0.3em] text-[#94A3B8] uppercase">Interactive Engine</span>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-5 custom-scrollbar min-w-0">
                        <div className="space-y-4 pb-8">
                            {floors.map((floor) => (
                                <div key={floor.id} className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-white/5" />
                                        <h4 className="text-[9px] tracking-[0.22em] uppercase text-[#C6A664] font-medium whitespace-nowrap">
                                            {floor.name}
                                        </h4>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>
                                    <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
                                        {floor.units.map((unit) => {
                                            const status = unitStatuses[unit.id] ?? 'available';
                                            const isSelected = selectedUnit === unit.id;
                                            const isHovered = hoveredUnit === unit.id;
                                            return (
                                                <li key={unit.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedUnit(unit.id)}
                                                        onMouseEnter={() => setHoveredUnit(unit.id)}
                                                        onMouseLeave={() => setHoveredUnit(null)}
                                                        className={`
                                                            relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-200
                                                            ${isSelected ? 'glass-heavy border border-[#C6A664]/35 bg-white/5 ring-1 ring-[#C6A664]/15' : 'border border-transparent hover:bg-white/[0.04]'}
                                                        `}
                                                    >
                                                        <span className={`shrink-0 text-[11px] font-medium tabular-nums ${isSelected ? 'text-[#F5F7FA]' : 'text-[#94A3B8]'}`}>
                                                            {unit.unit_number}
                                                        </span>
                                                        <span className="flex-1 min-w-0 text-[10px] tracking-wide text-[#94A3B8]/70 font-light truncate text-right">
                                                            {unit.price ? formatCentsToCurrency(Number(unit.price)) : 'Contact'}
                                                        </span>
                                                        <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                                                        {(isSelected || isHovered) && (
                                                            <motion.div
                                                                layoutId="glow"
                                                                className="absolute inset-0 rounded-lg pointer-events-none"
                                                                style={{ boxShadow: '0 0 14px rgba(198,166,100,0.08)' }}
                                                            />
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                            {isAdmin && (
                                <div className="space-y-2 pt-3 mt-1 border-t border-white/5">
                                    <h4 className="text-[10px] tracking-[0.3em] uppercase text-[#C6A664] font-medium">Add unit</h4>
                                    <button
                                        type="button"
                                        onClick={() => setAddUnitsModalOpen(true)}
                                        className="w-full py-2.5 rounded-xl border border-[#C6A664]/40 text-[#C6A664] text-[10px] tracking-[0.2em] uppercase font-medium flex items-center justify-center gap-2 hover:bg-[#C6A664]/10 transition-colors"
                                    >
                                        <Plus size={12} />
                                        Add Units
                                    </button>
                                    <AddUnitsModal
                                        open={addUnitsModalOpen}
                                        onClose={() => setAddUnitsModalOpen(false)}
                                        onComplete={onCreateUnitComplete}
                                        onSuccess={(r) => r.hadInterior && onUnitCreatedWithInterior?.(r.unitId)}
                                        onOpenSectionPlan={() => { onOpenBuildingPlan?.(); setAddUnitsModalOpen(false); }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}
