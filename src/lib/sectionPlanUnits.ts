import type { SectionPlan } from '../lib/database.types';
import type { NewUnitSlot } from '../components/SectionFloorsConfig';

export type ModelBoundsXZ = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Compute position [x,y,z], size [w,h,d], and normalized footprint for a unit from a slot and plan.
 * When modelBounds is provided, plan (0–1) maps to model XZ so units sit on the plan relative to the model and stack from base; only height is added. */
export function slotToUnitGeometry(
    slot: NewUnitSlot,
    plan: SectionPlan,
    modelBounds?: ModelBoundsXZ | null
): { position: [number, number, number]; size: [number, number, number]; footprint: [number, number][] } {
    const { baseWidth, baseDepth } = plan;
    const worldPts: [number, number][] = modelBounds
        ? slot.footprint.map(([u, v]) => [
            modelBounds.minX + u * (modelBounds.maxX - modelBounds.minX),
            modelBounds.minZ + (1 - v) * (modelBounds.maxZ - modelBounds.minZ),
        ] as [number, number])
        : slot.footprint.map(([x, z]) => [x * baseWidth, z * baseDepth] as [number, number]);

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
    const rawFootprint = worldPts.map(([x, z]) => [(x - minX) / extentX, (z - minZ) / extentZ] as [number, number]);
    const footprint = modelBounds
        ? rawFootprint.map(([u, v]) => [u, 1 - v] as [number, number])
        : rawFootprint;
    return { position, size, footprint };
}
