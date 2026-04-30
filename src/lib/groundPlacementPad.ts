export type PadDisplayMode = 'flat' | 'followTerrain';

/** Which world axis the studio (no-ground) exterior camera sits on, facing the building center. */
export type StudioExteriorFront = 'auto' | '+x' | '-x' | '+z' | '-z';

export function isStudioExteriorFront(v: unknown): v is StudioExteriorFront {
    return v === 'auto' || v === '+x' || v === '-x' || v === '+z' || v === '-z';
}

/** Reads `studioExteriorFront` from a `ground_placement_pad` JSON blob (with or without a full pad). */
export function parseStudioExteriorFront(raw: unknown): StudioExteriorFront | undefined {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const v = (raw as Record<string, unknown>).studioExteriorFront;
    return isStudioExteriorFront(v) ? v : undefined;
}

/** Horizontal model bounds (same space as `setModelBoundsXZ` in the engine). */
export type ModelBoundsXZ = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * Dropdown labels: length = long footprint edge, width = short edge (camera sits on the perpendicular axis).
 */
export function studioExteriorFrontSelectOptions(
    bounds: ModelBoundsXZ | null | undefined,
): { value: StudioExteriorFront; label: string }[] {
    const auto = { value: 'auto' as const, label: 'Auto (longest side)' };
    if (!bounds) {
        return [
            auto,
            { value: '+z', label: 'Length A (+Z)' },
            { value: '-z', label: 'Length B (−Z)' },
            { value: '+x', label: 'Width A (+X)' },
            { value: '-x', label: 'Width B (−X)' },
        ];
    }
    const spanX = Math.max(1e-9, bounds.maxX - bounds.minX);
    const spanZ = Math.max(1e-9, bounds.maxZ - bounds.minZ);
    const lengthAlongX = spanX >= spanZ;
    if (lengthAlongX) {
        return [
            auto,
            { value: '+z', label: 'Length A' },
            { value: '-z', label: 'Length B' },
            { value: '+x', label: 'Width A' },
            { value: '-x', label: 'Width B' },
        ];
    }
    return [
        auto,
        { value: '+x', label: 'Length A' },
        { value: '-x', label: 'Length B' },
        { value: '+z', label: 'Width A' },
        { value: '-z', label: 'Width B' },
    ];
}

export type GroundPlacementPad = {
    center: [number, number];
    halfExtents: [number, number];
    padDisplayMode?: PadDisplayMode;
    /**
     * Extra Y rotation (radians) after auto lengthwise alignment (0 or π/2).
     * Persisted so you can fine-tune orientation on the pad.
     */
    buildingYaw?: number;
    /**
     * World-space meters: shifts the fitted building up (+) or down (−) after base alignment.
     * Use to sink slightly into terrain or float above it without rescaling the pad.
     */
    buildingVerticalOffsetM?: number;
    /**
     * Lifts the gold placement pad (and its edit plane) along world Y relative to sampled terrain height.
     * Shift + Arrow Up/Down while editing adjusts this value.
     */
    padVerticalOffsetM?: number;
    /** Persisted on `ground_placement_pad` JSON for studio exterior; not required for pad geometry. */
    studioExteriorFront?: StudioExteriorFront;
};

const DEFAULT_HALF: [number, number] = [1, 1];

/** Minimum pad half-extent when resizing (meters). */
export const MIN_PAD_HALF_EXTENT_M = 0.28;

/** Reject stored pads with non-positive half-extents (noise / bad data). */
const MIN_POSITIVE_HALF_EXTENT_M = 1e-6;

export const BUILDING_VERTICAL_OFFSET_MIN_M = -12;
export const BUILDING_VERTICAL_OFFSET_MAX_M = 12;

export function clampBuildingVerticalOffsetM(m: number): number {
    if (!Number.isFinite(m)) return 0;
    return Math.min(BUILDING_VERTICAL_OFFSET_MAX_M, Math.max(BUILDING_VERTICAL_OFFSET_MIN_M, m));
}

export const PAD_VERTICAL_OFFSET_MIN_M = -15;
export const PAD_VERTICAL_OFFSET_MAX_M = 15;

export function clampPadVerticalOffsetM(m: number): number {
    if (!Number.isFinite(m)) return 0;
    return Math.min(PAD_VERTICAL_OFFSET_MAX_M, Math.max(PAD_VERTICAL_OFFSET_MIN_M, m));
}

/** Center + half-extents from imported ground XZ bounds (used when starting a new pad). */
export function defaultPlacementPadFromGroundXZBounds(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
): GroundPlacementPad {
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const spanX = Math.max(1e-6, maxX - minX);
    const spanZ = Math.max(1e-6, maxZ - minZ);
    const hx = Math.min(22, Math.max(MIN_PAD_HALF_EXTENT_M, spanX * 0.18));
    const hz = Math.min(22, Math.max(MIN_PAD_HALF_EXTENT_M, spanZ * 0.18));
    return {
        center: [cx, cz],
        halfExtents: [hx, hz],
        padDisplayMode: 'flat',
    };
}

export function parseGroundPlacementPad(raw: unknown): GroundPlacementPad | null {
    if (raw == null || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const c = o.center;
    const h = o.halfExtents;
    if (!Array.isArray(c) || c.length < 2 || !Array.isArray(h) || h.length < 2) return null;
    const cx = Number(c[0]);
    const cz = Number(c[1]);
    const hx = Number(h[0]);
    const hz = Number(h[1]);
    if (![cx, cz, hx, hz].every((n) => Number.isFinite(n))) return null;
    if (hx < MIN_POSITIVE_HALF_EXTENT_M || hz < MIN_POSITIVE_HALF_EXTENT_M) return null;
    const mode = o.padDisplayMode;
    const padDisplayMode: PadDisplayMode | undefined =
        mode === 'flat' || mode === 'followTerrain' ? mode : undefined;
    const by = o.buildingYaw;
    const buildingYaw =
        typeof by === 'number' && Number.isFinite(by)
            ? ((((by + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
            : undefined;
    const bvo = o.buildingVerticalOffsetM;
    const buildingVerticalOffsetM =
        typeof bvo === 'number' && Number.isFinite(bvo) ? clampBuildingVerticalOffsetM(bvo) : undefined;
    const pvo = o.padVerticalOffsetM;
    const padVerticalOffsetM =
        typeof pvo === 'number' && Number.isFinite(pvo) ? clampPadVerticalOffsetM(pvo) : undefined;
    return {
        center: [cx, cz],
        halfExtents: [hx, hz],
        ...(padDisplayMode ? { padDisplayMode } : {}),
        ...(buildingYaw !== undefined ? { buildingYaw } : {}),
        ...(buildingVerticalOffsetM !== undefined && Math.abs(buildingVerticalOffsetM) > 1e-9
            ? { buildingVerticalOffsetM }
            : {}),
        ...(padVerticalOffsetM !== undefined && Math.abs(padVerticalOffsetM) > 1e-9 ? { padVerticalOffsetM } : {}),
    };
}

export function defaultGroundPlacementPad(): GroundPlacementPad {
    return {
        center: [0, 0],
        halfExtents: [...DEFAULT_HALF],
        padDisplayMode: 'flat',
    };
}
