/**
 * Whether a non-admin viewer may not select this unit because an active reservation
 * (approved or soft_lock) belongs to another user.
 */
export function isUnitAllocatedToOtherClient(params: {
    unitId: string;
    currentUserId: string | undefined;
    isAdmin: boolean;
    unitAllocationUserIds: Record<string, string>;
}): boolean {
    if (params.isAdmin) return false;
    const owner = params.unitAllocationUserIds[params.unitId];
    if (!owner) return false;
    if (params.currentUserId && owner === params.currentUserId) return false;
    return true;
}
