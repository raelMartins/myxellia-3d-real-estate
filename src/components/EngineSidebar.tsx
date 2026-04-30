'use client';

import { useState, useEffect, useMemo, useCallback, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Plus, PanelRight, PanelRightClose } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import SetDefaultWorldEnvironmentButton from '@/components/SetDefaultWorldEnvironmentButton';
import EngineSidebarSelectedUnit from './EngineSidebarSelectedUnit';
import AddUnitsModal from './AddUnitsModal';
import type { UnitIdentityValues } from './UnitIdentityForm';
import type { GeometryData } from './UnitGeometryStep';
import { useEngineStore } from '@/engine/store/engine.store';
import { useAuthStore } from '@/store/auth.store';
import { isUnitAllocatedToOtherClient } from '@/engine/lib/unitClientAccess';
import { pickEffectiveWorldEnvironment } from '@/lib/pickEffectiveWorldEnvironment';
import { studioExteriorFrontSelectOptions, type StudioExteriorFront } from '@/lib/groundPlacementPad';
import { formatCentsToCurrency } from '@/lib/currency';
import type { Database } from '@/lib/database.types';
import {
    unitPassesStudioFilters,
    type StudioFilterBounds,
    type StudioFilterState,
} from '@/components/EngineNoMeshFilterControls';

type UnitRow = Database['public']['Tables']['units']['Row'];

/** Beige Inter table (no world mesh / studio exterior). */
const SIDEBAR_WIDTH_STUDIO = 473;
/** Dark glass floor list (world mesh active). */
const SIDEBAR_WIDTH_CLASSIC = 320;
const SIDEBAR_COLLAPSED_SIZE = 48;
const INSET = 16;
/** When expanded, match `EngineTopSceneBar` vertical offset (`top-8` = 2rem). */
const SIDEBAR_TOP_EXPANDED = 32;
const UNITS_PANEL_MAX_H = 706.67;
const UNITS_PANEL_PAD = 6.67;

const TEXT = '#715852';
const TEXT_MUTED = '#AE928A';

const STATUS_DOT: Record<string, string> = {
    available: 'status-available',
    pending: 'status-pending',
    sold: 'status-sold',
};

