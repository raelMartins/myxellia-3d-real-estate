import type { SectionPlan } from './database.types';
import type { NewUnitSlot } from '@/lib/sectionPlanSlots';

export type ModelBoundsXZ = { minX: number; maxX: number; minZ: number; maxZ: number };

export type FootprintExtents = {
    centerX: number;
    centerZ: number;
    extentX: number;
    extentZ: number;
    footprintUv: [number, number][];
};

/** Ordered footprint vertices in world XZ (same mapping as extents). */
export function footprintWorldPolygonOnPlan(
    footprint: [number, number][],
    plan: SectionPlan,
    modelBounds?: ModelBoundsXZ | null
): [number, number][] {
    const { baseWidth, baseDepth } = plan;
    if (modelBounds) {
        return footprint.map(
            ([u, v]) =>
                [
                    modelBounds.minX + u * (modelBounds.maxX - modelBounds.minX),
                    modelBounds.minZ + (1 - v) * (modelBounds.maxZ - modelBounds.minZ),
                ] as [number, number]
        );
    }
    return footprint.map(([x, z]) => [x * baseWidth, z * baseDepth] as [number, number]);
}

/** Map section footprint (plan UV) to world XZ extents used by the engine / preview. */
export function footprintWorldExtentsOnPlan(
    footprint: [number, number][],
    plan: SectionPlan,
    modelBounds?: ModelBoundsXZ | null
): FootprintExtents {
    const { baseWidth, baseDepth } = plan;
    const worldPts: [number, number][] = modelBounds
        ? footprint.map(([u, v]) => [
              modelBounds.minX + u * (modelBounds.maxX - modelBounds.minX),
              modelBounds.minZ + (1 - v) * (modelBounds.maxZ - modelBounds.minZ),
          ] as [number, number])
        : footprint.map(([x, z]) => [x * baseWidth, z * baseDepth] as [number, number]);

    let minX = worldPts[0][0],
        maxX = worldPts[0][0],
        minZ = worldPts[0][1],
        maxZ = worldPts[0][1];
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
    const rawFootprint = worldPts.map(([x, z]) => [(x - minX) / extentX, (z - minZ) / extentZ] as [number, number]);
    const footprintUv = modelBounds ? rawFootprint.map(([u, v]) => [u, 1 - v] as [number, number]) : rawFootprint;

    return { centerX, centerZ, extentX, extentZ, footprintUv };
}

export function slotYExtent(slot: NewUnitSlot): { yLo: number; yHi: number; height: number; yCenter: number } {
    const yLo = Math.min(slot.yStart, slot.yEnd);
    const yHi = Math.max(slot.yStart, slot.yEnd);
    const height = Math.max(0.05, yHi - yLo);
    const yCenter = (yLo + yHi) / 2;
    return { yLo, yHi, height, yCenter };
}

/** Compute position [x,y,z], size [w,h,d], and normalized footprint for a unit from a slot and plan.
 * When modelBounds is provided, plan (0–1) maps to model XZ. Vertical extent comes from yStart/yEnd. */
export function slotToUnitGeometry(
    slot: NewUnitSlot,
    plan: SectionPlan,
    modelBounds?: ModelBoundsXZ | null
): { position: [number, number, number]; size: [number, number, number]; footprint: [number, number][] } {
    const { centerX, centerZ, extentX, extentZ, footprintUv } = footprintWorldExtentsOnPlan(slot.footprint, plan, modelBounds);
    const { yCenter, height } = slotYExtent(slot);
    return {
        position: [centerX, yCenter, centerZ],
        size: [extentX, height, extentZ],
        footprint: footprintUv,
    };
}
