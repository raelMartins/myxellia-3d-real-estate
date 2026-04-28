export type BuildingUnitAllocationRow = {
    unit_id: string;
    user_id: string;
    reservation_status: string;
    display_name: string | null;
};

/**
 * Loads allocation rows for all units in a building via SECURITY DEFINER RPC,
 * so client sessions see other holders’ locks (not possible through reservations RLS alone).
 */
export async function fetchBuildingUnitAllocationsRpc(
    buildingId: string,
    accessToken: string | undefined
): Promise<BuildingUnitAllocationRow[] | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || !key) return null;
    const res = await fetch(`${url}/rest/v1/rpc/building_unit_allocations`, {
        method: 'POST',
        headers: {
            apikey: key,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ p_building_id: buildingId }),
    });
    if (!res.ok) return null;
    try {
        const data = (await res.json()) as unknown;
        return Array.isArray(data) ? (data as BuildingUnitAllocationRow[]) : null;
    } catch {
        return null;
    }
}
