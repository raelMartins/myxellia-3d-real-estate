import type { SectionPlan } from '../lib/database.types';
import type { NewUnitSlot } from '../components/SectionFloorsConfig';

/** Compute position [x,y,z], size [w,h,d], and normalized footprint for a unit from a slot and plan. */
export function slotToUnitGeometry(
    slot: NewUnitSlot,
    plan: SectionPlan
): { position: [number, number, number]; size: [number, number, number]; footprint: [number, number][] } {
    const { baseWidth, baseDepth } = plan;
    const worldPts = slot.footprint.map(([x, z]) => [x * baseWidth, z * baseDepth] as [number, number]);
    let minX = worldPts[0][0], maxX = worldPts[0][0], minZ = worldPts[0][1], maxZ = worldPts[0][1];
    worldPts.forEach(([x, z]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    });
    const extentX = maxX - minX || 1;
    const extentZ = maxZ - minZ || 1;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const yCenter = slot.yPosition + slot.floorHeight / 2;
    const position: [number, number, number] = [centerX, yCenter, centerZ];
    const size: [number, number, number] = [extentX, slot.floorHeight, extentZ];
    const footprint = worldPts.map(([x, z]) => [(x - minX) / extentX, (z - minZ) / extentZ] as [number, number]);
    return { position, size, footprint };
}
