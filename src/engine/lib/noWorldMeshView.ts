import * as THREE from 'three';

/**
 * Exterior "no world mesh" studio view: flat background + constrained framing.
 * Interior mode always uses the same studio background (see MyxelliaCanvas).
 */
export const NO_WORLD_MESH_STUDIO_BACKGROUND = '#F4EBE4';

/** Vertical screen fill of the building bounding box (world Y extent). */
export const NO_WORLD_MESH_HEIGHT_FRAC = {
    /** Zoomed out — model occupies ~this fraction of viewport height */
    min: 0.6,
    default: 0.7,
    max: 0.8,
} as const;

/** Sidebar-hovered unit auto-frame: characteristic size vs viewport height (no world mesh). */
export const NO_WORLD_MESH_UNIT_SIDEBAR_HEIGHT_FRAC = {
    default: 0.56,
} as const;

/**
 * Camera–target distance so a vertical world extent of `modelHeight` fills
 * `viewportHeightFraction` of the viewport (perspective, vertical FOV).
 */
export function cameraDistanceForVerticalFill(
    modelHeight: number,
    viewportHeightFraction: number,
    verticalFovDegrees: number,
): number {
    if (!(modelHeight > 0) || !(viewportHeightFraction > 0)) return 10;
    const vFovRad = (verticalFovDegrees * Math.PI) / 180;
    const tanHalf = Math.tan(vFovRad / 2);
    if (!(tanHalf > 1e-9)) return 10;
    return modelHeight / (2 * viewportHeightFraction * tanHalf);
}

type UnitGroupLike = {
    matrixWorld: THREE.Matrix4;
    updateWorldMatrix: (updateParents: boolean, updateChildren: boolean) => void;
};

/**
 * World-space horizontal direction (XZ, unit length) from local +Z after unit Y rotation.
 * Used so the camera sits in front of the prism/box “face” in studio exterior.
 */
export function worldHorizontalFrontFromUnitGroup(
    group: UnitGroupLike,
    out: THREE.Vector3,
): THREE.Vector3 {
    group.updateWorldMatrix(true, false);
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    m.extractRotation(group.matrixWorld);
    q.setFromRotationMatrix(m);
    out.set(0, 0, 1).applyQuaternion(q);
    out.y = 0;
    if (out.lengthSq() < 1e-10) out.set(0, 0, 1);
    out.normalize();
    return out;
}

/**
 * Isometric-style view direction (from target toward camera): biased above the
 * horizontal “front” azimuth so three faces read clearly.
 */
export function noWorldMeshIsometricViewDirection(
    horizontalFront: THREE.Vector3,
    out: THREE.Vector3,
): THREE.Vector3 {
    const yLift = 0.56;
    out.set(horizontalFront.x, yLift, horizontalFront.z).normalize();
    return out;
}

const ISO_Y_LIFT = 0.56;

/**
 * Isometric-style direction (target → camera) for a hovered unit: keeps a clear
 * three-quarter read of the prism, but **biases horizontal azimuth** toward the
 * default studio camera and toward the side of the building where the unit sits,
 * so back/side units need less violent spins and stay nearer the center of attention.
 */
export function noWorldMeshIsometricUnitViewDirection(
    horizontalFront: THREE.Vector3,
    studioOffset: THREE.Vector3,
    unitCenter: THREE.Vector3,
    buildingCenter: THREE.Vector3,
    tmpStudioH: THREE.Vector3,
    tmpRadialH: THREE.Vector3,
    out: THREE.Vector3,
): THREE.Vector3 {
    tmpStudioH.copy(studioOffset);
    tmpStudioH.y = 0;
    if (tmpStudioH.lengthSq() < 1e-10) tmpStudioH.set(0, 0, 1);
    tmpStudioH.normalize();

    tmpRadialH.copy(unitCenter).sub(buildingCenter);
    tmpRadialH.y = 0;
    if (tmpRadialH.lengthSq() < 1e-10) tmpRadialH.copy(horizontalFront);
    else tmpRadialH.normalize();

    /** Prefer the studio hemisphere that actually faces the unit’s +Z facade. */
    if (tmpStudioH.dot(horizontalFront) < 0) tmpStudioH.negate();

    out
        .copy(horizontalFront)
        .multiplyScalar(0.38)
        .addScaledVector(tmpStudioH, 0.38)
        .addScaledVector(tmpRadialH, 0.24);
    out.y = 0;
    if (out.lengthSq() < 1e-10) out.copy(horizontalFront);
    out.normalize();

    if (out.dot(horizontalFront) < 0.14) {
        out.copy(horizontalFront).multiplyScalar(0.62).addScaledVector(tmpStudioH, 0.38);
        out.y = 0;
        if (out.lengthSq() < 1e-10) out.copy(horizontalFront);
        out.normalize();
    }

    out.set(out.x, ISO_Y_LIFT, out.z).normalize();
    return out;
}
