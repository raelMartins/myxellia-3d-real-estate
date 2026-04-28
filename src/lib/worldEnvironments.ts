import type { Database, SurroundCatalogAssetRow } from './database.types';
import { extensionFromFileName, isAcceptedModel3dExtension } from './model3dFormats';
import type { GroundPlacementPad } from './groundPlacementPad';
import type { SkyboxCollectionWithSlots } from './skyboxCollections';
import { getValidAccessToken } from './supabase';

export type WorldEnvironmentRow = Database['public']['Tables']['world_environments']['Row'];
export type WorldScatterAssetRow = Database['public']['Tables']['world_scatter_assets']['Row'];

export type ScatterSurroundKind = 'clump' | 'tree';

/** How surround props fill the ring outside the ground mesh (engine + DB). */
export type SurroundLayoutMode = 'packed' | 'spread' | 'sparse';

export function isSurroundLayoutMode(v: string | null | undefined): v is SurroundLayoutMode {
    return v === 'packed' || v === 'spread' || v === 'sparse';
}

/** Same formats as building / ground uploads; scatter renderer supports glTF, FBX, and OBJ. */
export { MODEL_3D_INPUT_ACCEPT as SCATTER_MODEL_INPUT_ACCEPT } from './model3dFormats';

export function isAcceptedScatterExtension(ext: string): boolean {
    return isAcceptedModel3dExtension(ext);
}

/** Row from REST with embedded legacy skybox and/or sky collection + slots */
export type WorldEnvironmentWithSky = WorldEnvironmentRow & {
    skybox_environments?: { file_url: string } | null;
    skybox_collections?: SkyboxCollectionWithSlots | null;
    world_scatter_assets?: WorldScatterAssetRow[] | null;
    /** Active global surround asset (REST alias). */
    surround_catalog?: SurroundCatalogAssetRow | null;
};

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function authBearer(getToken: () => string | undefined): Promise<string | undefined> {
    return (await getValidAccessToken()) ?? getToken();
}

const slotsEmbed = 'skybox_collection_slots(id,collection_id,label,file_url,sort_order)';

/** FK from `world_scatter_assets.world_environment_id` → list of props for this world (not the active pointer). */
const SCATTER_ASSETS_BY_WORLD_FK = 'world_scatter_assets_world_environment_id_fkey';

const SURROUND_CATALOG_ACTIVE_FK = 'world_environments_active_surround_catalog_asset_id_fkey';

/** Pre–surround-catalog DBs: omit new columns + embed so PostgREST does not 400. */
export const WORLD_ENVIRONMENT_REST_SELECT_LEGACY = `id,created_at,label,ground_model_url,skybox_environment_id,skybox_collection_id,ground_placement_pad,active_surround_scatter_asset_id,skybox_environments(file_url),skybox_collections(id,label,${slotsEmbed}),world_scatter_assets!${SCATTER_ASSETS_BY_WORLD_FK}(id,created_at,world_environment_id,label,file_url,kind)`;

/** REST `select=` fragment for `world_environments` (also embedded under `buildings`) after migration `20260418120000_surround_catalog_assets`. */
export const WORLD_ENVIRONMENT_REST_SELECT = `id,created_at,label,ground_model_url,skybox_environment_id,skybox_collection_id,ground_placement_pad,active_surround_scatter_asset_id,active_surround_catalog_asset_id,surround_layout_mode,skybox_environments(file_url),skybox_collections(id,label,${slotsEmbed}),world_scatter_assets!${SCATTER_ASSETS_BY_WORLD_FK}(id,created_at,world_environment_id,label,file_url,kind),surround_catalog:surround_catalog_assets!${SURROUND_CATALOG_ACTIVE_FK}(id,created_at,label,file_url)`;

let worldEnvironmentRestSelectResolved: string | null = null;

/**
 * Picks full vs legacy `select=` once per page load. If the surround-catalog migration is not applied yet,
 * PostgREST rejects the full projection; we fall back so existing worlds still load.
 */
export async function getWorldEnvironmentRestSelect(
    getToken: () => string | undefined
): Promise<string> {
    if (worldEnvironmentRestSelectResolved) return worldEnvironmentRestSelectResolved;
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key) {
        worldEnvironmentRestSelectResolved = WORLD_ENVIRONMENT_REST_SELECT_LEGACY;
        return worldEnvironmentRestSelectResolved;
    }
    const res = await fetch(
        `${url}/rest/v1/world_environments?select=${encodeURIComponent(WORLD_ENVIRONMENT_REST_SELECT)}&limit=1`,
        {
            headers: {
                apikey: key,
                ...(token && { Authorization: `Bearer ${token}` }),
                Accept: 'application/json',
            },
        }
    );
    worldEnvironmentRestSelectResolved = res.ok ? WORLD_ENVIRONMENT_REST_SELECT : WORLD_ENVIRONMENT_REST_SELECT_LEGACY;
    return worldEnvironmentRestSelectResolved;
}

/** After applying DB migrations in a long-lived tab, call so the client re-probes for the full projection. */
export function resetWorldEnvironmentRestSelectCache() {
    worldEnvironmentRestSelectResolved = null;
}

