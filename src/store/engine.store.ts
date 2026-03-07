import { create } from 'zustand'
import { useAuthStore } from './auth.store'
import type { Database } from '../lib/database.types'

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
    /** Used by AI Suggest units: capture current canvas to image */
    screenshotHandler: (() => Promise<string>) | null

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
    requestScreenshot: () => Promise<string>
}

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

    setBuilding: (id) => set({ buildingId: id, activeFloor: null, selectedUnit: null, viewMode: 'exterior' }),

    fetchBuilding: async (id) => {
        set({ loading: true, buildingId: id });
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
        } catch (_err) {
            set({ building: null });
        } finally {
            set({ loading: false });
        }
    },

    fetchUnits: async (buildingId) => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

            const statuses: Record<string, UnitStatus> = {};
            (data || []).forEach((u: UnitRow) => {
                statuses[u.id] = u.status as UnitStatus;
            });
            set({ units: data || [], unitStatuses: statuses });
        } catch (_err) {
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
    requestScreenshot: (): Promise<string> => {
        const handler = useEngineStore.getState().screenshotHandler;
        if (!handler) return Promise.reject(new Error('Canvas not ready for screenshot'));
        return handler();
    },
}))
