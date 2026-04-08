'use client';

import { create } from 'zustand'
import { useAuthStore } from '@/store/auth.store'
import type { Database } from '@/lib/database.types'
import type { SkyboxRow } from '@/lib/skybox'

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
    skyboxEnvironments: SkyboxRow[]
    selectedSkyboxUrl: string | null
    modelBoundsXZ: { minX: number; maxX: number; minZ: number; maxZ: number } | null
    focusUnitId: string | null

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
    setSkyboxEnvironments: (list: SkyboxRow[]) => void
    setSelectedSkyboxUrl: (url: string | null) => void
    setModelBoundsXZ: (bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null) => void
    setFocusUnitId: (id: string | null) => void
    requestScreenshot: () => Promise<string>
    resetEngine: () => void
}

const getSupabaseConfig = () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
});

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
    skyboxEnvironments: [],
    selectedSkyboxUrl: null,
    modelBoundsXZ: null,
    focusUnitId: null,

    setBuilding: (id) => set({ buildingId: id, activeFloor: null, selectedUnit: null, viewMode: 'exterior' }),

    fetchBuilding: async (id) => {
        set({ loading: true, buildingId: id });
        const { url, key } = getSupabaseConfig();
        const token = useAuthStore.getState().session?.access_token;
        try {
            if (!url || !key) throw new Error('Missing Supabase config');
            const res = await fetch(`${url}/rest/v1/buildings?id=eq.${id}&select=*`, {
                headers: {
                    'apikey': key,
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                    'Accept': 'application/json',
                },
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const building = Array.isArray(data) ? data[0] ?? null : data;
            set({ building });
        } catch {
            set({ building: null });
        } finally {
            set({ loading: false });
        }
    },

    fetchUnits: async (buildingId) => {
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

            set({ units: unitList, unitStatuses: statuses });
        } catch {
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
    setSkyboxEnvironments: (list) => set({ skyboxEnvironments: list }),
    setSelectedSkyboxUrl: (url) => set({ selectedSkyboxUrl: url }),
    setModelBoundsXZ: (bounds) => set({ modelBoundsXZ: bounds }),
    setFocusUnitId: (id) => set({ focusUnitId: id }),
    requestScreenshot: (): Promise<string> => {
        const handler = useEngineStore.getState().screenshotHandler;
        if (!handler) return Promise.reject(new Error('Canvas not ready for screenshot'));
        return handler();
    },
    resetEngine: () => set({
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
        skyboxEnvironments: [],
        selectedSkyboxUrl: null,
        modelBoundsXZ: null,
        focusUnitId: null,
    }),
}))
