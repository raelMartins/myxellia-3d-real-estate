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
    clampBuildingVerticalOffsetM,
    parseStudioExteriorFront,
    type GroundPlacementPad,
    type PadDisplayMode,
    type StudioExteriorFront,
} from '@/lib/groundPlacementPad'
import { isUnitAllocatedToOtherClient } from '@/engine/lib/unitClientAccess'
import { fetchBuildingUnitAllocationsRpc } from '@/engine/lib/fetchBuildingUnitAllocations'

type UnitStatus = 'available' | 'pending' | 'sold'
export type LightingMode = 'morning' | 'noon' | 'golden' | 'night'
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
    /** Studio units table (no world mesh): row hover drives exterior camera only — not 3D prism hover. */
    studioSidebarHoveredUnitId: string | null
    viewMode: 'exterior' | 'interior'
    lightingMode: LightingMode
    unitStatuses: Record<string, UnitStatus>
    /** Display names for users tied to active reservations (approved / soft_lock), when API allows. */
    unitAllocationNames: Record<string, string>
    /** `user_id` holding the winning approved or soft_lock reservation per unit (for client selection rules). */
    unitAllocationUserIds: Record<string, string>
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
    /** True once after "new pad" — gizmo snaps center/size to imported ground before clearing */
    placementPadSceneDefaultPending: boolean
    /** Saved orbit before entering placement-pad edit (restored on Done / Clear) */
    orbitBookmarkBeforePadEdit: { target: [number, number, number]; position: [number, number, number] } | null
    worldPreviewActive: boolean
    previewWorldEnvironmentId: string | null
    /** Studio (no-ground) exterior camera side; persisted on `buildings.ground_placement_pad` JSON. */
    studioExteriorFront: StudioExteriorFront

    setBuilding: (id: string | null) => void
    fetchBuilding: (id: string) => Promise<void>
    fetchUnits: (buildingId: string) => Promise<void>
    setActiveFloor: (id: string | null) => void
    setSelectedUnit: (id: string | null) => void
    setHoveredUnit: (id: string | null) => void
    setStudioSidebarHoveredUnitId: (id: string | null) => void
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
    setPlacementPadBuildingVerticalOffsetM: (meters: number) => void
    setPadDisplayMode: (mode: PadDisplayMode) => void
    togglePlacementPadEdit: () => void
    clearPlacementPadSceneDefaultPending: () => void
    setPadHandleDragging: (on: boolean) => void
    setPadMarqueeScreen: (rect: { x0: number; y0: number; x1: number; y1: number } | null) => void
    setOrbitBookmarkBeforePadEdit: (
        bookmark: { target: [number, number, number]; position: [number, number, number] } | null
    ) => void
    saveGroundPlacementPad: () => Promise<boolean>
    clearGroundPlacementPad: () => Promise<boolean>
    loadWorldPreview: (worldId: string) => Promise<void>
    setStudioExteriorFront: (v: StudioExteriorFront) => void
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
    studioSidebarHoveredUnitId: null,
    viewMode: 'exterior',
    lightingMode: 'morning',
    notification: null,
    unitStatuses: {},
    unitAllocationNames: {},
    unitAllocationUserIds: {},
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
    placementPadSceneDefaultPending: false,
    orbitBookmarkBeforePadEdit: null,
    worldPreviewActive: false,
    previewWorldEnvironmentId: null,
    studioExteriorFront: 'auto',

    setBuilding: (id) =>
        set({
            buildingId: id,
            activeFloor: null,
            selectedUnit: null,
            studioSidebarHoveredUnitId: null,
            viewMode: 'exterior',
            worldPreviewActive: false,
            previewWorldEnvironmentId: null,
            selectedSkyboxSlotId: null,
            selectedCatalogCollectionId: null,
            studioExteriorFront: 'auto',
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
            const studioExteriorFront =
                parseStudioExteriorFront(building?.ground_placement_pad) ?? 'auto';
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
                placementPadSceneDefaultPending: false,
                orbitBookmarkBeforePadEdit: null,
                studioExteriorFront,
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
                placementPadSceneDefaultPending: false,
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

            let unitAllocationNames: Record<string, string> = {};
            let unitAllocationUserIds: Record<string, string> = {};

            if (unitList.length > 0) {
                const unitIdSet = new Set(unitList.map((u) => u.id));
                const rpcRows = await fetchBuildingUnitAllocationsRpc(buildingId, token);
                if (rpcRows !== null) {
                    unitAllocationUserIds = {};
                    unitAllocationNames = {};
                    for (const row of rpcRows) {
                        if (!unitIdSet.has(row.unit_id)) continue;
                        if (row.reservation_status === 'approved') {
                            statuses[row.unit_id] = 'sold';
                        } else {
                            statuses[row.unit_id] = 'pending';
                        }
                        unitAllocationUserIds[row.unit_id] = row.user_id;
                        const label = row.display_name?.trim();
                        if (label) unitAllocationNames[row.unit_id] = label;
                    }
                } else {
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

                    const resAlloc = await fetch(
                        `${url}/rest/v1/reservations?unit_id=in.(${unitIds})&status=in.(approved,soft_lock)&select=unit_id,user_id,status`,
                        {
                            headers: {
                                apikey: key,
                                ...(token && { Authorization: `Bearer ${token}` }),
                                Accept: 'application/json',
                            },
                        }
                    );
                    if (resAlloc.ok) {
                        const allocRows = (await resAlloc.json()) as { unit_id: string; user_id: string; status: string }[];
                        const merged: Record<string, { user_id: string; status: string }> = {};
                        const statusRank = (s: string) => (s === 'approved' ? 2 : 1);
                        for (const row of allocRows) {
                            const prev = merged[row.unit_id];
                            if (!prev || statusRank(row.status) > statusRank(prev.status)) merged[row.unit_id] = row;
                        }
                        unitAllocationUserIds = {};
                        for (const [unitId, row] of Object.entries(merged)) {
                            unitAllocationUserIds[unitId] = row.user_id;
                        }
                        for (const [unitId, row] of Object.entries(merged)) {
                            if (row.status === 'soft_lock' && statuses[unitId] !== 'sold') {
                                statuses[unitId] = 'pending';
                            }
                        }
                        const userIds = [...new Set(Object.values(merged).map((m) => m.user_id))];
                        if (userIds.length > 0) {
                            const idList = userIds.join(',');
                            const profRes = await fetch(
                                `${url}/rest/v1/profiles?id=in.(${idList})&select=id,full_name,company`,
                                {
                                    headers: {
                                        apikey: key,
                                        ...(token && { Authorization: `Bearer ${token}` }),
                                        Accept: 'application/json',
                                    },
                                }
                            );
                            if (profRes.ok) {
                                const profRows = (await profRes.json()) as { id: string; full_name: string | null; company: string | null }[];
                                const profileLabel = (p: { full_name: string | null; company: string | null }) => {
                                    const n = p.full_name?.trim();
                                    const c = p.company?.trim();
                                    if (n && c) return `${n} · ${c}`;
                                    return n || c || 'Client';
                                };
                                const profById = new Map(profRows.map((p) => [p.id, profileLabel(p)]));
                                unitAllocationNames = {};
                                for (const [unitId, { user_id }] of Object.entries(merged)) {
                                    const label = profById.get(user_id);
                                    if (label) unitAllocationNames[unitId] = label;
                                }
                            }
                        }
                    }
                }
            }

            if (myEpoch !== engineLoadEpoch) return;
            const uid = useAuthStore.getState().user?.id;
            const isAdmin = useAuthStore.getState().profile?.role === 'admin';
            const prevSel = useEngineStore.getState().selectedUnit;
            const clearSel =
                prevSel &&
                isUnitAllocatedToOtherClient({
                    unitId: prevSel,
                    currentUserId: uid,
                    isAdmin,
                    unitAllocationUserIds,
                });
            set({
                units: unitList,
                unitStatuses: statuses,
                unitAllocationNames,
                unitAllocationUserIds,
                ...(clearSel ? { selectedUnit: null } : {}),
            });
        } catch {
            if (myEpoch !== engineLoadEpoch) return;
            set({ units: [], unitAllocationNames: {}, unitAllocationUserIds: {} });
        }
    },

    setActiveFloor: (id) => set({ activeFloor: id }),
    setSelectedUnit: (id) => set({ selectedUnit: id }),
    setHoveredUnit: (id) => set({ hoveredUnit: id }),
    setStudioSidebarHoveredUnitId: (id) => set({ studioSidebarHoveredUnitId: id }),
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
    setPlacementPadBuildingVerticalOffsetM: (meters) =>
        set((s) => {
            if (!s.placementPad) return {};
            const buildingVerticalOffsetM = clampBuildingVerticalOffsetM(meters);
            const { buildingVerticalOffsetM: _prevOff, ...rest } = s.placementPad;
            const placementPad: GroundPlacementPad =
                Math.abs(buildingVerticalOffsetM) < 1e-6 ? rest : { ...rest, buildingVerticalOffsetM };
            return { placementPad, placementPadDirty: true };
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
                    placementPadSceneDefaultPending: true,
                };
            }
            return {
                placementPadEditActive: next,
                padMarqueeScreen: null,
                placementPadSceneDefaultPending: next ? s.placementPadSceneDefaultPending : false,
            };
        }),
    clearPlacementPadSceneDefaultPending: () => set({ placementPadSceneDefaultPending: false }),
    setPadHandleDragging: (on) => set({ padHandleDragging: on }),
    setPadMarqueeScreen: (rect) => set({ padMarqueeScreen: rect }),
    setOrbitBookmarkBeforePadEdit: (bookmark) => set({ orbitBookmarkBeforePadEdit: bookmark }),

    saveGroundPlacementPad: async () => {
        const pad = useEngineStore.getState().placementPad;
        const token = useAuthStore.getState().session?.access_token;
        if (!token || !pad) return false;

        const studioExteriorFront = useEngineStore.getState().studioExteriorFront;
        const patchPayload = {
            center: pad.center,
            halfExtents: pad.halfExtents,
            ...(pad.padDisplayMode ? { padDisplayMode: pad.padDisplayMode } : {}),
            ...(pad.buildingYaw != null && Number.isFinite(pad.buildingYaw) ? { buildingYaw: pad.buildingYaw } : {}),
            ...(pad.buildingVerticalOffsetM != null &&
            Number.isFinite(pad.buildingVerticalOffsetM) &&
            Math.abs(pad.buildingVerticalOffsetM) > 1e-6
                ? { buildingVerticalOffsetM: pad.buildingVerticalOffsetM }
                : {}),
            ...(pad.padVerticalOffsetM != null &&
            Number.isFinite(pad.padVerticalOffsetM) &&
            Math.abs(pad.padVerticalOffsetM) > 1e-6
                ? { padVerticalOffsetM: pad.padVerticalOffsetM }
                : {}),
            studioExteriorFront,
        };

        if (useEngineStore.getState().worldPreviewActive) {
            const wid = useEngineStore.getState().previewWorldEnvironmentId;
            if (!wid) return false;
            const ok = await patchWorldEnvironmentGroundPad(
                wid,
                { ...pad, studioExteriorFront },
                () => token,
            );
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
                placementPadSceneDefaultPending: false,
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
            placementPadSceneDefaultPending: false,
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
            placementPadSceneDefaultPending: false,
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
                    placementPadSceneDefaultPending: false,
                    orbitBookmarkBeforePadEdit: null,
                    notification: 'World environment not found or you do not have access.',
                });
                return;
            }
            const placementPad = parseGroundPlacementPad(
                (row as { ground_placement_pad?: unknown }).ground_placement_pad
            );
            if (myEpoch !== engineLoadEpoch) return;
            const studioExteriorFront =
                parseStudioExteriorFront(
                    (row as { ground_placement_pad?: unknown }).ground_placement_pad,
                ) ?? 'auto';
            set((st) => ({
                building: null,
                units: [],
                buildingWorldEnvironment: row,
                selectedWorldEnvironmentId: row.id,
                placementPad,
                placementPadDirty: false,
                placementPadEditActive: false,
                padMarqueeScreen: null,
                placementPadSceneDefaultPending: false,
                orbitBookmarkBeforePadEdit: null,
                selectedSkyboxUrl: null,
                selectedSkyboxSlotId: null,
                selectedCatalogCollectionId: null,
                studioExteriorFront,
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
            studioSidebarHoveredUnitId: null,
            viewMode: 'exterior',
            lightingMode: 'morning',
            notification: null,
            unitStatuses: {},
            unitAllocationNames: {},
            unitAllocationUserIds: {},
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
            placementPadSceneDefaultPending: false,
            orbitBookmarkBeforePadEdit: null,
            worldPreviewActive: false,
            previewWorldEnvironmentId: null,
            studioExteriorFront: 'auto',
        });
    },

    setStudioExteriorFront: (v) => {
        set({ studioExteriorFront: v });
        queueMicrotask(async () => {
            const st = useEngineStore.getState();
            if (st.worldPreviewActive || !st.buildingId || !st.building) return;
            const token = useAuthStore.getState().session?.access_token;
            if (!token || useAuthStore.getState().profile?.role !== 'admin') return;
            const { url, key } = getSupabaseConfig();
            if (!url || !key) return;
            const raw = st.building.ground_placement_pad;
            const base =
                typeof raw === 'object' && raw !== null && !Array.isArray(raw)
                    ? { ...(raw as Record<string, unknown>) }
                    : {};
            const merged = { ...base, studioExteriorFront: st.studioExteriorFront };
            const res = await fetch(`${url}/rest/v1/buildings?id=eq.${st.buildingId}`, {
                method: 'PATCH',
                headers: {
                    apikey: key,
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                },
                body: JSON.stringify({ ground_placement_pad: merged }),
            });
            if (!res.ok) {
                set({ notification: 'Could not save exterior front preference.' });
                return;
            }
            set((s) => ({
                building: s.building ? { ...s.building, ground_placement_pad: merged } : null,
            }));
        });
    },
}))
