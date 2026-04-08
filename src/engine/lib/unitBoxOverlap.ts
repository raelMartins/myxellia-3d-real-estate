/** Parse unit position from store row (same logic as BuildingModel). */
export function parseUnitPosition(u: { position?: unknown; floor?: number }): [number, number, number] {
    const p = (u as { position?: unknown }).position;
    if (Array.isArray(p) && p.length >= 3) return [Number(p[0]), Number(p[1]), Number(p[2])];
    const floor = (u as { floor?: number }).floor ?? 1;
    return [0, floor * 3, 0];
}

/** Parse unit size from store row (same logic as BuildingModel). */
export function parseUnitSize(u: { size?: unknown }): [number, number, number] {
    const s = (u as { size?: unknown }).size;
    if (Array.isArray(s) && s.length >= 3) return [Number(s[0]), Number(s[1]), Number(s[2])];
    return [3, 2, 3];
}

/** True if two axis-aligned boxes (center + full size) overlap. */
export function boxesOverlap(
    centerA: [number, number, number],
    sizeA: [number, number, number],
    centerB: [number, number, number],
    sizeB: [number, number, number],
): boolean {
    const ax = centerA[0], ay = centerA[1], az = centerA[2];
    const aw = sizeA[0] / 2, ah = sizeA[1] / 2, ad = sizeA[2] / 2;
    const bx = centerB[0], by = centerB[1], bz = centerB[2];
    const bw = sizeB[0] / 2, bh = sizeB[1] / 2, bd = sizeB[2] / 2;
    if (ax + aw <= bx - bw || bx + bw <= ax - aw) return false;
    if (ay + ah <= by - bh || by + bh <= ay - ah) return false;
    if (az + ad <= bz - bd || bz + bd <= az - ad) return false;
    return true;
}
