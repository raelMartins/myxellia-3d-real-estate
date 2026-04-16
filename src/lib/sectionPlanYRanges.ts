const EPS = 1e-4;
const DEFAULT_MIN_H = 0.05;

function norm([u, v]: [number, number]): [number, number] {
    return [Math.min(u, v), Math.max(u, v)];
}

/** Interior overlap on Y; touching (shared endpoint) is not overlap. */
export function yIntervalsOverlapInterior(a: [number, number], b: [number, number]): boolean {
    const [a0, a1] = norm(a);
    const [b0, b1] = norm(b);
    return a1 > b0 + EPS && b1 > a0 + EPS;
}

/** If y lies strictly inside any interval, snap to the nearer boundary of that interval. */
export function snapYOutsideIntervals(y: number, intervals: [number, number][]): number {
    let t = y;
    for (const iv of intervals) {
        const [a, b] = norm(iv);
        if (t > a + EPS && t < b - EPS) {
            t = t - a < b - t ? a : b;
        }
    }
    return t;
}

/**
 * Clamp [rawLo, rawHi] so interiors do not overlap any obstacle; touching allowed.
 */
export function clampVerticalSpan(
    rawLo: number,
    rawHi: number,
    obstacles: [number, number][],
    minHeight: number = DEFAULT_MIN_H
): [number, number] {
    let lo = Math.min(rawLo, rawHi);
    let hi = Math.max(rawLo, rawHi);
    if (hi - lo < minHeight) hi = lo + minHeight;
    const obs = obstacles.map(norm);

    for (let iter = 0; iter < 48; iter++) {
        let changed = false;
        for (const [a, b] of obs) {
            if (hi <= a + EPS || lo >= b - EPS) continue;
            const overlapLo = Math.max(lo, a);
            const overlapHi = Math.min(hi, b);
            if (overlapHi - overlapLo <= EPS) continue;
            const shrinkHi = hi - Math.max(lo, a);
            const shrinkLo = Math.min(hi, b) - lo;
            if (shrinkHi <= shrinkLo) {
                const newHi = Math.max(lo + minHeight, a);
                if (newHi < hi - EPS) {
                    hi = newHi;
                    changed = true;
                }
            } else {
                const newLo = Math.min(hi - minHeight, b);
                if (newLo > lo + EPS) {
                    lo = newLo;
                    changed = true;
                }
            }
        }
        if (!changed) break;
        if (hi - lo < minHeight) hi = lo + minHeight;
    }
    if (hi - lo < minHeight) hi = lo + minHeight;
    return [lo, hi];
}
