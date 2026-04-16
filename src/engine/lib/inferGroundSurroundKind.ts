export type GroundSurroundKind = 'sand' | 'gravel' | 'grass';

/**
 * Pick a surround surface style from building env_context and/or a sampled albedo hex.
 */
export function inferGroundSurroundKind(envContext: string | null | undefined, sampledColorHex?: string | null): GroundSurroundKind {
    const ctx = (envContext || '').toLowerCase();
    if (
        ctx.includes('beach') ||
        ctx.includes('ocean') ||
        ctx.includes('sand') ||
        ctx.includes('tropical') ||
        ctx.includes('coast') ||
        ctx.includes('desert') ||
        ctx.includes('arid') ||
        ctx.includes('dune')
    ) {
        return 'sand';
    }
    if (
        ctx.includes('forest') ||
        ctx.includes('lush') ||
        ctx.includes('jungle') ||
        ctx.includes('garden') ||
        ctx.includes('park') ||
        ctx.includes('lawn') ||
        ctx.includes('grass') ||
        ctx.includes('meadow')
    ) {
        return 'grass';
    }
    if (
        ctx.includes('mountain') ||
        ctx.includes('hillside') ||
        ctx.includes('rock') ||
        ctx.includes('alpine') ||
        ctx.includes('city') ||
        ctx.includes('urban') ||
        ctx.includes('street') ||
        ctx.includes('downtown') ||
        ctx.includes('industrial')
    ) {
        return 'gravel';
    }

    return inferKindFromHex(sampledColorHex);
}

function inferKindFromHex(hex: string | null | undefined): GroundSurroundKind {
    if (!hex || typeof hex !== 'string') return 'gravel';
    let h = hex.trim();
    if (h.startsWith('#')) h = h.slice(1);
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return 'gravel';
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min + 1e-6;
    let hue = 0;
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;

    if (hue > 0.2 && hue < 0.45 && g > r * 0.85 && g > b * 0.75) return 'grass';
    if (hue > 0.06 && hue < 0.14 && r > 0.45 && g > 0.35 && b < Math.min(r, g) * 0.92) return 'sand';
    return 'gravel';
}
