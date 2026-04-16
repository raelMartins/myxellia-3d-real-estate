# World environments

## Sky precedence (exterior)

Resolution is implemented in [`src/lib/skyboxEnvResolve.ts`](../src/lib/skyboxEnvResolve.ts) (`resolveExteriorHdriUrl`). Order:

1. **Explicit no sky** — Session flag `selectedSkyboxUrl === '__none__'` skips HDR (Drei preset only).
2. **Active world environment — sky collection** — If `world_environments.skybox_collection_id` is set and the embedded `skybox_collections.skybox_collection_slots` has at least one slot, the HDR URL is taken from the selected slot, or the **first slot by `sort_order`** when no slot is selected.
3. **Legacy single HDR on world** — If the world still has `skybox_environment_id` and an embedded `skybox_environments.file_url`, that URL is used (until you migrate rows to collections).
4. **Catalog sky collection** — When the building engine shows the sky dropdown, a chosen `skybox_collections` row (same slot rules as above).
5. **`buildings.generated_env_url`** — Per-building default HDR when nothing above applies.
6. **`NEXT_PUBLIC_FALLBACK_HDRI_URL`** — App-wide fallback HDR URL (optional env; used before Drei-only preset).
7. **Drei `Environment` preset** — When no HDR URL is set.

## Ground mesh

Ground/surroundings models (GLB, GLTF, FBX, OBJ) are stored like building models (public URLs under the `models/` bucket). Author large enough geometry so the ground fills the camera frustum at ground level for your default orbit; auto-fit is not applied in v1.

## Database

- `migrations/20260413120000_world_environments.sql` — base `world_environments` and `skybox_environment_id`.
- `migrations/20260416120000_skybox_collections.sql` — `skybox_collections`, `skybox_collection_slots`, and `world_environments.skybox_collection_id`.

If you previously added `.blend`-related columns, apply `migrations/20260415100000_drop_world_environments_blend.sql` to remove them.

### Migrating off legacy single HDR rows

After every `world_environment` you care about has `skybox_collection_id` set (and optional cleanup of `skybox_environment_id`), you may delete unused rows from `skybox_environments` in the Supabase dashboard. **Do not delete** `skybox_environments` rows that are still referenced by `world_environments.skybox_environment_id` until those worlds are updated.

Ensure authenticated users who manage environments and sky collections have `INSERT`/`UPDATE`/`DELETE` via RLS (or tighten policies to your admin role).
