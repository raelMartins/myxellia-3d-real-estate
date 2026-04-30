'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing } from 'lucide-react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import MyxelliaCanvas from '@/engine/components/MyxelliaCanvas';
import PadMarqueeOverlay from '@/engine/components/PadMarqueeOverlay';
import EngineSidebar from '@/components/EngineSidebar';
import EngineNoMeshLeftFilterPanel from '@/components/EngineNoMeshLeftFilterPanel';
import {
    computeStudioFilterBounds,
    defaultStudioFilterState,
    type StudioFilterState,
} from '@/components/EngineNoMeshFilterControls';
import EngineInteriorView from '@/engine/components/EngineInteriorView';
import InteriorUploadModal from '@/components/InteriorUploadModal';
import type { UnitIdentityValues } from '@/components/UnitIdentityForm';
import type { GeometryData } from '@/components/UnitGeometryStep';
import type { UnitCreateResult } from '@/components/AddUnitsModal';
import BuildingPlanModal from '@/components/BuildingPlanModal';
import type { BuildingPlanApplyPayload } from '@/components/BuildingPlanModal';
import { slotToUnitGeometry, slotYExtent } from '@/lib/sectionPlanUnits';
import EngineTopBanner from '@/engine/components/EngineTopBanner';
import EngineTopSceneBar from '@/engine/components/EngineTopSceneBar';
import EngineViewControls from '@/engine/components/EngineViewControls';
import EngineRightPanel from '@/components/EngineRightPanel';
import { useEngineStore } from '@/engine/store/engine.store';
import { useAuthStore } from '@/store/auth.store';
import { createReservation } from '@/lib/reservations';
import { isUnitAllocatedToOtherClient } from '@/engine/lib/unitClientAccess';
import {
    fetchSkyboxCollections,
    createCollectionWithHdrFiles,
} from '@/lib/skyboxCollections';
import { orderedSlots, resolveExteriorHdriUrl } from '@/lib/skyboxEnvResolve';
import {
    fetchWorldEnvironments,
    fetchWorldEnvironmentById,
    patchWorldEnvironmentSkyCollection,
    patchWorldEnvironmentSurroundSelection,
    isSurroundLayoutMode,
    type SurroundLayoutMode,
    type WorldEnvironmentWithSky,
} from '@/lib/worldEnvironments';
import { fetchSurroundCatalogAssets } from '@/lib/surroundCatalog';
import type { SurroundCatalogAssetRow } from '@/lib/database.types';
import { pickEffectiveWorldEnvironment } from '@/lib/pickEffectiveWorldEnvironment';
import type { Database } from '@/lib/database.types';
import type { InteriorHotspot } from '@/lib/database.types';

type UnitRow = Database['public']['Tables']['units']['Row'];
const ease = [0.2, 0.8, 0.2, 1] as const;

function worldHasBundledSky(w: WorldEnvironmentWithSky | null | undefined): boolean {
    if (!w) return false;
    const slots = w.skybox_collections?.skybox_collection_slots;
    if (w.skybox_collection_id && Array.isArray(slots) && slots.length > 0) return true;
    if (w.skybox_environment_id && w.skybox_environments?.file_url?.trim()) return true;
    return false;
}

function EngineErrorFallback({ resetErrorBoundary }: FallbackProps) {
    const router = useRouter();
    const params = useParams();
    const buildingId = (params?.buildingId as string | undefined) ?? undefined;
    const worldId = (params?.worldId as string | undefined) ?? undefined;
    const backHref = worldId ? '/world-environments' : buildingId ? `/detail/${buildingId}` : '/';
    const backLabel = worldId ? 'World environments' : buildingId ? 'Back to Summary' : 'Marketplace';
    return (
        <div className="w-screen h-screen bg-[#0A0A0B] flex flex-col items-center justify-center gap-6 p-8">
            <p className="text-red-400/90 text-sm text-center max-w-md">Something went wrong loading the engine.</p>
            <div className="flex gap-4">
                <button onClick={resetErrorBoundary} className="px-4 py-2 rounded-lg bg-white/10 text-[#F5F7FA] text-xs uppercase tracking-wider">Try again</button>
                <button onClick={() => router.push(backHref)} className="px-4 py-2 rounded-lg bg-[#C6A664]/20 text-[#C6A664] text-xs uppercase tracking-wider">{backLabel}</button>
            </div>
        </div>
    );
}

