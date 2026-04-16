import type { Database } from './database.types';

export type SkyboxCollectionRow = Database['public']['Tables']['skybox_collections']['Row'];
export type SkyboxCollectionSlotRow = Database['public']['Tables']['skybox_collection_slots']['Row'];

export type SkyboxCollectionWithSlots = SkyboxCollectionRow & {
    skybox_collection_slots?: SkyboxCollectionSlotRow[] | null;
};

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const selectWithSlots =
    'id,created_at,label,skybox_collection_slots(id,collection_id,label,file_url,sort_order)';

export async function fetchSkyboxCollections(getToken: () => string | undefined): Promise<SkyboxCollectionWithSlots[]> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key) return [];
    const res = await fetch(
        `${url}/rest/v1/skybox_collections?select=${encodeURIComponent(selectWithSlots)}&order=created_at.desc`,
        {
            headers: {
                apikey: key,
                ...(token && { Authorization: `Bearer ${token}` }),
                Accept: 'application/json',
            },
        }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function fetchSkyboxCollectionById(
    id: string,
    getToken: () => string | undefined
): Promise<SkyboxCollectionWithSlots | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key) return null;
    const res = await fetch(
        `${url}/rest/v1/skybox_collections?id=eq.${id}&select=${encodeURIComponent(selectWithSlots)}`,
        {
            headers: {
                apikey: key,
                ...(token && { Authorization: `Bearer ${token}` }),
                Accept: 'application/json',
            },
        }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data[0] ? data[0] : null;
}

export async function createSkyboxCollection(
    label: string,
    getToken: () => string | undefined
): Promise<SkyboxCollectionRow | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return null;
    const res = await fetch(`${url}/rest/v1/skybox_collections?select=*`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({ label: label.trim() || 'Sky collection' }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function uploadHdrToBucket(file: File, stem: string, getToken: () => string | undefined): Promise<string | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'hdr';
    const path = `${Date.now()}_${stem.replace(/\s+/g, '_').slice(0, 60)}.${ext}`;
    const uploadRes = await fetch(`${url}/storage/v1/object/skyboxes/${path}`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
        },
        body: file,
    });
    if (!uploadRes.ok) return null;
    return `${url}/storage/v1/object/public/skyboxes/${path}`;
}

export async function insertSkyboxCollectionSlot(
    collectionId: string,
    payload: { label: string; file_url: string; sort_order: number },
    getToken: () => string | undefined
): Promise<SkyboxCollectionSlotRow | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return null;
    const res = await fetch(`${url}/rest/v1/skybox_collection_slots?select=*`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({
            collection_id: collectionId,
            label: payload.label.trim() || 'Slot',
            file_url: payload.file_url,
            sort_order: payload.sort_order,
        }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** Upload one HDR file and append as the next slot on the collection. */
export async function uploadSlotToCollection(
    collectionId: string,
    file: File,
    label: string,
    getToken: () => string | undefined
): Promise<SkyboxCollectionSlotRow | null> {
    const coll = await fetchSkyboxCollectionById(collectionId, getToken);
    const existing = coll?.skybox_collection_slots ?? [];
    const maxOrder = existing.reduce((m, s) => Math.max(m, s.sort_order), -1);
    const nextOrder = maxOrder + 1;
    const stem = label.trim() || file.name.replace(/\.[^.]+$/, '') || 'hdri';
    const fileUrl = await uploadHdrToBucket(file, stem, getToken);
    if (!fileUrl) return null;
    return insertSkyboxCollectionSlot(
        collectionId,
        { label: label.trim() || stem, file_url: fileUrl, sort_order: nextOrder },
        getToken
    );
}

export async function patchSkyboxCollectionSlotOrder(
    slotId: string,
    sort_order: number,
    getToken: () => string | undefined
): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/skybox_collection_slots?id=eq.${slotId}`, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ sort_order }),
    });
    return res.ok;
}

export async function patchSkyboxCollectionSlotLabel(
    slotId: string,
    label: string,
    getToken: () => string | undefined
): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/skybox_collection_slots?id=eq.${slotId}`, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ label: label.trim() || 'Slot' }),
    });
    return res.ok;
}

export async function deleteSkyboxCollectionSlot(id: string, getToken: () => string | undefined): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/skybox_collection_slots?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
        },
    });
    return res.ok;
}

export async function deleteSkyboxCollection(id: string, getToken: () => string | undefined): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/skybox_collections?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
        },
    });
    return res.ok;
}

export async function patchSkyboxCollectionLabel(
    id: string,
    label: string,
    getToken: () => string | undefined
): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/skybox_collections?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ label: label.trim() || 'Collection' }),
    });
    return res.ok;
}

/**
 * Create collection + upload multiple HDRs as slots (order = array order).
 */
export async function createCollectionWithHdrFiles(
    collectionLabel: string,
    files: { file: File; label: string }[],
    getToken: () => string | undefined
): Promise<SkyboxCollectionWithSlots | null> {
    const coll = await createSkyboxCollection(collectionLabel, getToken);
    if (!coll || files.length === 0) {
        if (coll && files.length === 0) {
            return fetchSkyboxCollectionById(coll.id, getToken);
        }
        return null;
    }
    for (let i = 0; i < files.length; i++) {
        const { file, label } = files[i];
        const stem = label.trim() || file.name.replace(/\.[^.]+$/, '') || `slot_${i}`;
        const fileUrl = await uploadHdrToBucket(file, stem, getToken);
        if (!fileUrl) return fetchSkyboxCollectionById(coll.id, getToken);
        const row = await insertSkyboxCollectionSlot(
            coll.id,
            { label: stem, file_url: fileUrl, sort_order: i },
            getToken
        );
        if (!row) return fetchSkyboxCollectionById(coll.id, getToken);
    }
    return fetchSkyboxCollectionById(coll.id, getToken);
}

/** Reassign contiguous sort_order 0..n-1 from ordered slot ids */
export async function reorderCollectionSlots(
    _collectionId: string,
    orderedSlotIds: string[],
    getToken: () => string | undefined
): Promise<boolean> {
    for (let i = 0; i < orderedSlotIds.length; i++) {
        const ok = await patchSkyboxCollectionSlotOrder(orderedSlotIds[i], i, getToken);
        if (!ok) return false;
    }
    return true;
}
