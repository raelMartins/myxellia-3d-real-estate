import type { WorldEnvironmentWithSky } from '@/lib/worldEnvironments';

/**
 * Resolves which world row drives the engine exterior (ground URL, sky collection, etc.).
 * When `buildingWorldEnvironment` matches the selected id (e.g. fresh row from `loadWorldPreview`),
 * it wins over any same-id copy in `worldEnvironments` — that list can be stale until refetch completes.
 */
export function pickEffectiveWorldEnvironment(
    selectedWorldEnvironmentId: string | null | undefined,
    buildingWorldEnvironment: WorldEnvironmentWithSky | null,
    worldEnvironments: WorldEnvironmentWithSky[]
): WorldEnvironmentWithSky | null {
    if (selectedWorldEnvironmentId === '__none__') return null;
    if (selectedWorldEnvironmentId && buildingWorldEnvironment?.id === selectedWorldEnvironmentId) {
        return buildingWorldEnvironment;
    }
    if (selectedWorldEnvironmentId) {
        return worldEnvironments.find((w) => w.id === selectedWorldEnvironmentId) ?? buildingWorldEnvironment ?? null;
    }
    return buildingWorldEnvironment ?? null;
}
