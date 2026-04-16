import * as THREE from 'three';

/** Same strip factor as `WorldGroundSurround`: pad around imported ground AABB. */
const STRIP_FACTOR = 1.5;

/**
 * Y offset from imported ground `box.min.y` to the procedural base slab top.
 * Must match `WorldGroundSurround` mesh `position.y` (`groundMinY +` this value).
 */
export const PROCEDURAL_BASE_TOP_OFFSET = -0.028;

/** Tiny lift above slab top to reduce z-fighting with the base plane. */
const SLAB_SURFACE_EPS = 0.002;

export function proceduralSlabTopY(groundMinY: number): number {
    return groundMinY + PROCEDURAL_BASE_TOP_OFFSET;
}

export type GroundSurroundLayout = {
    cx: number;
    cz: number;
    innerHx: number;
    innerHz: number;
    outerHx: number;
    outerHz: number;
    groundMinY: number;
    /** Y for props sitting on the slab / terrain (above procedural base). */
    scatterSurfaceY: number;
};

/**
 * Shared layout for procedural base + scatter: inner = ground half-extents,
 * outer = inner + strip where `strip = max(groundW, groundD) * STRIP_FACTOR`.
 */
export function computeGroundSurroundLayout(root: THREE.Object3D): GroundSurroundLayout | null {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return null;
    const size = new THREE.Vector3();
    box.getSize(size);
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const innerHx = Math.max(size.x * 0.5, 0.05);
    const innerHz = Math.max(size.z * 0.5, 0.05);
    const strip = Math.max(size.x, size.z) * STRIP_FACTOR;
    const outerHx = innerHx + strip;
    const outerHz = innerHz + strip;
    const groundMinY = box.min.y;
    const scatterSurfaceY = proceduralSlabTopY(groundMinY) + SLAB_SURFACE_EPS;
    return { cx, cz, innerHx, innerHz, outerHx, outerHz, groundMinY, scatterSurfaceY };
}
