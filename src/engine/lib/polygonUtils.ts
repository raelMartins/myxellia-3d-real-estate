/** 2D point [x, y] in normalized space (e.g. -0.5..0.5) */
export type Point2 = [number, number];

/** Vertices for a regular polygon centered at (0,0) with radius 0.5, first vertex at top. */
export function regularPolygonVertices(sides: number): Point2[] {
    if (sides < 3) sides = 3;
    const radius = 0.5;
    const out: Point2[] = [];
    for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        out.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
    }
    return out;
}

/** Check if segment (a,b) intersects segment (c,d) excluding endpoints. */
export function segmentsIntersect(
    a: Point2,
    b: Point2,
    c: Point2,
    d: Point2
): boolean {
    const ccw = (p: Point2, q: Point2, r: Point2) =>
        (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const onSegment = (p: Point2, q: Point2, r: Point2) => {
        const minX = Math.min(p[0], r[0]);
        const maxX = Math.max(p[0], r[0]);
        const minY = Math.min(p[1], r[1]);
        const maxY = Math.max(p[1], r[1]);
        return q[0] >= minX && q[0] <= maxX && q[1] >= minY && q[1] <= maxY;
    };
    const o1 = ccw(a, b, c);
    const o2 = ccw(a, b, d);
    const o3 = ccw(c, d, a);
    const o4 = ccw(c, d, b);
    if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
        return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
    }
    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;
    return false;
}

/** True if two polygons have any crossing segments (excluding touching at vertices). */
export function polygonPairsIntersect(a: Point2[], b: Point2[]): boolean {
    const na = a.length;
    const nb = b.length;
    for (let i = 0; i < na; i++) {
        const pa = a[i];
        const pb = a[(i + 1) % na];
        for (let j = 0; j < nb; j++) {
            const pc = b[j];
            const pd = b[(j + 1) % nb];
            if (segmentsIntersect(pa, pb, pc, pd)) return true;
        }
    }
    return false;
}

/** True if polygon has no self-intersection (simple polygon). */
export function isSimplePolygon(vertices: Point2[]): boolean {
    const n = vertices.length;
    if (n < 3) return true;
    for (let i = 0; i < n; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        for (let j = i + 2; j < n; j++) {
            if (j === (i - 1 + n) % n) continue;
            const c = vertices[j];
            const d = vertices[(j + 1) % n];
            if (segmentsIntersect(a, b, c, d)) return false;
        }
    }
    return true;
}