export function normalizeWorldEnvironmentRow(row: WorldEnvironmentWithSky): WorldEnvironmentWithSky {
    const ext = row as Record<string, unknown>;
    const hintedKey = `world_scatter_assets!${SCATTER_ASSETS_BY_WORLD_FK}`;
    const raw = row.world_scatter_assets ?? ext[hintedKey];
    const list = Array.isArray(raw) ? raw : raw ? [raw as WorldScatterAssetRow] : [];
    const catHint = `surround_catalog:surround_catalog_assets!${SURROUND_CATALOG_ACTIVE_FK}`;
    const catRaw = row.surround_catalog ?? ext[catHint];
    const surround_catalog =
        catRaw && typeof catRaw === 'object' && !Array.isArray(catRaw)
            ? (catRaw as SurroundCatalogAssetRow)
            : null;
    const out: WorldEnvironmentWithSky = { ...row, world_scatter_assets: list, surround_catalog };
    delete (out as Record<string, unknown>)[hintedKey];
    delete (out as Record<string, unknown>)[catHint];
    return out;
}

export async function fetchWorldEnvironments(getToken: () => string | undefined): Promise<WorldEnvironmentWithSky[]> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key) return [];
    const sel = await getWorldEnvironmentRestSelect(getToken);
    const res = await fetch(
        `${url}/rest/v1/world_environments?select=${encodeURIComponent(sel)}&order=created_at.desc`,
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
    const arr = Array.isArray(data) ? data : [];
    return arr.map((r: WorldEnvironmentWithSky) => normalizeWorldEnvironmentRow(r));
}

export async function fetchWorldEnvironmentById(
    id: string,
    getToken: () => string | undefined
): Promise<WorldEnvironmentWithSky | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key) return null;
    const sel = await getWorldEnvironmentRestSelect(getToken);
    const res = await fetch(
        `${url}/rest/v1/world_environments?id=eq.${id}&select=${encodeURIComponent(sel)}`,
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
    const row = Array.isArray(data) && data[0] ? data[0] : null;
    return row ? normalizeWorldEnvironmentRow(row as WorldEnvironmentWithSky) : null;
}

export async function createWorldEnvironment(
    payload: { label: string; ground_model_url: string; skybox_collection_id: string | null },
    getToken: () => string | undefined
): Promise<WorldEnvironmentWithSky | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return null;
    const sel = await getWorldEnvironmentRestSelect(getToken);
    const res = await fetch(`${url}/rest/v1/world_environments?select=${encodeURIComponent(sel)}`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({
            label: payload.label.trim() || 'Environment',
            ground_model_url: payload.ground_model_url,
            skybox_collection_id: payload.skybox_collection_id,
            skybox_environment_id: null,
        }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return row ? normalizeWorldEnvironmentRow(row as WorldEnvironmentWithSky) : null;
}

export async function patchWorldEnvironmentLabel(
    id: string,
    label: string,
    getToken: () => string | undefined
): Promise<WorldEnvironmentWithSky | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return null;
    const trimmed = label.trim() || 'Environment';
    const sel = await getWorldEnvironmentRestSelect(getToken);
    const res = await fetch(
        `${url}/rest/v1/world_environments?id=eq.${id}&select=${encodeURIComponent(sel)}`,
        {
            method: 'PATCH',
            headers: {
                apikey: key,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
            },
            body: JSON.stringify({ label: trimmed }),
        }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return row ? normalizeWorldEnvironmentRow(row as WorldEnvironmentWithSky) : null;
}

/** Attach or clear HDR sky collection on a world (clears legacy single skybox row when attaching). */
export async function patchWorldEnvironmentSkyCollection(
    id: string,
    skybox_collection_id: string | null,
    getToken: () => string | undefined
): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return false;
    const body =
        skybox_collection_id == null
            ? { skybox_collection_id: null, skybox_environment_id: null }
            : { skybox_collection_id, skybox_environment_id: null };
    const res = await fetch(`${url}/rest/v1/world_environments?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(body),
    });
    return res.ok;
}

export async function patchWorldEnvironmentGroundPad(
    id: string,
    pad: GroundPlacementPad | null,
    getToken: () => string | undefined
): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return false;
    const body =
        pad == null
            ? { ground_placement_pad: null }
            : {
                  ground_placement_pad: {
                      center: pad.center,
                      halfExtents: pad.halfExtents,
                      ...(pad.padDisplayMode ? { padDisplayMode: pad.padDisplayMode } : {}),
                      ...(pad.buildingYaw != null && Number.isFinite(pad.buildingYaw)
                          ? { buildingYaw: pad.buildingYaw }
                          : {}),
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
                  },
              };
    const res = await fetch(`${url}/rest/v1/world_environments?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(body),
    });
    return res.ok;
}

export async function deleteWorldEnvironment(id: string, getToken: () => string | undefined): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/world_environments?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
        },
    });
    return res.ok;
}

export type GroundModelUploadResult =
    | { ok: true; url: string }
    | { ok: false; message: string };

