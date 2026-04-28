# Data types in the Myxellia app

This file is **generated**. Update the source in `scripts/generate-data-types-doc.mjs`, then run:

    npm run doc:data-types

---

## Big picture

Most “business” data lives in **Supabase** (PostgreSQL). The TypeScript mirror of the database schema is in `src/lib/database.types.ts`. The app reads and writes rows (records) from tables; some columns store **JSON** for flexible shapes (floor plans, 3D layout, sky placement).

A few types exist only in the **browser** (3D engine state, UI mode). They are not stored in the database unless the code saves them back to a row.

---

## People and access

### `profiles`

- One row per authenticated user (the row id matches the auth user id).
- **role**: `admin` can manage content; `client` is a buyer/viewer role.
- **full_name**, **company**: optional display fields for lobby and admin views.

---

## Projects (buildings)

### `buildings`

- A **building** is a real-estate project: marketing copy, hero imagery, links, and ties to 3D assets.
- **name**, **description**, **tagline**, **location**, **starting_price**: what you show on marketing pages.
- **model_url**: exterior 3D model of the tower/block.
- **thumbnail_url**, **hero_url**: images for cards and headers.
- **total_units**: count used in summaries (actual units are separate rows).
- **world_environment_id**: optional link to a reusable **world** (ground mesh + sky + scatter) used in the engine.
- **section_plan**: JSON describing the **gold section map** (footprint polygons per section). See “Embedded JSON” below.
- **ground_placement_pad**: JSON describing where the building sits on the terrain (center, size, offsets). Parsed in `src/lib/groundPlacementPad.ts`.
- **env_context**, **store_url**, **generated_env_url**: extra URLs/context used in deploy and environment tooling.

---

## Units (apartments / inventory)

### `units`

- Each row is one sellable **unit** inside a building.
- **building_id**: which building it belongs to.
- **unit_number**, **floor**, **display_name**: how it is labeled in lists and the 3D UI.
- **price**, **area_sqm**, **bedrooms**, **bathrooms**: listing facts (some may be empty).
- **status**: `available` (open), `pending` (held / in negotiation), `sold` (no longer available).
- **locked_at**, **locked_by**: optional fields when a unit is tied to a reservation workflow.
- **mesh_id**: links a unit to a part of the exterior model for highlighting and picking.
- **position**, **size**, **rotation**, **footprint**: how the unit volume is placed in 3D and its floor outline (arrays of numbers; footprint is a 2D polygon).
- **internal_model_url**: optional separate 3D file for the interior walkthrough.
- **hotspots**: JSON list of clickable interior points (title, description, 3D position). See “Embedded JSON”.
- **amenities**, **perks**, **view_type**: text fields for marketing copy.
- **deleted_at**: soft-delete timestamp so removed units can stay out of the UI without losing history.
- **section_plan_sourced**: when true, the unit was created from applying the building section plan.

---

## Reservations

### `reservations`

- Links a **user** to a **unit** they want to reserve.
- **status**:
  - `soft_lock`: temporary hold (often with a time limit).
  - `approved`: accepted reservation.
  - `rejected`: declined.
  - `expired`: hold ran out.
- **expires_at**: when a soft lock should end, if used.

### Shapes used in list screens (not extra tables)

- **UnitWithBuilding** (`src/lib/reservations.ts`): a unit plus nested `{ id, name }` for its building — built from a joined Supabase query.
- **ReservationWithDetails**: reservation row plus that nested unit object.
- **ReservationListItem**: reservation + flat **buildingName** + optional **profile** for admin tables.

---

## Sky and HDR backgrounds

### `skybox_environments`

- A single HDR / sky file: **label** + **file_url**.

### `skybox_collections` and `skybox_collection_slots`

- A **collection** is a named group of skies.
- Each **slot** is one HDR entry (**file_url**, **sort_order**, **label**) belonging to a collection.

### `SkyboxCollectionWithSlots`

