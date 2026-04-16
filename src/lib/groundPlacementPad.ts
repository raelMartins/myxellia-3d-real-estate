export type PadDisplayMode = 'flat' | 'followTerrain';

export type GroundPlacementPad = {
    center: [number, number];
    halfExtents: [number, number];
    padDisplayMode?: PadDisplayMode;
    /**
     * Extra Y rotation (radians) after auto lengthwise alignment (0 or π/2).
     * Persisted so you can fine-tune orientation on the pad.
     */
    buildingYaw?: number;
};

const MIN_HALF = 0.5;
const DEFAULT_HALF: [number, number] = [1, 1];

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
    if (hx < MIN_HALF || hz < MIN_HALF) return null;
    const mode = o.padDisplayMode;
    const padDisplayMode: PadDisplayMode | undefined =
        mode === 'flat' || mode === 'followTerrain' ? mode : undefined;
    const by = o.buildingYaw;
    const buildingYaw =
        typeof by === 'number' && Number.isFinite(by)
            ? ((((by + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
            : undefined;
    return {
        center: [cx, cz],
        halfExtents: [Math.max(MIN_HALF, hx), Math.max(MIN_HALF, hz)],
        ...(padDisplayMode ? { padDisplayMode } : {}),
        ...(buildingYaw !== undefined ? { buildingYaw } : {}),
    };
}

export function defaultGroundPlacementPad(): GroundPlacementPad {
    return {
        center: [0, 0],
        halfExtents: [...DEFAULT_HALF],
        padDisplayMode: 'flat',
    };
}
