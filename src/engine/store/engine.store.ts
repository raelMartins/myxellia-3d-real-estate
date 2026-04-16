'use client';

import { create } from 'zustand'
import { useAuthStore } from '@/store/auth.store'
import type { Database } from '@/lib/database.types'
import type { SkyboxCollectionWithSlots } from '@/lib/skyboxCollections'
import type { WorldEnvironmentWithSky } from '@/lib/worldEnvironments'
import {
    getWorldEnvironmentRestSelect,
    fetchWorldEnvironmentById,
    normalizeWorldEnvironmentRow,
    patchWorldEnvironmentGroundPad,
} from '@/lib/worldEnvironments'
import {
    parseGroundPlacementPad,
    defaultGroundPlacementPad,
    type GroundPlacementPad,
    type PadDisplayMode,
} from '@/lib/groundPlacementPad'

type UnitStatus = 'available' | 'pending' | 'sold'
type LightingMode = 'morning' | 'golden' | 'night'
type BuildingRow = Database['public']['Tables']['buildings']['Row']
type UnitRow = Database['public']['Tables']['units']['Row']

interface EngineState {
    building: BuildingRow | null
    units: UnitRow[]
    buildingId: string | null
    loading: boolean
    activeFloor: string | null
    selectedUnit: string | null
    hoveredUnit: string | null
    viewMode: 'exterior' | 'interior'
    lightingMode: LightingMode
    unitStatuses: Record<string, UnitStatus>
    notification: string | null
    screenshotHandler: (() => Promise<string>) | null
    unitPositionHandler: ((unitId: string, position: [number, number, number]) => Promise<void>) | null
    unitSizeHandler: ((unitId: string, size: [number, number, number]) => Promise<void>) | null
    unitRotationHandler: ((unitId: string, rotation: number) => Promise<void>) | null
    hotspotPlacementMode: boolean
    capturedHotspotPosition: [number, number, number] | null
    skyboxCollections: SkyboxCollectionWithSlots[]
    /** Catalog sky collection when world has no bundled sky (building engine). */
    selectedCatalogCollectionId: string | null
    /** Active HDRI slot within world or catalog collection; null = first by sort_order. */
    selectedSkyboxSlotId: string | null
    /** `__none__` = explicit no HDR; otherwise unused for resolution (use resolver). */
    selectedSkyboxUrl: string | null
    worldEnvironments: WorldEnvironmentWithSky[]
    buildingWorldEnvironment: WorldEnvironmentWithSky | null
    selectedWorldEnvironmentId: string | null
    modelBoundsXZ: { minX: number; maxX: number; minZ: number; maxZ: number } | null
    focusUnitId: string | null
    placementPad: GroundPlacementPad | null
    placementPadDirty: boolean
    placementPadEditActive: boolean
    padHandleDragging: boolean
    /** Screen-space marquee while drawing placement pad (DOM overlay; not R3F) */
    padMarqueeScreen: { x0: number; y0: number; x1: number; y1: number } | null
    /** Saved orbit before entering placement-pad edit (restored on Done / Clear) */
    orbitBookmarkBeforePadEdit: { target: [number, number, number]; position: [number, number, number] } | null
    worldPreviewActive: boolean
    previewWorldEnvironmentId: string | null

