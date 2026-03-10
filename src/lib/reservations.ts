import { supabase } from './supabase';
import type { ReservationRow, UnitRow, ProfileRow, Database } from './database.types';

export type ReservationStatus = ReservationRow['status'];

export interface UnitWithBuilding {
    id: string;
    unit_number: string;
    floor: number;
    price: number | null;
    area_sqm: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    status: string;
    building_id: string;
    buildings: { id: string; name: string } | null;
}

export interface ReservationWithDetails extends ReservationRow {
    units: UnitWithBuilding | null;
}

export interface ReservationListItem {
    reservation: ReservationRow;
    unit: UnitRow | null;
    buildingName: string | null;
    profile: ProfileRow | null;
}

async function fetchProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
    if (userIds.length === 0) return new Map();
    const { data, error } = await supabase
        .from('profiles')
        .select('id, created_at, role, full_name, company')
        .in('id', [...new Set(userIds)]);
    if (error) return new Map();
    const map = new Map<string, ProfileRow>();
    (data || []).forEach((p: ProfileRow) => map.set(p.id, p));
    return map;
}

type UnitWithBuildingRow = UnitRow & { buildings: { id: string; name: string } | null };

export async function fetchReservations(options: {
    admin?: boolean;
    userId?: string;
    status?: ReservationStatus;
}): Promise<ReservationListItem[]> {
    let query = supabase
        .from('reservations')
        .select(`
            id, created_at, unit_id, user_id, status, expires_at,
            units (id, unit_number, floor, price, area_sqm, bedrooms, bathrooms, status, building_id, buildings (id, name))
        `)
        .order('created_at', { ascending: false });

    if (options.userId && !options.admin) {
        query = query.eq('user_id', options.userId);
    }
    if (options.status) {
        query = query.eq('status', options.status);
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const userIds = [...new Set((rows as { user_id: string }[]).map((r) => r.user_id))];
    const profileMap = await fetchProfiles(userIds);

    return (rows as (ReservationRow & { units: UnitWithBuildingRow | null })[]).map((r) => {
        const unit = r.units;
        const buildingName = unit?.buildings?.name ?? null;
        const profile = profileMap.get(r.user_id) ?? null;
        const unitRow: UnitRow | null = unit
            ? {
                ...unit,
                building_id: unit.building_id,
            }
            : null;
        return {
            reservation: {
                id: r.id,
                created_at: r.created_at,
                unit_id: r.unit_id,
                user_id: r.user_id,
                status: r.status,
                expires_at: r.expires_at,
            },
            unit: unitRow,
            buildingName,
            profile,
        };
    });
}

type ReservationInsert = Database['public']['Tables']['reservations']['Insert'];

/**
 * Create a reservation (soft_lock). Uses REST API with the provided session token
 * so RLS "Users can insert their own reservations" (auth.uid() = user_id) is satisfied.
 */
export async function createReservation(
    unitId: string,
    userId: string,
    accessToken: string | undefined
): Promise<{ error: string | null }> {
    if (!accessToken) {
        return { error: 'You must be signed in to request a reservation.' };
    }
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return { error: 'Missing Supabase configuration.' };

    const row: ReservationInsert = {
        unit_id: unitId,
        user_id: userId,
        status: 'soft_lock',
    };
    const res = await fetch(`${url}/rest/v1/reservations`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: (err as { message?: string }).message || res.statusText || 'Failed to create reservation.' };
    }
    return { error: null };
}

export async function updateReservationStatus(
    id: string,
    status: 'approved' | 'rejected'
): Promise<{ error: string | null }> {
    const { error } = await supabase.from('reservations').update({ status } as never).eq('id', id);
    return { error: error?.message ?? null };
}