- TypeScript convenience type: one collection row plus an array of its slots (from REST embeds).

---

## Worlds (ground + sky + surroundings)

### `world_environments`

- A reusable **scene preset**: terrain/ground model, sky choice, optional scatter props.
- **ground_model_url**: main ground mesh.
- **skybox_environment_id** or **skybox_collection_id**: either one direct HDR row or a whole rotating collection.
- **ground_placement_pad**: same JSON idea as on buildings — where content sits on the mesh.
- **active_surround_scatter_asset_id**: which uploaded scatter asset is “active” for this world (legacy path).
- **active_surround_catalog_asset_id**: pointer to a catalog surround asset when using the shared catalog.
- **surround_layout_mode**: string stored in DB; app treats values like `packed`, `spread`, `sparse` as layout styles for trees/props around the ground.

### `world_scatter_assets`

- Uploaded 3D props tied to a world (**kind** describes the renderer path, e.g. tree vs clump).

### `surround_catalog_assets`

- Shared library items (label + file) referenced by worlds for global surrounds.

### `WorldEnvironmentWithSky`

- A **world row** plus optional embedded **skybox_environments**, **skybox_collections** (with slots), **world_scatter_assets**, and **surround_catalog** from PostgREST — what the engine loads in one round trip.

### Scatter layout vocabulary (code-level enums)

- **ScatterSurroundKind**: `clump` | `tree` — how a scatter asset is interpreted.
- **SurroundLayoutMode**: `packed` | `spread` | `sparse` — density of placement around the ground ring.

---

## Embedded JSON (stored inside table columns)

### `InteriorHotspot` (often under `units.hotspots`)

- **id**: stable string id.
- **position**: `[x, y, z]` in model space.
- **title**, optional **material**, **description**: card content in the interior viewer.

### `SectionPlan` / `SectionPlanSection` (under `buildings.section_plan`)

- **baseWidth**, **baseDepth**: normalized plan size.
- **sections**: list of sections, each with **id**, **label**, and **footprint** as a closed 2D polygon in 0–1 coordinates.

### `GroundPlacementPad` (JSON; see `src/lib/groundPlacementPad.ts`)

- **center**: `[x, z]` world position of the pad center.
- **halfExtents**: half-size of the pad rectangle on the ground.
- **padDisplayMode**: `flat` or `followTerrain`.
- Optional tuning: **buildingYaw**, **buildingVerticalOffsetM**, **padVerticalOffsetM**.

### Generic `Json`

- Some columns are typed as `Json` in `database.types.ts` when the database allows any JSON-compatible value; the app usually parses them into stricter shapes (like the pad) before use.

---

## AI / deploy helper

### `ProjectData` (`src/lib/ai.ts`)

- Payload returned from the **generate project details** edge function: **name**, **tagline**, **location**, **price_cents**, **description**, **env_context** — used to pre-fill marketing-style fields, not a database table by itself.

---

## 3D engine UI state (Zustand, not a DB table)

Defined around `src/engine/store/engine.store.ts` — examples:

- **viewMode**: `exterior` | `interior`.
- **lightingMode**: `morning` | `golden` | `night`.
- **activeFloor**, **selectedUnit**, **hoveredUnit**: string ids for UI and picking.
- **placementPad** / **placementPadDirty** / **placementPadEditActive**: editing the gold placement pad.
- **unitAllocationNames** / **unitAllocationUserIds**: maps derived from reservations for client vs owner rules.
- **worldPreviewActive**, **previewWorldEnvironmentId**: loading another world without saving yet.

These mirror or extend database values but exist in memory until a save RPC runs.

---

## Quick reference: database table names

- `buildings`
- `units`
- `reservations`
- `profiles`
- `skybox_environments`
- `skybox_collections`
- `skybox_collection_slots`
- `world_environments`
- `world_scatter_assets`
- `surround_catalog_assets`

---

*Last generated: 2026-04-21T09:54:06.124Z (UTC).*