    setBuilding: (id: string | null) => void
    fetchBuilding: (id: string) => Promise<void>
    fetchUnits: (buildingId: string) => Promise<void>
    setActiveFloor: (id: string | null) => void
    setSelectedUnit: (id: string | null) => void
    setHoveredUnit: (id: string | null) => void
    setViewMode: (mode: 'exterior' | 'interior') => void
    setLightingMode: (mode: LightingMode) => void
    setUnitStatus: (id: string, status: UnitStatus) => void
    setNotification: (msg: string | null) => void
    setScreenshotHandler: (handler: (() => Promise<string>) | null) => void
    setUnitPositionHandler: (handler: ((unitId: string, position: [number, number, number]) => Promise<void>) | null) => void
    setUnitSizeHandler: (handler: ((unitId: string, size: [number, number, number]) => Promise<void>) | null) => void
    setUnitRotationHandler: (handler: ((unitId: string, rotation: number) => Promise<void>) | null) => void
    setHotspotPlacementMode: (on: boolean) => void
    setCapturedHotspotPosition: (pos: [number, number, number] | null) => void
    setSkyboxCollections: (list: SkyboxCollectionWithSlots[]) => void
    setSelectedCatalogCollectionId: (id: string | null) => void
    setSelectedSkyboxSlotId: (id: string | null) => void
    setSelectedSkyboxUrl: (url: string | null) => void
    setWorldEnvironments: (list: WorldEnvironmentWithSky[]) => void
    setBuildingWorldEnvironment: (row: WorldEnvironmentWithSky | null) => void
    setSelectedWorldEnvironmentId: (id: string | null) => void
    setModelBoundsXZ: (bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null) => void
    setFocusUnitId: (id: string | null) => void
    requestScreenshot: () => Promise<string>
    resetEngine: () => void
    setPlacementPad: (pad: GroundPlacementPad | null) => void
    /** Additional Y rotation (rad) on top of auto 0 / π/2 lengthwise fit */
    setPlacementPadBuildingYaw: (yawRadians: number) => void
    setPadDisplayMode: (mode: PadDisplayMode) => void
    togglePlacementPadEdit: () => void
    setPadHandleDragging: (on: boolean) => void
    setPadMarqueeScreen: (rect: { x0: number; y0: number; x1: number; y1: number } | null) => void
    setOrbitBookmarkBeforePadEdit: (
        bookmark: { target: [number, number, number]; position: [number, number, number] } | null
    ) => void
    saveGroundPlacementPad: () => Promise<boolean>
    clearGroundPlacementPad: () => Promise<boolean>
    loadWorldPreview: (worldId: string) => Promise<void>
}

const getSupabaseConfig = () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
});

/**
 * Bumped when starting a new building/world load and on resetEngine().
 * Prevents in-flight REST responses from mutating global state after navigation away from the engine.
 */
let engineLoadEpoch = 0;

