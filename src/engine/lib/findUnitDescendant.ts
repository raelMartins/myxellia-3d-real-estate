import * as THREE from 'three';

/** DFS for a group/mesh tagged with `userData.unitId` (see UnitPrism / UnitBox). */
export function findDescendantWithUnitId(root: THREE.Object3D, unitId: string): THREE.Object3D | null {
    const ud = root.userData as { unitId?: string };
    if (ud.unitId === unitId) return root;
    for (let i = 0; i < root.children.length; i++) {
        const hit = findDescendantWithUnitId(root.children[i]!, unitId);
        if (hit) return hit;
    }
    return null;
}
