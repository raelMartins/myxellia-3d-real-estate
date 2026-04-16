import type { SurroundCatalogAssetRow } from './database.types';
import { extensionFromFileName, isAcceptedModel3dExtension } from './model3dFormats';

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type CreateSurroundCatalogOutcome =
    | { ok: true; row: SurroundCatalogAssetRow }
    | { ok: false; message: string };

async function postgrestErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const j = (await res.json()) as { code?: string; message?: string };
        if (j?.code === 'PGRST205') {
            return 'The surround library is not set up on this database yet. In Supabase, open SQL Editor and run the migration file supabase/migrations/20260418120000_surround_catalog_assets.sql (or run supabase db push from this repo). Then try again.';
        }
        if (typeof j?.message === 'string' && j.message.trim()) return j.message;
    } catch {
        /* ignore */
    }
    return fallback;
}

export async function fetchSurroundCatalogAssets(
    getToken: () => string | undefined
): Promise<SurroundCatalogAssetRow[]> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key) return [];
    const res = await fetch(`${url}/rest/v1/surround_catalog_assets?select=*&order=created_at.desc`, {
        headers: {
            apikey: key,
            ...(token && { Authorization: `Bearer ${token}` }),
            Accept: 'application/json',
        },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function uploadSurroundCatalogFile(
    file: File,
    getToken: () => string | undefined
): Promise<string | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return null;
    const safeName = file.name.replace(/\s+/g, '_');
    const ext = extensionFromFileName(safeName);
    if (!isAcceptedModel3dExtension(ext)) return null;
    const lastDot = safeName.lastIndexOf('.');
    const stem = (lastDot >= 0 ? safeName.slice(0, lastDot) : safeName).slice(0, 80);
    const path = `env_surround_cat_${Date.now()}_${stem}.${ext}`;

    const uploadRes = await fetch(`${url}/storage/v1/object/models/${path}`, {
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
    return `${url}/storage/v1/object/public/models/${path}`;
}

export async function createSurroundCatalogAsset(
    payload: { label: string; file_url: string },
    getToken: () => string | undefined
): Promise<CreateSurroundCatalogOutcome> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) {
        return { ok: false, message: 'Missing Supabase configuration or sign-in.' };
    }
    const res = await fetch(`${url}/rest/v1/surround_catalog_assets?select=*`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({
            label: payload.label.trim() || 'Surround prop',
            file_url: payload.file_url,
        }),
    });
    if (!res.ok) {
        return { ok: false, message: await postgrestErrorMessage(res, `Save failed (${res.status}).`) };
    }
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) return { ok: false, message: 'No row returned after save.' };
    return { ok: true, row };
}

export async function deleteSurroundCatalogAsset(id: string, getToken: () => string | undefined): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = getToken();
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/surround_catalog_assets?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
        },
    });
    return res.ok;
}