export const useEngineStore = create<EngineState>((set) => ({
    building: null,
    units: [],
    buildingId: null,
    loading: false,
    activeFloor: null,
    selectedUnit: null,
    hoveredUnit: null,
    viewMode: 'exterior',
    lightingMode: 'golden',
    notification: null,
    unitStatuses: {},
    screenshotHandler: null,
    unitPositionHandler: null,
    unitSizeHandler: null,
    unitRotationHandler: null,
    hotspotPlacementMode: false,
    capturedHotspotPosition: null,
    skyboxCollections: [],
    selectedCatalogCollectionId: null,
    selectedSkyboxSlotId: null,
    selectedSkyboxUrl: null,
    worldEnvironments: [],
    buildingWorldEnvironment: null,
    selectedWorldEnvironmentId: null,
    modelBoundsXZ: null,
    focusUnitId: null,
    placementPad: null,
    placementPadDirty: false,
    placementPadEditActive: false,
    padHandleDragging: false,
    padMarqueeScreen: null,
    orbitBookmarkBeforePadEdit: null,
    worldPreviewActive: false,
    previewWorldEnvironmentId: null,

    setBuilding: (id) =>
        set({
            buildingId: id,
            activeFloor: null,
            selectedUnit: null,
            viewMode: 'exterior',
            worldPreviewActive: false,
            previewWorldEnvironmentId: null,
            selectedSkyboxSlotId: null,
            selectedCatalogCollectionId: null,
        }),

    fetchBuilding: async (id) => {
        const myEpoch = ++engineLoadEpoch;
        set({ loading: true, buildingId: id });
        const { url, key } = getSupabaseConfig();
        const token = useAuthStore.getState().session?.access_token;
        try {
            if (!url || !key) throw new Error('Missing Supabase config');
            const worldSel = await getWorldEnvironmentRestSelect(() => token ?? undefined);
            const embed = `*,world_environments(${worldSel})`;
            const res = await fetch(
                `${url}/rest/v1/buildings?id=eq.${id}&select=${encodeURIComponent(embed)}`,
                {
                    headers: {
                        'apikey': key,
                        ...(token && { 'Authorization': `Bearer ${token}` }),
                        'Accept': 'application/json',
                    },
                }
            );
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const raw = Array.isArray(data) ? data[0] ?? null : data;
            let building: BuildingRow | null = null;
            let buildingWorldEnvironment: WorldEnvironmentWithSky | null = null;
            if (raw && typeof raw === 'object') {
                const { world_environments: we, ...rest } = raw as BuildingRow & {
                    world_environments?: WorldEnvironmentWithSky | WorldEnvironmentWithSky[] | null;
                };
                building = rest as BuildingRow;
                if (we == null) buildingWorldEnvironment = null;
                else if (Array.isArray(we))
                    buildingWorldEnvironment = we[0] ? normalizeWorldEnvironmentRow(we[0]) : null;
                else buildingWorldEnvironment = normalizeWorldEnvironmentRow(we);
            }
            const fromBuilding = building ? parseGroundPlacementPad(building.ground_placement_pad) : null;
            const fromWorldTemplate =
                !fromBuilding && buildingWorldEnvironment
                    ? parseGroundPlacementPad(
                          (buildingWorldEnvironment as { ground_placement_pad?: unknown }).ground_placement_pad
                      )
                    : null;
            const placementPad = fromBuilding ?? fromWorldTemplate ?? null;
            if (myEpoch !== engineLoadEpoch) return;
            set({
                building,
                buildingWorldEnvironment,
                selectedWorldEnvironmentId: null,
                worldPreviewActive: false,
                previewWorldEnvironmentId: null,
                placementPad,
                placementPadDirty: false,
                placementPadEditActive: false,
                padHandleDragging: false,
                padMarqueeScreen: null,
                orbitBookmarkBeforePadEdit: null,
            });
        } catch {
            if (myEpoch !== engineLoadEpoch) return;
            set({
                building: null,
                buildingWorldEnvironment: null,
                worldPreviewActive: false,
                previewWorldEnvironmentId: null,
                placementPad: null,
                placementPadDirty: false,
                placementPadEditActive: false,
                padHandleDragging: false,
                padMarqueeScreen: null,
                orbitBookmarkBeforePadEdit: null,
            });
        } finally {
            if (myEpoch === engineLoadEpoch) set({ loading: false });
        }
    },

    fetchUnits: async (buildingId) => {
        const myEpoch = engineLoadEpoch;
        const { url, key } = getSupabaseConfig();
        const token = useAuthStore.getState().session?.access_token;
        try {
            if (!url || !key) throw new Error('Missing Supabase config');
            const res = await fetch(`${url}/rest/v1/units?building_id=eq.${buildingId}&deleted_at=is.null&select=*`, {
                headers: {
                    'apikey': key,
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                    'Accept': 'application/json',
                },
            });
            if (!res.ok) throw new Error(await res.text());
            const data = (await res.json()) as UnitRow[];
            const unitList = data || [];
            const statuses: Record<string, UnitStatus> = {};
            unitList.forEach((u: UnitRow) => {
                statuses[u.id] = u.status as UnitStatus;
            });

            if (unitList.length > 0) {
                const unitIds = unitList.map((u) => u.id).join(',');
                const resRes = await fetch(
                    `${url}/rest/v1/reservations?status=eq.approved&unit_id=in.(${unitIds})&select=unit_id`,
                    {
                        headers: {
                            apikey: key,
                            ...(token && { Authorization: `Bearer ${token}` }),
                            Accept: 'application/json',
                        },
                    }
                );
                if (resRes.ok) {
                    const approved = (await resRes.json()) as { unit_id: string }[];
                    (approved || []).forEach((r) => {
                        statuses[r.unit_id] = 'sold';
                    });
                }
            }

            if (myEpoch !== engineLoadEpoch) return;
            set({ units: unitList, unitStatuses: statuses });
        } catch {
            if (myEpoch !== engineLoadEpoch) return;
            set({ units: [] });
        }
    },

    setActiveFloor: (id) => set({ activeFloor: id }),
    setSelectedUnit: (id) => set({ selectedUnit: id }),
    setHoveredUnit: (id) => set({ hoveredUnit: id }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setLightingMode: (mode) => set({ lightingMode: mode }),
    setUnitStatus: (id, st) => set((s) => ({ unitStatuses: { ...s.unitStatuses, [id]: st } })),
    setNotification: (msg) => set({ notification: msg }),
    setScreenshotHandler: (handler) => set({ screenshotHandler: handler }),
    setUnitPositionHandler: (handler) => set({ unitPositionHandler: handler }),
    setUnitSizeHandler: (handler) => set({ unitSizeHandler: handler }),
    setUnitRotationHandler: (handler) => set({ unitRotationHandler: handler }),
    setHotspotPlacementMode: (on) => set({ hotspotPlacementMode: on, ...(on ? {} : { capturedHotspotPosition: null }) }),
    setCapturedHotspotPosition: (pos) => set({ capturedHotspotPosition: pos }),
    setSkyboxCollections: (list) => set({ skyboxCollections: list }),
    setSelectedCatalogCollectionId: (id) => set({ selectedCatalogCollectionId: id }),
    setSelectedSkyboxSlotId: (id) => set({ selectedSkyboxSlotId: id }),
    setSelectedSkyboxUrl: (url) => set({ selectedSkyboxUrl: url }),
    setWorldEnvironments: (list) => set({ worldEnvironments: list }),
    setBuildingWorldEnvironment: (row) => set({ buildingWorldEnvironment: row }),
    setSelectedWorldEnvironmentId: (id) => set({ selectedWorldEnvironmentId: id }),
    setModelBoundsXZ: (bounds) => set({ modelBoundsXZ: bounds }),
    setFocusUnitId: (id) => set({ focusUnitId: id }),
    requestScreenshot: (): Promise<string> => {
        const handler = useEngineStore.getState().screenshotHandler;
        if (!handler) return Promise.reject(new Error('Canvas not ready for screenshot'));
        return handler();
    },

    setPlacementPad: (pad) => set({ placementPad: pad, placementPadDirty: true }),
    setPlacementPadBuildingYaw: (yawRadians) =>
        set((s) => {
            if (!s.placementPad) return {};
            return {
                placementPad: { ...s.placementPad, buildingYaw: yawRadians },
                placementPadDirty: true,
            };
        }),
    setPadDisplayMode: (mode) =>
        set((s) => {
            if (!s.placementPad) return {};
            return { placementPad: { ...s.placementPad, padDisplayMode: mode }, placementPadDirty: true };
        }),
    togglePlacementPadEdit: () =>
        set((s) => {
            const next = !s.placementPadEditActive;
            if (next && !s.placementPad) {
                return {
                    placementPadEditActive: true,
                    padMarqueeScreen: null,
                    orbitBookmarkBeforePadEdit: null,
                    placementPad: defaultGroundPlacementPad(),
                    placementPadDirty: true,
                };
            }
            return { placementPadEditActive: next, padMarqueeScreen: null };
        }),
    setPadHandleDragging: (on) => set({ padHandleDragging: on }),
    setPadMarqueeScreen: (rect) => set({ padMarqueeScreen: rect }),
    setOrbitBookmarkBeforePadEdit: (bookmark) => set({ orbitBookmarkBeforePadEdit: bookmark }),

    saveGroundPlacementPad: async () => {
        const pad = useEngineStore.getState().placementPad;
        const token = useAuthStore.getState().session?.access_token;
        if (!token || !pad) return false;

        const patchPayload = {
            center: pad.center,
            halfExtents: pad.halfExtents,
            ...(pad.padDisplayMode ? { padDisplayMode: pad.padDisplayMode } : {}),
            ...(pad.buildingYaw != null && Number.isFinite(pad.buildingYaw) ? { buildingYaw: pad.buildingYaw } : {}),
        };

        if (useEngineStore.getState().worldPreviewActive) {
            const wid = useEngineStore.getState().previewWorldEnvironmentId;
            if (!wid) return false;
            const ok = await patchWorldEnvironmentGroundPad(wid, pad, () => token);
            if (!ok) return false;
            set((st) => ({
                buildingWorldEnvironment: st.buildingWorldEnvironment
                    ? { ...st.buildingWorldEnvironment, ground_placement_pad: patchPayload }
                    : null,
                worldEnvironments: st.worldEnvironments.map((w) =>
                    w.id === wid ? { ...w, ground_placement_pad: patchPayload } : w
                ),
                placementPadDirty: false,
            }));
            return true;
        }

        const { url, key } = getSupabaseConfig();
        const buildingId = useEngineStore.getState().buildingId;
        if (!url || !key || !buildingId) return false;
        const res = await fetch(`${url}/rest/v1/buildings?id=eq.${buildingId}`, {
            method: 'PATCH',
            headers: {
                apikey: key,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({ ground_placement_pad: patchPayload }),
        });
        if (!res.ok) return false;
        set((st) => ({
            building: st.building ? { ...st.building, ground_placement_pad: patchPayload } : null,
            placementPadDirty: false,
        }));
        return true;
    },

    clearGroundPlacementPad: async () => {
        const token = useAuthStore.getState().session?.access_token;
        if (!token) return false;

        if (useEngineStore.getState().worldPreviewActive) {
            const wid = useEngineStore.getState().previewWorldEnvironmentId;
            if (!wid) return false;
            const ok = await patchWorldEnvironmentGroundPad(wid, null, () => token);
            if (!ok) return false;
            set((st) => ({
                buildingWorldEnvironment: st.buildingWorldEnvironment
                    ? { ...st.buildingWorldEnvironment, ground_placement_pad: null }
                    : null,
                worldEnvironments: st.worldEnvironments.map((w) => (w.id === wid ? { ...w, ground_placement_pad: null } : w)),
                placementPad: null,
                placementPadDirty: false,
                placementPadEditActive: false,
                padMarqueeScreen: null,
            }));
            return true;
        }

        const { url, key } = getSupabaseConfig();
        const buildingId = useEngineStore.getState().buildingId;
        if (!url || !key || !buildingId) return false;
        const res = await fetch(`${url}/rest/v1/buildings?id=eq.${buildingId}`, {
            method: 'PATCH',
            headers: {
                apikey: key,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({ ground_placement_pad: null }),
        });
        if (!res.ok) return false;
        set((st) => ({
            building: st.building ? { ...st.building, ground_placement_pad: null } : null,
            placementPad: null,
            placementPadDirty: false,
            placementPadEditActive: false,
            padMarqueeScreen: null,
        }));
        return true;
    },

    loadWorldPreview: async (worldId: string) => {
        const myEpoch = ++engineLoadEpoch;
        set({
            loading: true,
            buildingId: null,
            building: null,
            units: [],
            selectedUnit: null,
            worldPreviewActive: true,
            previewWorldEnvironmentId: worldId,
            placementPad: null,
            placementPadDirty: false,
            placementPadEditActive: false,
            padHandleDragging: false,
            padMarqueeScreen: null,
            orbitBookmarkBeforePadEdit: null,
            selectedSkyboxUrl: null,
            selectedSkyboxSlotId: null,
            selectedCatalogCollectionId: null,
        });
        const token = useAuthStore.getState().session?.access_token;
        try {
            const row = await fetchWorldEnvironmentById(worldId, () => token);
            if (!row) {
                if (myEpoch !== engineLoadEpoch) return;
                set({
                    loading: false,
                    worldPreviewActive: false,
                    previewWorldEnvironmentId: null,
                    buildingWorldEnvironment: null,
                    selectedWorldEnvironmentId: null,
                    padMarqueeScreen: null,
                    orbitBookmarkBeforePadEdit: null,
                    notification: 'World environment not found or you do not have access.',
                });
                return;
            }
            const placementPad = parseGroundPlacementPad(
                (row as { ground_placement_pad?: unknown }).ground_placement_pad
            );
            if (myEpoch !== engineLoadEpoch) return;
            set((st) => ({
                building: null,
                units: [],
                buildingWorldEnvironment: row,
                selectedWorldEnvironmentId: row.id,
                placementPad,
                placementPadDirty: false,
                placementPadEditActive: false,
                padMarqueeScreen: null,
                orbitBookmarkBeforePadEdit: null,
                selectedSkyboxUrl: null,
                selectedSkyboxSlotId: null,
                selectedCatalogCollectionId: null,
                worldEnvironments: [row, ...st.worldEnvironments.filter((w) => w.id !== row.id)],
            }));
        } finally {
            if (myEpoch === engineLoadEpoch) set({ loading: false });
        }
    },

    resetEngine: () => {
        engineLoadEpoch += 1;
        set({
            building: null,
            units: [],
            buildingId: null,
            loading: false,
            activeFloor: null,
            selectedUnit: null,
            hoveredUnit: null,
            viewMode: 'exterior',
            lightingMode: 'golden',
            notification: null,
            unitStatuses: {},
            screenshotHandler: null,
            unitPositionHandler: null,
            unitSizeHandler: null,
            unitRotationHandler: null,
            hotspotPlacementMode: false,
            capturedHotspotPosition: null,
            skyboxCollections: [],
            selectedCatalogCollectionId: null,
            selectedSkyboxSlotId: null,
            selectedSkyboxUrl: null,
            worldEnvironments: [],
            buildingWorldEnvironment: null,
            selectedWorldEnvironmentId: null,
            modelBoundsXZ: null,
            focusUnitId: null,
            placementPad: null,
            placementPadDirty: false,
            placementPadEditActive: false,
            padHandleDragging: false,
            padMarqueeScreen: null,
            orbitBookmarkBeforePadEdit: null,
            worldPreviewActive: false,
            previewWorldEnvironmentId: null,
        });
    },
}))
