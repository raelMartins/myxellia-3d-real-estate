import * as THREE from 'three';

export type BoundsXZ = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * Axis-aligned XZ bounds of all mesh geometry under `root`, expressed in `ancestor`'s local space.
 * Matches the coordinate frame used for unit positions that are direct children of `ancestor`.
 */
export function meshAabbXZInAncestorSpace(root: THREE.Object3D, ancestor: THREE.Object3D): BoundsXZ | null {
    ancestor.updateWorldMatrix(true, true);
    root.updateWorldMatrix(true, true);
    const invAncestor = new THREE.Matrix4().copy(ancestor.matrixWorld).invert();
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    let any = false;
    root.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.geometry) return;
        child.updateWorldMatrix(true, false);
        const pos = child.geometry.attributes.position;
        if (!pos) return;
        const mw = child.matrixWorld;
        for (let i = 0; i < pos.count; i++) {
            v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mw).applyMatrix4(invAncestor);
            box.expandByPoint(v);
            any = true;
        }
    });
    if (!any || !Number.isFinite(box.min.x)) return null;
    return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
}
