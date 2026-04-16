import type { SectionPlanSection } from '@/lib/database.types';

/**
 * One proposed unit from the building-plan wizard before persistence.
 * Vertical placement is defined by {@link yStart} / {@link yEnd} in model Y space (same frame as engine `units.position[1]`).
 * {@link floorAnnotation} maps to DB `units.floor` for listings only; it does not drive geometry.
 */
export type NewUnitSlot = {
    sectionId: string;
    sectionLabel: string;
    footprint: SectionPlanSection['footprint'];
    /** Model-space Y (lower extent). Geometry source of truth with yEnd. */
    yStart: number;
    /** Model-space Y (upper extent). */
    yEnd: number;
    /** Stored as `units.floor`; annotation only. */
    floorAnnotation: number;
};