function formatAreaSqm(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatNairaFromCents(cents: number): string {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(cents / 100);
}

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
    viewMode: 'exterior' | 'interior';
    /** No-mesh exterior: filter state from parent; filters unit table on the right. */
    studioTableFilters?: {
        bounds: StudioFilterBounds;
        state: StudioFilterState;
    } | null;
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
    viewMode,
    studioTableFilters = null,
}: EngineSidebarProps) {
    const {
        building,
        selectedUnit,
        hoveredUnit,
        unitStatuses,
        unitAllocationNames,
        unitAllocationUserIds,
        setSelectedUnit,
        setHoveredUnit,
        setStudioSidebarHoveredUnitId,
        setNotification,
        selectedWorldEnvironmentId,
        buildingWorldEnvironment,
        worldEnvironments,
        setSelectedWorldEnvironmentId,
        setSelectedSkyboxUrl,
        setSelectedSkyboxSlotId,
        setSelectedCatalogCollectionId,
        setStudioExteriorFront,
        studioExteriorFront,
        modelBoundsXZ,
        fetchBuilding,
    } = useEngineStore();

    const effectiveWorld = useMemo(
        () =>
            pickEffectiveWorldEnvironment(
                selectedWorldEnvironmentId,
                buildingWorldEnvironment,
                worldEnvironments
            ),
        [selectedWorldEnvironmentId, buildingWorldEnvironment, worldEnvironments]
    );
    /** Same rule as `MyxelliaCanvas` (`effectiveWorld == null` → studio / no ground mesh). */
    const noWorldMesh = effectiveWorld == null;
    const showWorldEnvControls = worldEnvironments.length > 0 || !!buildingWorldEnvironment;
    const showStudioExteriorFrontUi =
        !worldPreviewMode && effectiveWorld == null && !!building?.id && viewMode === 'exterior';

    const studioFrontOptions = useMemo(
        () => studioExteriorFrontSelectOptions(modelBoundsXZ),
        [modelBoundsXZ],
    );

    const handleWorldEnvironmentChange = useCallback(
        (v: string) => {
            setSelectedSkyboxSlotId(null);
            setSelectedCatalogCollectionId(null);
            if (v === '') {
                setSelectedWorldEnvironmentId(null);
                setSelectedSkyboxUrl(null);
            } else if (v === '__none__') {
                setSelectedWorldEnvironmentId('__none__');
                setSelectedSkyboxUrl(null);
            } else {
                setSelectedWorldEnvironmentId(v);
                setSelectedSkyboxUrl(null);
            }
        },
        [
            setSelectedWorldEnvironmentId,
            setSelectedSkyboxUrl,
            setSelectedSkyboxSlotId,
            setSelectedCatalogCollectionId,
        ],
    );

    const handleWorldDefaultSaved = useCallback(() => {
        if (building?.id) void fetchBuilding(building.id);
        setNotification('Default world environment updated.');
    }, [building?.id, fetchBuilding, setNotification]);

    const exteriorShell = noWorldMesh
        ? 'rounded-lg border border-[rgba(113,88,82,0.28)] bg-[#E4DCD5]/88 backdrop-blur-md px-2 py-1.5'
        : 'glass-heavy rounded-lg border border-white/10 px-2 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]';

    const renderExteriorPickers = () => {
        if (viewMode !== 'exterior' || worldPreviewMode) return null;
        return (
            <>
                {showStudioExteriorFrontUi && (
                    <div
                        className={`${exteriorShell} min-w-[10rem] max-w-[16rem] w-[14rem]`}
                        title="Which footprint side faces the viewer first when there is no ground mesh. Admins only can change this setting."
                    >
                        <CustomSelect
                            variant="compact"
                            frame="inline"
                            fullWidth={false}
                            listTone={noWorldMesh ? 'studio' : 'dark'}
                            className="min-w-0 w-full max-w-full"
                            aria-label="Studio exterior front"
                            value={studioExteriorFront}
                            onChange={(v) => setStudioExteriorFront(v as StudioExteriorFront)}
                            disabled={!isAdmin}
                            options={studioFrontOptions}
                        />
                    </div>
                )}
                {showWorldEnvControls && (
                    <div
                        className={`${exteriorShell} flex min-w-[12rem] w-[min(19rem,100%)] max-w-[19rem] flex-wrap items-center gap-1`}
                    >
                        <CustomSelect
                            variant="compact"
                            frame="inline"
                            fullWidth={false}
                            listTone={noWorldMesh ? 'studio' : 'dark'}
                            className="min-w-[10.5rem] flex-1"
                            aria-label="World mesh"
                            value={
                                selectedWorldEnvironmentId === '__none__'
                                    ? '__none__'
                                    : (selectedWorldEnvironmentId ?? '')
                            }
                            onChange={handleWorldEnvironmentChange}
                            options={[
                                { value: '', label: 'Project default' },
                                { value: '__none__', label: 'No world mesh' },
                                ...worldEnvironments.map((w) => ({ value: w.id, label: w.label })),
                            ]}
                        />
                        {isAdmin && building?.id && (
                            <SetDefaultWorldEnvironmentButton
                                buildingId={building.id}
                                worldEnvironmentId={
                                    selectedWorldEnvironmentId === '__none__'
                                        ? null
                                        : (selectedWorldEnvironmentId ?? buildingWorldEnvironment?.id ?? null)
                                }
                                onSaved={handleWorldDefaultSaved}
                            />
                        )}
                    </div>
                )}
            </>
        );
    };

    const currentUserId = useAuthStore((s) => s.user?.id);
    const [addUnitsModalOpen, setAddUnitsModalOpen] = useState(false);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [expandedHeight, setExpandedHeight] = useState(
        typeof window !== 'undefined' ? window.innerHeight - SIDEBAR_TOP_EXPANDED - INSET : 500
    );
    const [snSortDesc, setSnSortDesc] = useState(true);

    const flatUnits = useMemo(() => {
        const list = floors.flatMap((f) => f.units);
        return list.sort((a, b) => {
            const floorA = a.floor ?? 1;
            const floorB = b.floor ?? 1;
            if (floorB !== floorA) return floorB - floorA;
            const cmp = a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true, sensitivity: 'base' });
            return snSortDesc ? -cmp : cmp;
        });
    }, [floors, snSortDesc]);

    const filteredFlatUnits = useMemo(() => {
        if (!noWorldMesh || !studioTableFilters) return flatUnits;
        const { state, bounds } = studioTableFilters;
        return flatUnits.filter((unit) => {
            const status = unitStatuses[unit.id] ?? unit.status ?? 'available';
            const allocatedToOther = isUnitAllocatedToOtherClient({
                unitId: unit.id,
                currentUserId,
                isAdmin,
                unitAllocationUserIds,
            });
            return unitPassesStudioFilters(unit, state, bounds, {
                status,
                allocatedToOther,
            });
        });
    }, [
        noWorldMesh,
        studioTableFilters,
        flatUnits,
        unitStatuses,
        currentUserId,
        isAdmin,
        unitAllocationUserIds,
    ]);

    useEffect(() => {
        if (selectedUnit) setCollapsed(false);
    }, [selectedUnit]);

    useEffect(() => {
        if (collapsed) setStudioSidebarHoveredUnitId(null);
    }, [collapsed, setStudioSidebarHoveredUnitId]);

    useEffect(() => {
        const top = collapsed ? INSET : SIDEBAR_TOP_EXPANDED;
        const onResize = () => setExpandedHeight(window.innerHeight - top - INSET);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [collapsed]);

    const unitsPanelStyle: CSSProperties = {
        background: '#E4DCD5CC',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 8,
        color: TEXT,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 500,
        fontSize: 12,
        lineHeight: '150%',
        letterSpacing: '0',
        paddingRight: UNITS_PANEL_PAD,
        paddingBottom: UNITS_PANEL_PAD,
        maxHeight: UNITS_PANEL_MAX_H,
    };

    return (
        <motion.div
            className="absolute z-20 overflow-hidden flex flex-col"
            style={{ right: INSET, top: collapsed ? INSET : SIDEBAR_TOP_EXPANDED }}
            initial={{ x: 60, opacity: 0 }}
            animate={{
                x: 0,
                opacity: 1,
                width: collapsed ? SIDEBAR_COLLAPSED_SIZE : noWorldMesh ? SIDEBAR_WIDTH_STUDIO : SIDEBAR_WIDTH_CLASSIC,
                height: collapsed ? SIDEBAR_COLLAPSED_SIZE : expandedHeight,
                borderRadius: collapsed ? SIDEBAR_COLLAPSED_SIZE / 2 : 12,
            }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
            {collapsed ? (
                <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="w-full h-full flex items-center justify-center rounded-full glass-heavy text-[#94A3B8] hover:text-[#C6A664] transition-colors"
                    aria-label="Open sidebar"
                >
                    <PanelRight size={22} strokeWidth={1.5} />
                </button>
            ) : worldPreviewMode ? (
                <>
                    <div className="shrink-0 p-6 pb-4 flex flex-col gap-4 glass-heavy flex-1">
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCollapsed(true)}
                                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors"
                                aria-label="Collapse sidebar"
                            >
                                <PanelRightClose size={18} strokeWidth={1.5} />
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
                    <div
                        className={
                            noWorldMesh
                                ? 'shrink-0 px-2 pt-1 pb-2 flex items-center justify-between gap-2 min-w-0'
                                : 'shrink-0 p-4 pb-2 flex items-center justify-between gap-2 glass-heavy min-w-0'
                        }
                    >
                        {!singleUnitMode ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedUnit(null);
                                    setUnitFormError(null);
                                }}
                                className={
                                    noWorldMesh
                                        ? 'text-[10px] tracking-[0.25em] uppercase transition-opacity hover:opacity-80 shrink-0'
                                        : 'text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase hover:text-[#C6A664] transition-colors shrink-0'
                                }
                                style={noWorldMesh ? { color: TEXT } : undefined}
                            >
                                All units
                            </button>
                        ) : (
                            <span className="flex-1 min-w-0" aria-hidden />
                        )}
                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 shrink-0">
                            {renderExteriorPickers()}
                            <button
                                type="button"
                                onClick={() => setCollapsed(true)}
                                className={
                                    noWorldMesh
                                        ? 'p-1.5 rounded-lg transition-colors hover:bg-[rgba(113,88,82,0.12)] shrink-0'
                                        : 'p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors shrink-0'
                                }
                                style={noWorldMesh ? { color: TEXT } : undefined}
                                aria-label="Collapse sidebar"
                            >
                                <PanelRightClose size={18} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>
                    <div
                        className={
                            noWorldMesh
                                ? 'flex-1 min-h-0 overflow-y-auto engine-units-scroll min-w-0 px-1 pb-1'
                                : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar min-w-0 glass-heavy'
                        }
                    >
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
                            studioListingStyle={noWorldMesh}
                        />
                    </div>
                </>
            ) : noWorldMesh ? (
                <>
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                        <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-1 pb-2 border-b border-[rgba(113,88,82,0.15)]">
                            {renderExteriorPickers()}
                            <button
                                type="button"
                                onClick={() => setCollapsed(true)}
                                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/10 transition-colors shrink-0"
                                aria-label="Collapse sidebar"
                            >
                                <PanelRightClose size={18} strokeWidth={1.5} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={unitsPanelStyle}>
                            <div className="flex-1 min-h-0 overflow-auto engine-units-scroll pl-2 pt-2">
                                <table className="w-full border-collapse text-left">
                                    <thead className="sticky top-0 z-[1]">
                                        <tr
                                            className="border-b border-[rgba(113,88,82,0.2)]"
                                            style={{ background: '#E4DCD5EE', boxShadow: '0 1px 0 rgba(113,88,82,0.12)' }}
                                        >
                                            <th scope="col" className="py-2 pr-1 font-medium w-[22%]">
                                                <button
                                                    type="button"
                                                    onClick={() => setSnSortDesc((d) => !d)}
                                                    className="inline-flex items-center gap-0.5 uppercase tracking-normal text-[11px] hover:opacity-80"
                                                    style={{ color: TEXT }}
                                                >
                                                    SN
                                                    {snSortDesc ? (
                                                        <ChevronDown size={12} strokeWidth={2} className="opacity-70" aria-hidden />
                                                    ) : (
                                                        <ChevronUp size={12} strokeWidth={2} className="opacity-70" aria-hidden />
                                                    )}
                                                </button>
                                            </th>
                                            <th scope="col" className="py-2 px-0.5 font-medium w-[12%] uppercase text-[11px]" style={{ color: TEXT }}>
                                                FLR
                                            </th>
                                            <th scope="col" className="py-2 px-0.5 font-medium w-[14%] uppercase text-[11px]" style={{ color: TEXT }}>
                                                ROOMS
                                            </th>
                                            <th scope="col" className="py-2 px-0.5 font-medium w-[18%] uppercase text-[11px]" style={{ color: TEXT }}>
                                                SIZE
                                            </th>
                                            <th
                                                scope="col"
                                                className="py-2 pl-1 font-medium text-right uppercase text-[11px] w-[34%]"
                                                style={{ color: TEXT }}
                                            >
                                                PRICE
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFlatUnits.map((unit) => {
                                            const status = unitStatuses[unit.id] ?? unit.status ?? 'available';
                                            const isSelected = selectedUnit === unit.id;
                                            const isHovered = hoveredUnit === unit.id;
                                            const allocatedToOther = isUnitAllocatedToOtherClient({
                                                unitId: unit.id,
                                                currentUserId,
                                                isAdmin,
                                                unitAllocationUserIds,
                                            });
                                            const allocName = unitAllocationNames[unit.id]?.trim();
                                            const unavailable = allocatedToOther || status === 'sold';
                                            const rowColor = unavailable ? TEXT_MUTED : TEXT;
                                            const priceCents = unit.price != null ? Number(unit.price) : null;

                                            let priceCell: ReactNode;
                                            if (unavailable) {
                                                priceCell = 'Unavailable';
                                            } else if (priceCents == null || !Number.isFinite(priceCents) || priceCents <= 0) {
                                                priceCell = <span className="underline-offset-2">Request price</span>;
                                            } else {
                                                priceCell = formatNairaFromCents(priceCents);
                                            }

                                            const onRowActivate = () => {
                                                if (allocatedToOther) {
                                                    setNotification(
                                                        allocName
                                                            ? `This unit is allocated to ${allocName}.`
                                                            : 'This unit is already allocated to another client.'
                                                    );
                                                    return;
                                                }
                                                setSelectedUnit(unit.id);
                                            };

                                            return (
                                                <tr
                                                    key={unit.id}
                                                    tabIndex={0}
                                                    onClick={onRowActivate}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            onRowActivate();
                                                        }
                                                    }}
                                                    onMouseEnter={() => {
                                                        setHoveredUnit(unit.id);
                                                        setStudioSidebarHoveredUnitId(unit.id);
                                                    }}
                                                    onMouseLeave={() => {
                                                        setHoveredUnit(null);
                                                        setStudioSidebarHoveredUnitId(null);
                                                    }}
                                                    className={[
                                                        'border-b border-[rgba(113,88,82,0.15)] transition-colors cursor-pointer',
                                                        isSelected ? 'bg-[rgba(113,88,82,0.1)]' : '',
                                                        isHovered && !allocatedToOther ? 'bg-[rgba(113,88,82,0.05)]' : '',
                                                        allocatedToOther ? 'cursor-not-allowed' : '',
                                                    ].join(' ')}
                                                    style={{ color: rowColor }}
                                                >
                                                    <td className="py-2 pr-1 align-middle font-medium">{unit.unit_number}</td>
                                                    <td className="py-2 px-0.5 align-middle tabular-nums">{unit.floor ?? '—'}</td>
                                                    <td className="py-2 px-0.5 align-middle tabular-nums">
                                                        {unit.bedrooms != null ? unit.bedrooms : '—'}
                                                    </td>
                                                    <td className="py-2 px-0.5 align-middle tabular-nums">{formatAreaSqm(unit.area_sqm)}</td>
                                                    <td className="py-2 pl-1 align-middle text-right font-medium whitespace-nowrap">
                                                        {priceCell}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {isAdmin && (
                                <div
                                    className="shrink-0 border-t border-[rgba(113,88,82,0.2)] pt-2 mt-1 px-2 pb-1"
                                    style={{ color: TEXT }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setAddUnitsModalOpen(true)}
                                        className="w-full py-2 rounded-lg border border-[rgba(113,88,82,0.35)] text-[11px] tracking-wide uppercase font-medium flex items-center justify-center gap-2 hover:bg-[rgba(113,88,82,0.08)] transition-colors"
                                        style={{ color: TEXT }}
                                    >
                                        <Plus size={12} strokeWidth={2} />
                                        Add units
                                    </button>
                                    <AddUnitsModal
                                        open={addUnitsModalOpen}
                                        onClose={() => setAddUnitsModalOpen(false)}
                                        onComplete={onCreateUnitComplete}
                                        onSuccess={(r) => r.hadInterior && onUnitCreatedWithInterior?.(r.unitId)}
                                        onOpenSectionPlan={() => {
                                            onOpenBuildingPlan?.();
                                            setAddUnitsModalOpen(false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <p className="shrink-0 mt-1.5 px-0.5 text-center text-[10px] text-[#94A3B8]/90 truncate" title={building?.name ?? ''}>
                            {building?.name || 'Project'}
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex-1 flex flex-col min-h-0 glass-heavy">
                        <div className="p-5 pb-3">
                            <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                                {renderExteriorPickers()}
                                <button
                                    type="button"
                                    onClick={() => setCollapsed(true)}
                                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#C6A664] hover:bg-white/5 transition-colors shrink-0"
                                    aria-label="Collapse sidebar"
                                >
                                    <PanelRightClose size={18} strokeWidth={1.5} />
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
                                                const allocatedToOther = isUnitAllocatedToOtherClient({
                                                    unitId: unit.id,
                                                    currentUserId,
                                                    isAdmin,
                                                    unitAllocationUserIds,
                                                });
                                                const allocName = unitAllocationNames[unit.id]?.trim();
                                                return (
                                                    <li key={unit.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (allocatedToOther) {
                                                                    setNotification(
                                                                        allocName
                                                                            ? `This unit is allocated to ${allocName}.`
                                                                            : 'This unit is already allocated to another client.'
                                                                    );
                                                                    return;
                                                                }
                                                                setSelectedUnit(unit.id);
                                                            }}
                                                            onMouseEnter={() => setHoveredUnit(unit.id)}
                                                            onMouseLeave={() => setHoveredUnit(null)}
                                                            className={`
                                                            relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-200
                                                            ${isSelected ? 'glass-heavy border border-[#C6A664]/35 bg-white/5 ring-1 ring-[#C6A664]/15' : 'border border-transparent hover:bg-white/[0.04]'}
                                                            ${allocatedToOther ? 'opacity-55 cursor-not-allowed' : ''}
                                                        `}
                                                        >
                                                            <span
                                                                className={`shrink-0 flex flex-col items-start min-w-0 ${isSelected ? 'text-[#F5F7FA]' : 'text-[#94A3B8]'}`}
                                                            >
                                                                <span className="text-[11px] font-medium tabular-nums">{unit.unit_number}</span>
                                                                {allocatedToOther && (
                                                                    <span className="text-[9px] text-red-300/90 font-normal tracking-wide normal-case truncate max-w-[11rem]">
                                                                        Allocated{allocName ? ` · ${allocName}` : ''}
                                                                    </span>
                                                                )}
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
                                            onOpenSectionPlan={() => {
                                                onOpenBuildingPlan?.();
                                                setAddUnitsModalOpen(false);
                                            }}
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
