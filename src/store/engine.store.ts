import { create } from 'zustand'
import { supabase } from '../lib/supabase'
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
        try {
            const { data, error } = await supabase.from('buildings').select('*').eq('id', id).single();
            if (error) throw error;
            set({ building: data });
        } catch (err) {
            console.error('Error fetching building:', err);
        } finally {
            set({ loading: false });
        }
    },

    fetchUnits: async (buildingId) => {
        try {
            const { data, error } = await supabase.from('units').select('*').eq('building_id', buildingId);
            if (error) throw error;
            set({ units: data || [] });

            // Sync unit statuses
            const statuses: Record<string, UnitStatus> = {};
            data?.forEach((u: UnitRow) => {
                statuses[u.id] = u.status as UnitStatus;
            });
            set({ unitStatuses: statuses });
        } catch (err) {
            console.error('Error fetching units:', err);
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
