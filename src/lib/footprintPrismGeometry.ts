import * as THREE from 'three';

/** Extruded footprint in XZ, centered (matches engine UnitPrism construction). */
export function createFootprintPrismGeometry(
    footprintUv: [number, number][],
    width: number,
    height: number,
    depth: number
): THREE.BufferGeometry {
    if (footprintUv.length < 3) {
        return new THREE.BoxGeometry(width, height, depth);
    }
    const shape = new THREE.Shape();
    const scaleX = width;
    const scaleZ = depth;
    shape.moveTo(footprintUv[0][0] * scaleX, footprintUv[0][1] * scaleZ);
    for (let i = 1; i < footprintUv.length; i++) {
        shape.lineTo(footprintUv[i][0] * scaleX, footprintUv[i][1] * scaleZ);
    }
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, height / 2, 0);
    geom.computeBoundingBox();
    const center = new THREE.Vector3();
    geom.boundingBox!.getCenter(center);
    geom.translate(-center.x, -center.y, -center.z);
    return geom;
}
