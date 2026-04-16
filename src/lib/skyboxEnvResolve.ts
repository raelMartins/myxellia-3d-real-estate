import type { WorldEnvironmentWithSky } from '@/lib/worldEnvironments';
import type { SkyboxCollectionWithSlots } from '@/lib/skyboxCollections';

export type SkyboxSlotRow = {
    id: string;
    label: string;
    file_url: string;
    sort_order: number;
};

export function orderedSlots(slots: SkyboxSlotRow[] | null | undefined): SkyboxSlotRow[] {
    if (!Array.isArray(slots)) return [];
    return [...slots].sort((a, b) => a.sort_order - b.sort_order);
}

export function pickSlotFileUrl(slots: SkyboxSlotRow[], selectedSlotId: string | null): string | null {
    if (slots.length === 0) return null;
    if (selectedSlotId) {
        const hit = slots.find((x) => x.id === selectedSlotId);
        if (hit?.file_url) return hit.file_url.trim() || null;
    }
    const first = slots[0];
    return first?.file_url?.trim() || null;
}

function collectionFromWorld(world: WorldEnvironmentWithSky | null | undefined): SkyboxCollectionWithSlots | null {
    const c = world?.skybox_collections;
    if (!c || typeof c !== 'object') return null;
    return c as SkyboxCollectionWithSlots;
}

function fallbackHdriFromEnv(): string | null {
    const u = (process.env.NEXT_PUBLIC_FALLBACK_HDRI_URL ?? '').trim();
    return u || null;
}

export type ResolveExteriorHdriInput = {
    /** Explicit no-sky from UI */
    skyNone: boolean;
    effectiveWorld: WorldEnvironmentWithSky | null;
    /** Slot within world's collection or catalog collection */
    selectedSkyboxSlotId: string | null;
    /** When world has no bundled sky, user may pick a catalog collection */
    catalogCollectionId: string | null;
    skyboxCollections: SkyboxCollectionWithSlots[];
    buildingGeneratedEnvUrl: string | null | undefined;
};

export type ResolveExteriorHdriResult = {
    url: string | null;
    /** True when URL comes from skybox_collection_slots (world or catalog) */
    fromCollectionSlots: boolean;
};

/**
 * Single precedence for exterior HDR / env image URL.
 * Does not include legacy per-row skybox_environments — caller should pass world with embeds.
 */
export function resolveExteriorHdriUrl(input: ResolveExteriorHdriInput): ResolveExteriorHdriResult {
    if (input.skyNone) {
        return { url: null, fromCollectionSlots: false };
    }

    const worldColl = collectionFromWorld(input.effectiveWorld);
    const worldSlots = orderedSlots(worldColl?.skybox_collection_slots ?? null);
    if (worldSlots.length > 0) {
        const url = pickSlotFileUrl(worldSlots, input.selectedSkyboxSlotId);
        if (url) return { url, fromCollectionSlots: true };
    }

    const legacy = input.effectiveWorld?.skybox_environments?.file_url?.trim();
    if (legacy) {
        return { url: legacy, fromCollectionSlots: false };
    }

    if (input.catalogCollectionId) {
        const cat = input.skyboxCollections.find((c) => c.id === input.catalogCollectionId);
        const catSlots = orderedSlots(cat?.skybox_collection_slots ?? null);
        if (catSlots.length > 0) {
            const url = pickSlotFileUrl(catSlots, input.selectedSkyboxSlotId);
            if (url) return { url, fromCollectionSlots: true };
        }
    }

    const gen = input.buildingGeneratedEnvUrl?.trim();
    if (gen) return { url: gen, fromCollectionSlots: false };

    const fb = fallbackHdriFromEnv();
    if (fb) return { url: fb, fromCollectionSlots: false };

    return { url: null, fromCollectionSlots: false };
}