async function storageUploadErrorMessage(res: Response): Promise<string> {
    const prefix = `Storage upload failed (HTTP ${res.status})`;
    let raw = '';
    try {
        raw = await res.text();
    } catch {
        return prefix;
    }
    const trimmed = raw.trim();
    if (!trimmed) return prefix;
    try {
        const j = JSON.parse(trimmed) as {
            message?: string;
            error?: string;
            code?: string;
        };
        const msg = j.message ?? (typeof j.error === 'string' ? j.error : undefined);
        if (j.code && msg) return `${prefix}: ${j.code} — ${msg}`;
        if (msg) return `${prefix}: ${msg}`;
        if (j.code) return `${prefix}: ${j.code}`;
    } catch {
        /* not JSON */
    }
    return `${prefix}: ${trimmed.slice(0, 400)}`;
}

export async function uploadGroundModelFile(
    file: File,
    getToken: () => string | undefined
): Promise<GroundModelUploadResult> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) {
        return { ok: false, message: 'Missing Supabase configuration or you are not signed in.' };
    }
    const safeName = file.name.replace(/\s+/g, '_');
    const ext = extensionFromFileName(safeName);
    if (!isAcceptedModel3dExtension(ext)) {
        return { ok: false, message: 'Unsupported ground model format.' };
    }
    const lastDot = safeName.lastIndexOf('.');
    const stem = (lastDot >= 0 ? safeName.slice(0, lastDot) : safeName).slice(0, 80);
    const path = `env_ground_${Date.now()}_${stem}.${ext}`;

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
    if (!uploadRes.ok) {
        return { ok: false, message: await storageUploadErrorMessage(uploadRes) };
    }
    return { ok: true, url: `${url}/storage/v1/object/public/models/${path}` };
}

export async function uploadScatterAssetFile(
    file: File,
    getToken: () => string | undefined
): Promise<string | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return null;
    const safeName = file.name.replace(/\s+/g, '_');
    const ext = extensionFromFileName(safeName);
    if (!isAcceptedModel3dExtension(ext)) return null;
    const lastDot = safeName.lastIndexOf('.');
    const stem = (lastDot >= 0 ? safeName.slice(0, lastDot) : safeName).slice(0, 80);
    const path = `env_scatter_${Date.now()}_${stem}.${ext}`;

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

export async function createWorldScatterAsset(
    worldEnvironmentId: string,
    payload: { label: string; file_url: string; kind: ScatterSurroundKind },
    getToken: () => string | undefined
): Promise<WorldScatterAssetRow | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return null;
    const res = await fetch(`${url}/rest/v1/world_scatter_assets?select=*`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({
            world_environment_id: worldEnvironmentId,
            label: payload.label.trim() || 'Scatter',
            file_url: payload.file_url,
            kind: payload.kind,
        }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function deleteWorldScatterAsset(id: string, getToken: () => string | undefined): Promise<boolean> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return false;
    const res = await fetch(`${url}/rest/v1/world_scatter_assets?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
        },
    });
    return res.ok;
}

/** Sets global-catalog surround selection; both `catalogAssetId` and `layoutMode` must be non-null for the engine to render props. */
export async function patchWorldEnvironmentSurroundSelection(
    worldEnvironmentId: string,
    payload: { catalogAssetId: string | null; layoutMode: SurroundLayoutMode | null },
    getToken: () => string | undefined
): Promise<WorldEnvironmentWithSky | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return null;
    const body: Record<string, unknown> = {
        active_surround_catalog_asset_id: payload.catalogAssetId,
        surround_layout_mode: payload.layoutMode,
    };
    if (payload.catalogAssetId != null) {
        body.active_surround_scatter_asset_id = null;
    }
    const sel = await getWorldEnvironmentRestSelect(getToken);
    const res = await fetch(
        `${url}/rest/v1/world_environments?id=eq.${worldEnvironmentId}&select=${encodeURIComponent(sel)}`,
        {
            method: 'PATCH',
            headers: {
                apikey: key,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
            },
            body: JSON.stringify(body),
        }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return row ? normalizeWorldEnvironmentRow(row as WorldEnvironmentWithSky) : null;
}

export async function patchWorldEnvironmentActiveScatterAsset(
    worldEnvironmentId: string,
    scatterAssetId: string | null,
    getToken: () => string | undefined
): Promise<WorldEnvironmentWithSky | null> {
    const url = supabaseUrl();
    const key = supabaseKey();
    const token = await authBearer(getToken);
    if (!url || !key || !token) return null;
    const sel = await getWorldEnvironmentRestSelect(getToken);
    const res = await fetch(
        `${url}/rest/v1/world_environments?id=eq.${worldEnvironmentId}&select=${encodeURIComponent(sel)}`,
        {
            method: 'PATCH',
            headers: {
                apikey: key,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
            },
            body: JSON.stringify({
                active_surround_scatter_asset_id: scatterAssetId,
                ...(scatterAssetId
                    ? { active_surround_catalog_asset_id: null, surround_layout_mode: null }
                    : {}),
            }),
        }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return row ? normalizeWorldEnvironmentRow(row as WorldEnvironmentWithSky) : null;
}