export default function Engine() {
    const params = useParams();
    const buildingId = (params?.buildingId as string | undefined) ?? undefined;
    const worldPreviewId = (params?.worldId as string | undefined) ?? undefined;
    const searchParams = useSearchParams();
    const focusUnitIdFromUrl = searchParams?.get('unitId') ?? null;

    const {
        building, units, loading,
        selectedUnit, viewMode, lightingMode, unitStatuses, unitAllocationUserIds, notification,
        skyboxCollections, selectedSkyboxUrl, selectedCatalogCollectionId, selectedSkyboxSlotId,
        modelBoundsXZ, focusUnitId,
        worldEnvironments, buildingWorldEnvironment, selectedWorldEnvironmentId,
        fetchBuilding, fetchUnits, setSelectedUnit, setViewMode, setLightingMode,
        setUnitStatus, setNotification, setUnitPositionHandler, setUnitSizeHandler, setUnitRotationHandler,
        setSkyboxCollections, setSelectedSkyboxUrl, setSelectedCatalogCollectionId, setSelectedSkyboxSlotId,
        setWorldEnvironments, setSelectedWorldEnvironmentId, setFocusUnitId,
        setBuildingWorldEnvironment,
        resetEngine,
        placementPad, placementPadDirty, placementPadEditActive,
        togglePlacementPadEdit,
        setPadDisplayMode,
        setPlacementPadBuildingYaw,
        setPlacementPadBuildingVerticalOffsetM,
        saveGroundPlacementPad,
        clearGroundPlacementPad,
        worldPreviewActive, loadWorldPreview,
    } = useEngineStore();

    const [unitFormError, setUnitFormError] = useState<string | null>(null);
    const [interiorModalOpen, setInteriorModalOpen] = useState(false);
    const [interiorAddedPopup, setInteriorAddedPopup] = useState<{ unitId: string } | null>(null);
    const [buildingPlanModalOpen, setBuildingPlanModalOpen] = useState(false);
    const [padSaving, setPadSaving] = useState(false);
    const [worldPreviewSkyboxUploading, setWorldPreviewSkyboxUploading] = useState(false);
    const [surroundCatalogAssets, setSurroundCatalogAssets] = useState<SurroundCatalogAssetRow[]>([]);
    const [surroundSaving, setSurroundSaving] = useState(false);

    const { profile, user } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    const handleEngineHistoryBack = useCallback(() => {
        if (typeof window === 'undefined') return;
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        if (worldPreviewActive) {
            window.location.assign('/world-environments');
        } else if (buildingId) {
            window.location.assign(`/detail/${buildingId}`);
        } else {
            window.location.assign('/');
        }
    }, [worldPreviewActive, buildingId]);

    useEffect(() => {
        if (worldPreviewId) {
            setFocusUnitId(null);
            void loadWorldPreview(worldPreviewId);
            return () => {
                resetEngine();
            };
        }
        if (buildingId) {
            setFocusUnitId(focusUnitIdFromUrl);
            fetchBuilding(buildingId);
            fetchUnits(buildingId);
        }
        return () => {
            resetEngine();
        };
    }, [worldPreviewId, buildingId, focusUnitIdFromUrl, fetchBuilding, fetchUnits, resetEngine, setFocusUnitId, loadWorldPreview]);

    useEffect(() => {
        if (!focusUnitIdFromUrl || units.length === 0) return;
        const exists = units.some((u: UnitRow) => u.id === focusUnitIdFromUrl);
        if (!exists) return;
        if (
            isUnitAllocatedToOtherClient({
                unitId: focusUnitIdFromUrl,
                currentUserId: user?.id,
                isAdmin,
                unitAllocationUserIds,
            })
        ) {
            return;
        }
        setSelectedUnit(focusUnitIdFromUrl);
    }, [focusUnitIdFromUrl, units, unitAllocationUserIds, user?.id, isAdmin, setSelectedUnit]);
    useEffect(() => {
        const token = () => useAuthStore.getState().session?.access_token ?? undefined;
        fetchSkyboxCollections(token).then(setSkyboxCollections);
    }, [setSkyboxCollections]);
    useEffect(() => {
        const token = () => useAuthStore.getState().session?.access_token ?? undefined;
        fetchWorldEnvironments(token).then(setWorldEnvironments);
    }, [setWorldEnvironments]);
    useEffect(() => {
        const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;
        void fetchSurroundCatalogAssets(getToken).then(setSurroundCatalogAssets);
    }, []);

    useEffect(() => {
        if (!building?.id || worldPreviewActive) return;
        setSelectedWorldEnvironmentId(null);
    }, [building?.id, worldPreviewActive, setSelectedWorldEnvironmentId]);

    useEffect(() => {
        if (worldPreviewActive) return;
        if (!building?.id) return;
        setSelectedSkyboxSlotId(null);
        setSelectedCatalogCollectionId(null);
        setSelectedSkyboxUrl(null);
    }, [
        building?.id,
        buildingWorldEnvironment?.id,
        worldPreviewActive,
        setSelectedSkyboxSlotId,
        setSelectedCatalogCollectionId,
        setSelectedSkyboxUrl,
    ]);
    useEffect(() => {
        if (!notification) return;
        const t = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(t);
    }, [notification, setNotification]);

    useEffect(() => {
        if (worldPreviewActive && viewMode !== 'exterior') setViewMode('exterior');
    }, [worldPreviewActive, viewMode, setViewMode]);
    const floors = useMemo(() => {
        const groups: Record<string, UnitRow[]> = {};
        units.forEach((u: UnitRow) => {
            const f = u.floor ?? 1;
            if (!groups[f]) groups[f] = [];
            groups[f].push(u);
        });
        return Object.entries(groups).map(([name, floorUnits]) => ({
            id: `f-${name}`,
            name: `Floor ${name}`,
            units: floorUnits
        })).sort((a, b) => b.name.localeCompare(a.name));
    }, [units]);

    const boundsSourceUnits = useMemo(() => floors.flatMap((f) => f.units), [floors]);
    const studioFilterBounds = useMemo(() => computeStudioFilterBounds(boundsSourceUnits), [boundsSourceUnits]);
    const studioBoundsSig = `${studioFilterBounds.floorMin}|${studioFilterBounds.floorMax}|${studioFilterBounds.areaMin}|${studioFilterBounds.areaMax}|${studioFilterBounds.priceMinCents}|${studioFilterBounds.priceMaxCents}|${boundsSourceUnits.length}`;

    const effectiveWorldForUi = useMemo(
        () =>
            pickEffectiveWorldEnvironment(selectedWorldEnvironmentId, buildingWorldEnvironment, worldEnvironments),
        [buildingWorldEnvironment, selectedWorldEnvironmentId, worldEnvironments]
    );

    const studioFilterGeomActive =
        !!building && !worldPreviewActive && effectiveWorldForUi == null && viewMode === 'exterior';

    const [studioFilters, setStudioFilters] = useState<StudioFilterState>(() =>
        defaultStudioFilterState(computeStudioFilterBounds([]))
    );

    useEffect(() => {
        setStudioFilters(defaultStudioFilterState(studioFilterBounds));
    }, [studioBoundsSig, studioFilterBounds]);

    const patchStudioFilters = useCallback((patch: Partial<StudioFilterState>) => {
        setStudioFilters((prev) => ({ ...prev, ...patch }));
    }, []);

    const showNoMeshLeftFilter =
        studioFilterGeomActive && !selectedUnit && !focusUnitId;

    const noMeshStudioTableFilters = useMemo(() => {
        if (!studioFilterGeomActive) return undefined;
        return { state: studioFilters, bounds: studioFilterBounds };
    }, [studioFilterGeomActive, studioFilters, studioFilterBounds]);

    const hideSkyboxCatalog =
        !worldPreviewActive &&
        (worldHasBundledSky(effectiveWorldForUi) || !effectiveWorldForUi);

    const exteriorHdriResolve = useMemo(
        () =>
            resolveExteriorHdriUrl({
                skyNone: selectedSkyboxUrl === '__none__',
                effectiveWorld: effectiveWorldForUi,
                selectedSkyboxSlotId,
                catalogCollectionId: selectedCatalogCollectionId,
                skyboxCollections,
                buildingGeneratedEnvUrl: building?.generated_env_url,
            }),
        [
            selectedSkyboxUrl,
            effectiveWorldForUi,
            selectedSkyboxSlotId,
            selectedCatalogCollectionId,
            skyboxCollections,
            building?.generated_env_url,
        ]
    );

    const skySlotPicker = useMemo(() => {
        if (!worldPreviewActive && !effectiveWorldForUi) {
            return { slots: [] as ReturnType<typeof orderedSlots>, showPicker: false as const };
        }
        const w = effectiveWorldForUi;
        const fromWorld = w?.skybox_collections?.skybox_collection_slots;
        if (w?.skybox_collection_id && Array.isArray(fromWorld) && fromWorld.length > 0) {
            return { slots: orderedSlots(fromWorld), showPicker: true as const };
        }
        if (selectedCatalogCollectionId) {
            const c = skyboxCollections.find((x) => x.id === selectedCatalogCollectionId);
            const s = c?.skybox_collection_slots;
            if (Array.isArray(s) && s.length > 0) {
                return { slots: orderedSlots(s), showPicker: true as const };
            }
        }
        return { slots: [] as ReturnType<typeof orderedSlots>, showPicker: false as const };
    }, [effectiveWorldForUi, worldPreviewActive, selectedCatalogCollectionId, skyboxCollections]);
    const showWorldEnvControls = worldEnvironments.length > 0 || !!buildingWorldEnvironment;

    const groundUrl = effectiveWorldForUi?.ground_model_url?.trim() ?? '';
    const hasGroundMesh = !!groundUrl;
    const showSurroundFill =
        hasGroundMesh &&
        !!effectiveWorldForUi?.id &&
        (worldPreviewActive || showWorldEnvControls);

    const buildingOrientationDeg = useMemo(
        () => Math.round(((placementPad?.buildingYaw ?? 0) * 180) / Math.PI),
        [placementPad?.buildingYaw]
    );
    const handleBuildingOrientationDeg = useCallback(
        (deg: number) => {
            setPlacementPadBuildingYaw((deg * Math.PI) / 180);
        },
        [setPlacementPadBuildingYaw]
    );

    const mergeRefreshedWorld = useCallback((refreshed: WorldEnvironmentWithSky) => {
        setBuildingWorldEnvironment(refreshed);
        const prev = useEngineStore.getState().worldEnvironments;
        const idx = prev.findIndex((w) => w.id === refreshed.id);
        const next = idx === -1 ? [refreshed, ...prev] : prev.map((w, i) => (i === idx ? refreshed : w));
        setWorldEnvironments(next);
    }, [setBuildingWorldEnvironment, setWorldEnvironments]);

    const handleSurroundCatalogAssetChange = useCallback(
        async (assetId: string | null) => {
            const ew = pickEffectiveWorldEnvironment(
                useEngineStore.getState().selectedWorldEnvironmentId,
                useEngineStore.getState().buildingWorldEnvironment,
                useEngineStore.getState().worldEnvironments
            );
            const wid = ew?.id;
            if (!wid) return;
            const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;
            if (!getToken()) {
                setNotification('Sign in to update surround fill.');
                return;
            }
            setSurroundSaving(true);
            try {
                if (assetId == null) {
                    const updated = await patchWorldEnvironmentSurroundSelection(
                        wid,
                        { catalogAssetId: null, layoutMode: null },
                        getToken
                    );
                    if (updated) mergeRefreshedWorld(updated);
                    else setNotification('Could not clear surround fill.');
                } else {
                    const layoutRaw = ew.surround_layout_mode;
                    const layoutMode = isSurroundLayoutMode(layoutRaw) ? layoutRaw : null;
                    const updated = await patchWorldEnvironmentSurroundSelection(
                        wid,
                        { catalogAssetId: assetId, layoutMode },
                        getToken
                    );
                    if (updated) mergeRefreshedWorld(updated);
                    else setNotification('Could not update surround prop.');
                }
            } finally {
                setSurroundSaving(false);
            }
        },
        [mergeRefreshedWorld, setNotification]
    );

    const handleSurroundLayoutModeChange = useCallback(
        async (mode: SurroundLayoutMode | null) => {
            const ew = pickEffectiveWorldEnvironment(
                useEngineStore.getState().selectedWorldEnvironmentId,
                useEngineStore.getState().buildingWorldEnvironment,
                useEngineStore.getState().worldEnvironments
            );
            const wid = ew?.id;
            if (!wid) return;
            const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;
            if (!getToken()) {
                setNotification('Sign in to update surround spacing.');
                return;
            }
            setSurroundSaving(true);
            try {
                const updated = await patchWorldEnvironmentSurroundSelection(
                    wid,
                    { catalogAssetId: ew.active_surround_catalog_asset_id ?? null, layoutMode: mode },
                    getToken
                );
                if (updated) mergeRefreshedWorld(updated);
                else setNotification('Could not update surround spacing.');
            } finally {
                setSurroundSaving(false);
            }
        },
        [mergeRefreshedWorld, setNotification]
    );

    const handleSkyboxChange = useCallback(
        async (v: string | null) => {
            setSelectedSkyboxSlotId(null);
            if (!worldPreviewActive || !worldPreviewId) {
                if (v === '__none__') {
                    setSelectedSkyboxUrl('__none__');
                    setSelectedCatalogCollectionId(null);
                } else if (v === '' || v == null) {
                    setSelectedSkyboxUrl(null);
                    setSelectedCatalogCollectionId(null);
                } else {
                    setSelectedSkyboxUrl(null);
                    setSelectedCatalogCollectionId(v);
                }
                return;
            }
            const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;
            if (!getToken()) {
                setNotification('Sign in to change the skybox.');
                return;
            }
            let nextCollectionId: string | null = null;
            if (v === '__none__') nextCollectionId = null;
            else if (v === '' || v == null) nextCollectionId = null;
            else nextCollectionId = v;

            const ok = await patchWorldEnvironmentSkyCollection(worldPreviewId, nextCollectionId, getToken);
            if (!ok) {
                setNotification('Could not update world sky collection.');
                return;
            }
            const refreshed = await fetchWorldEnvironmentById(worldPreviewId, getToken);
            if (!refreshed) {
                setNotification('Sky may be saved; refresh if the scene does not update.');
                return;
            }
            mergeRefreshedWorld(refreshed);
            setSelectedCatalogCollectionId(null);
            if (v === '__none__') setSelectedSkyboxUrl('__none__');
            else setSelectedSkyboxUrl(null);
            setNotification('World sky updated.');
        },
        [
            worldPreviewActive,
            worldPreviewId,
            mergeRefreshedWorld,
            setSelectedSkyboxUrl,
            setSelectedCatalogCollectionId,
            setSelectedSkyboxSlotId,
            setNotification,
        ]
    );

    const handleWorldPreviewSkyboxUpload = useCallback(
        async (file: File) => {
            if (!worldPreviewId) return;
            setWorldPreviewSkyboxUploading(true);
            try {
                const getToken = () => useAuthStore.getState().session?.access_token ?? undefined;
                if (!getToken()) {
                    setNotification('Sign in to upload a skybox.');
                    return;
                }
                const stem = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
                const coll = await createCollectionWithHdrFiles(stem || 'Sky', [{ file, label: stem || 'Sky' }], getToken);
                if (!coll) {
                    setNotification('HDR upload failed.');
                    return;
                }
                setSkyboxCollections([coll, ...useEngineStore.getState().skyboxCollections]);
                const ok = await patchWorldEnvironmentSkyCollection(worldPreviewId, coll.id, getToken);
                if (!ok) {
                    setNotification('Uploaded HDR but could not attach it to this world.');
                    return;
                }
                const refreshed = await fetchWorldEnvironmentById(worldPreviewId, getToken);
                if (refreshed) {
                    mergeRefreshedWorld(refreshed);
                    setSelectedSkyboxUrl(null);
                    setSelectedSkyboxSlotId(null);
                }
                setNotification('Sky uploaded and applied to this world.');
            } finally {
                setWorldPreviewSkyboxUploading(false);
            }
        },
        [worldPreviewId, mergeRefreshedWorld, setSkyboxCollections, setSelectedSkyboxUrl, setSelectedSkyboxSlotId, setNotification]
    );

    const selectedUnitData = units.find((u: UnitRow) => u.id === selectedUnit);
    const currentStatus = selectedUnit ? (unitStatuses[selectedUnit] ?? 'available') : null;

    const handleReserve = async () => {
        if (!selectedUnit || !user?.id) return;
        const token = useAuthStore.getState().session?.access_token;
        const { error } = await createReservation(selectedUnit, user.id, token);
        if (error) {
            setNotification(error);
            return;
        }
        setUnitStatus(selectedUnit, 'pending');
        setNotification(`Allocation requested — Unit ${selectedUnitData?.unit_number}`);
        if (buildingId) void fetchUnits(buildingId);
    };

    const handleUnitSaved = () => {
        if (buildingId) fetchUnits(buildingId);
        setNotification('Unit info saved.');
        setUnitFormError(null);
    };
    const handleInteriorUploaded = () => {
        if (buildingId) fetchUnits(buildingId);
        setNotification('Interior view added.');
        setUnitFormError(null);
    };
    const handleSaveHotspots = async (unitId: string, hotspots: InteriorHotspot[]) => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token || !buildingId) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: { 'apikey': key, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ hotspots }),
        });
        if (!res.ok) return;
        await fetchUnits(buildingId);
        setNotification('Hotspots updated.');
    };

    const handleAddUnit = async (unitNumber: string, floor: number) => {
        if (!buildingId || !building) return;
        const trimmed = unitNumber.trim();
        if (!trimmed) return;
        const existing = units.some((u: UnitRow) => u.unit_number === trimmed);
        if (existing) {
            setUnitFormError(`Unit ${trimmed} already exists.`);
            return;
        }
        const rawPrice = (building as { starting_price?: string }).starting_price;
        const defaultPrice = rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : 120000000;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) {
            setUnitFormError('Missing Supabase config or session. Please sign in.');
            return;
        }
        const res = await fetch(`${url}/rest/v1/units`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
                building_id: buildingId,
                unit_number: trimmed,
                floor,
                price: defaultPrice,
                status: 'available',
                mesh_id: `u-${trimmed}`,
            }),
        });
        if (!res.ok) {
            const errText = await res.text();
            setUnitFormError(errText || 'Failed to add unit');
            return;
        }
        setUnitFormError(null);
        await fetchUnits(buildingId);
        setNotification(`Unit ${trimmed} added.`);
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!buildingId) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) {
            setUnitFormError('Missing Supabase config or session. Please sign in.');
            return;
        }
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ deleted_at: new Date().toISOString() }),
        });
        if (!res.ok) {
            const errText = await res.text();
            setUnitFormError(errText || 'Failed to delete unit');
            return;
        }
        if (selectedUnit === unitId) setSelectedUnit(null);
        setUnitFormError(null);
        await fetchUnits(buildingId);
        setNotification('Unit removed.');
    };

    const handleUpdateUnitPosition = async (unitId: string, position: [number, number, number]) => {
        const { buildingId: bid, units: storeUnits } = useEngineStore.getState();
        if (!bid) return;
        if (storeUnits.some((u: UnitRow) => u.id === unitId && u.section_plan_sourced)) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ position }),
        });
        if (!res.ok) return;
        await useEngineStore.getState().fetchUnits(bid);
        setNotification('Unit position updated.');
    };

    const handleUpdateUnitSize = async (unitId: string, size: [number, number, number]) => {
        const { buildingId: bid, units: storeUnits } = useEngineStore.getState();
        if (!bid) return;
        if (storeUnits.some((u: UnitRow) => u.id === unitId && u.section_plan_sourced)) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ size }),
        });
        if (!res.ok) return;
        await useEngineStore.getState().fetchUnits(bid);
        setNotification('Unit size updated.');
    };

    const handleUpdateUnitRotation = async (unitId: string, rotation: number) => {
        const { buildingId: bid, units: storeUnits } = useEngineStore.getState();
        if (!bid) return;
        if (storeUnits.some((u: UnitRow) => u.id === unitId && u.section_plan_sourced)) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) return;
        const res = await fetch(`${url}/rest/v1/units?id=eq.${unitId}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ rotation }),
        });
        if (!res.ok) return;
        await useEngineStore.getState().fetchUnits(bid);
        setNotification('Unit rotation updated.');
    };

    useEffect(() => {
        if (isAdmin && !worldPreviewActive) {
            setUnitPositionHandler(handleUpdateUnitPosition);
            setUnitSizeHandler(handleUpdateUnitSize);
            setUnitRotationHandler(handleUpdateUnitRotation);
        } else {
            setUnitPositionHandler(null);
            setUnitSizeHandler(null);
            setUnitRotationHandler(null);
        }
        return () => {
            setUnitPositionHandler(null);
            setUnitSizeHandler(null);
            setUnitRotationHandler(null);
        };
    }, [isAdmin, worldPreviewActive, setUnitPositionHandler, setUnitSizeHandler, setUnitRotationHandler]);

    const handleCreateUnitFromModal = async (
        identity: UnitIdentityValues,
        geometry: GeometryData,
        interiorFile: File | null
    ): Promise<UnitCreateResult | null> => {
        if (!buildingId || !building) return null;
        const trimmed = (identity.unit_number ?? '').trim();
        if (!trimmed) return null;
        const existing = units.some((u: UnitRow) => u.unit_number === trimmed);
        if (existing) {
            setUnitFormError(`Unit ${trimmed} already exists.`);
            return null;
        }
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) {
            setUnitFormError('Missing Supabase config or session. Please sign in.');
            return null;
        }
        const rawPrice = (building as { starting_price?: string }).starting_price;
        const defaultPrice = rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : 120000000;
        const floor = identity.floor ?? 1;
        const position: [number, number, number] = [0, floor * 3, 0];
        const size: [number, number, number] = [geometry.width, geometry.height, geometry.depth];
        const payload = {
            building_id: buildingId,
            unit_number: trimmed,
            floor,
            price: identity.price ?? defaultPrice,
            display_name: identity.display_name || null,
            area_sqm: identity.area_sqm ?? null,
            bedrooms: identity.bedrooms ?? null,
            bathrooms: identity.bathrooms ?? null,
            view_type: identity.view_type || null,
            amenities: identity.amenities || null,
            status: 'available',
            mesh_id: `u-${trimmed}`,
            position,
            size,
            section_plan_sourced: false,
            ...(geometry.footprint?.length >= 3 && { footprint: geometry.footprint }),
        };
        const createRes = await fetch(`${url}/rest/v1/units`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
            body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
            const errText = await createRes.text();
            setUnitFormError(errText || 'Failed to create unit');
            return null;
        }
        const created = (await createRes.json()) as UnitRow[];
        const newUnit = created?.[0];
        if (!newUnit?.id) return null;

        if (interiorFile) {
            const sanitized = interiorFile.name.replace(/\s+/g, '_');
            const objectPath = `interior/${newUnit.id}_${Date.now()}_${sanitized}`;
            const uploadRes = await fetch(`${url}/storage/v1/object/models/${objectPath}`, {
                method: 'POST',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': interiorFile.type || 'application/octet-stream',
                    'x-upsert': 'true',
                },
                body: interiorFile,
            });
            if (uploadRes.ok) {
                const modelPublicUrl = `${url}/storage/v1/object/public/models/${objectPath}`;
                await fetch(`${url}/rest/v1/units?id=eq.${newUnit.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': key, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ internal_model_url: modelPublicUrl }),
                });
            }
        }

        setUnitFormError(null);
        await fetchUnits(buildingId);
        setNotification(`Unit ${trimmed} added.`);
        return { unitId: newUnit.id, hadInterior: !!interiorFile };
    };

    const handleBuildingPlanApply = async (payload: BuildingPlanApplyPayload) => {
        if (!buildingId || !building) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = useAuthStore.getState().session?.access_token;
        if (!url || !key || !token) {
            setUnitFormError('Missing Supabase config or session.');
            return;
        }
        const { plan, newSlots, mapping } = payload;
        const rawPrice = (building as { starting_price?: string }).starting_price;
        const defaultPrice = rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : 120000000;

        const patchRes = await fetch(`${url}/rest/v1/buildings?id=eq.${buildingId}`, {
            method: 'PATCH',
            headers: { 'apikey': key, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ section_plan: plan }),
        });
        if (!patchRes.ok) {
            setUnitFormError(await patchRes.text() || 'Failed to save plan');
            return;
        }

        const existingNumbers = new Set(units.map((u: UnitRow) => u.unit_number));
        const unitNumberFor = (slot: (typeof newSlots)[0], index: number) => {
            const { yLo, yHi } = slotYExtent(slot);
            const base = `${slot.sectionLabel.replace(/\s+/g, '-')}-y${Math.round(yLo)}-${Math.round(yHi)}-fl${slot.floorAnnotation}-${index}`;
            let name = base;
            let n = 0;
            while (existingNumbers.has(name)) {
                n++;
                name = `${base}-${n}`;
            }
            existingNumbers.add(name);
            return name;
        };

        for (let i = 0; i < newSlots.length; i++) {
            const slot = newSlots[i];
            const { position, size, footprint } = slotToUnitGeometry(slot, plan, modelBoundsXZ);
            const oldUnitId = mapping[i] ?? null;
            const oldUnit = oldUnitId ? units.find((u: UnitRow) => u.id === oldUnitId) : null;
            const unitNumber = unitNumberFor(slot, i);
            const insert: Record<string, unknown> = {
                building_id: buildingId,
                unit_number: unitNumber,
                floor: slot.floorAnnotation,
                position,
                size,
                footprint,
                status: oldUnit?.status ?? 'available',
                price: oldUnit?.price ?? defaultPrice,
                display_name: oldUnit?.display_name ?? null,
                internal_model_url: oldUnit?.internal_model_url ?? null,
                mesh_id: `u-${unitNumber}`,
                section_plan_sourced: true,
            };
            const res = await fetch(`${url}/rest/v1/units`, {
                method: 'POST',
                headers: { 'apikey': key, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(insert),
            });
            if (!res.ok) {
                setUnitFormError(await res.text() || 'Failed to create units');
                return;
            }
        }

        const now = new Date().toISOString();
        for (const u of units) {
            await fetch(`${url}/rest/v1/units?id=eq.${u.id}`, {
                method: 'PATCH',
                headers: { 'apikey': key, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ deleted_at: now }),
            });
        }

        setUnitFormError(null);
        await fetchBuilding(buildingId);
        await fetchUnits(buildingId);
        setNotification(`Building plan applied. ${newSlots.length} unit(s) created.`);
    };

    if (loading) {
        return (
            <div className="w-screen h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-[#C6A664] tracking-[0.4em] uppercase animate-pulse">Synchronizing Engine...</div>
            </div>
        );
    }

    return (
        <ErrorBoundary FallbackComponent={EngineErrorFallback}>
            <div className="w-screen h-screen bg-[#0A0A0B] text-[#F5F7FA] overflow-hidden relative">
                <EngineTopBanner />
                <AnimatePresence>
                {notification && (
                    <motion.div
                        key="notification"
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        transition={{ duration: 0.4, ease }}
                        className="fixed top-6 left-1/2 z-50 glass rounded-xl px-5 py-3.5 flex items-center gap-3 pointer-events-none"
                        style={{ borderColor: 'rgba(198,166,100,0.35)' }}
                    >
                        <BellRing size={15} className="text-[#C6A664] shrink-0" />
                        <span className="text-[12px] tracking-wider text-[#F5F7FA]">{notification}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <EngineTopSceneBar
                onBack={handleEngineHistoryBack}
                viewMode={viewMode}
                noWorldMesh={effectiveWorldForUi == null}
                lightingMode={lightingMode}
                onLightingMode={setLightingMode}
                lightingFromHdriSlots={exteriorHdriResolve.fromCollectionSlots}
                worldPreviewMode={worldPreviewActive}
                buildingWorldEnvironment={buildingWorldEnvironment}
            />

            <div className="absolute inset-0">
                <div className="w-full h-full">
                    <MyxelliaCanvas />
                    <PadMarqueeOverlay />
                </div>
                <AnimatePresence>
                    {viewMode === 'interior' && (
                        <motion.div
                            key="interior-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 pointer-events-none"
                        >
                            <EngineInteriorView
                                unit={selectedUnitData}
                                isAdmin={!!isAdmin}
                                onBackToExterior={() => setViewMode('exterior')}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <InteriorUploadModal
                    open={interiorModalOpen}
                    onClose={() => setInteriorModalOpen(false)}
                    unit={selectedUnitData ?? null}
                    onUploaded={handleInteriorUploaded}
                    onError={setUnitFormError}
                />

                <EngineViewControls />

                {showNoMeshLeftFilter ? (
                    <EngineNoMeshLeftFilterPanel
                        bounds={studioFilterBounds}
                        state={studioFilters}
                        onPatch={patchStudioFilters}
                    />
                ) : (
                    <EngineRightPanel
                        viewMode={viewMode}
                        isAdmin={!!isAdmin}
                        buildingId={buildingId}
                        worldPreviewMode={worldPreviewActive}
                        hideSkyboxCatalog={hideSkyboxCatalog}
                        skyboxCollections={skyboxCollections}
                        selectedCatalogCollectionId={selectedCatalogCollectionId}
                        selectedSkyboxSlotId={selectedSkyboxSlotId}
                        onSkyboxSlotChange={setSelectedSkyboxSlotId}
                        skySlotsForPicker={skySlotPicker.slots}
                        showSkySlotPicker={skySlotPicker.showPicker}
                        resolvedHdriUrl={exteriorHdriResolve.url}
                        selectedSkyboxUrl={selectedSkyboxUrl}
                        onSkyboxChange={(v) => void handleSkyboxChange(v)}
                        worldPreviewSkyboxUploading={worldPreviewSkyboxUploading}
                        onWorldPreviewSkyboxFile={worldPreviewActive ? handleWorldPreviewSkyboxUpload : undefined}
                        onSkyboxDefaultSaved={() => {
                            if (buildingId) fetchBuilding(buildingId);
                            setNotification('Default skybox updated.');
                        }}
                        hasGroundMesh={hasGroundMesh}
                        placementPadEditActive={placementPadEditActive}
                        onTogglePadEdit={togglePlacementPadEdit}
                        padDisplayMode={placementPad?.padDisplayMode ?? 'flat'}
                        onPadDisplayMode={setPadDisplayMode}
                        padSaveDisabled={!placementPadDirty || !placementPad}
                        padSaving={padSaving}
                        onSavePad={async () => {
                            setPadSaving(true);
                            try {
                                const ok = await saveGroundPlacementPad();
                                if (ok) {
                                    setNotification(
                                        worldPreviewActive ? 'Default pad saved on this world.' : 'Placement pad saved.'
                                    );
                                } else {
                                    setNotification('Could not save placement pad.');
                                }
                            } finally {
                                setPadSaving(false);
                            }
                        }}
                        onClearPad={async () => {
                            setPadSaving(true);
                            try {
                                const ok = await clearGroundPlacementPad();
                                if (ok) {
                                    setNotification(
                                        worldPreviewActive ? 'World default pad cleared.' : 'Placement pad cleared.'
                                    );
                                } else {
                                    setNotification('Could not clear placement pad.');
                                }
                            } finally {
                                setPadSaving(false);
                            }
                        }}
                        hasPlacementPad={!!placementPad}
                        showBuildingOrientation={
                            viewMode === 'exterior' &&
                            !worldPreviewActive &&
                            !!building?.model_url &&
                            !!placementPad &&
                            hasGroundMesh
                        }
                        buildingOrientationDegrees={buildingOrientationDeg}
                        onBuildingOrientationDegreesChange={handleBuildingOrientationDeg}
                        buildingVerticalOffsetM={placementPad?.buildingVerticalOffsetM ?? 0}
                        onBuildingVerticalOffsetMChange={placementPad ? setPlacementPadBuildingVerticalOffsetM : undefined}
                        showSurroundFill={showSurroundFill}
                        surroundCatalogAssets={surroundCatalogAssets}
                        activeSurroundCatalogAssetId={effectiveWorldForUi?.active_surround_catalog_asset_id ?? null}
                        surroundLayoutMode={
                            isSurroundLayoutMode(effectiveWorldForUi?.surround_layout_mode)
                                ? effectiveWorldForUi.surround_layout_mode
                                : null
                        }
                        surroundSaving={surroundSaving}
                        onSurroundCatalogAssetChange={handleSurroundCatalogAssetChange}
                        onSurroundLayoutModeChange={handleSurroundLayoutModeChange}
                    />
                )}
            </div>

            <EngineSidebar
                viewMode={viewMode}
                floors={floors}
                studioTableFilters={noMeshStudioTableFilters}
                selectedUnitData={selectedUnitData}
                currentStatus={currentStatus}
                unitFormError={unitFormError}
                isAdmin={!!isAdmin}
                singleUnitMode={!!focusUnitId}
                onReserve={handleReserve}
                onUnitSaved={handleUnitSaved}
                onAddUnit={handleAddUnit}
                onDeleteUnit={handleDeleteUnit}
                setUnitFormError={setUnitFormError}
                onInteriorUploaded={handleInteriorUploaded}
                onViewInterior={() => setViewMode('interior')}
                onSaveHotspots={handleSaveHotspots}
                onOpenInteriorModal={() => setInteriorModalOpen(true)}
                onCreateUnitComplete={handleCreateUnitFromModal}
                onUnitCreatedWithInterior={(unitId) => setInteriorAddedPopup({ unitId })}
                onOpenBuildingPlan={() => setBuildingPlanModalOpen(true)}
                worldPreviewMode={worldPreviewActive}
                worldPreviewLabel={buildingWorldEnvironment?.label ?? 'World'}
            />

            {buildingId && !worldPreviewActive && (
                <BuildingPlanModal
                    open={buildingPlanModalOpen}
                    onClose={() => setBuildingPlanModalOpen(false)}
                    buildingId={buildingId}
                    building={building}
                    oldUnits={units}
                    onApply={handleBuildingPlanApply}
                />
            )}

            <AnimatePresence>
                {interiorAddedPopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setInteriorAddedPopup(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-heavy rounded-2xl border border-white/10 p-6 max-w-sm w-full"
                        >
                            <p className="text-[#F5F7FA] text-sm mb-4">Interior added. Modify hotspots now?</p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedUnit(interiorAddedPopup.unitId);
                                        setViewMode('interior');
                                        setInteriorAddedPopup(null);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-[#C6A664] text-[#0A0A0B] text-[11px] tracking-[0.2em] font-bold uppercase"
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInteriorAddedPopup(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-[#94A3B8] text-[11px] tracking-[0.2em] uppercase"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </ErrorBoundary>
    );
}
