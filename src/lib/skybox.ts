import type { Database } from './database.types';

export type SkyboxRow = Database['public']['Tables']['skybox_environments']['Row'];

const supabaseUrl = () => import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchSkyboxEnvironments(getToken: () => string | undefined): Promise<SkyboxRow[]> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key) return [];
    const res = await fetch(`${url}/rest/v1/skybox_environments?select=*&order=created_at.desc`, {
        headers: {
            'apikey': key,
            ...(token && { 'Authorization': `Bearer ${token}` }),
            'Accept': 'application/json',
        },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function uploadSkyboxEnvironment(
    file: File,
    label: string,
    getToken: () => string | undefined
): Promise<SkyboxRow | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'hdr';
    const path = `${Date.now()}_${label.replace(/\s+/g, '_').slice(0, 40)}.${ext}`;

    const uploadRes = await fetch(`${url}/storage/v1/object/skyboxes/${path}`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
        },
        body: file,
    });
    if (!uploadRes.ok) return null;

    const fileUrl = `${url}/storage/v1/object/public/skyboxes/${path}`;
    const insertRes = await fetch(`${url}/rest/v1/skybox_environments?select=*`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        body: JSON.stringify({ label: label.trim() || 'Skybox', file_url: fileUrl }),
    });
    if (!insertRes.ok) return null;
    const rows = await insertRes.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
