# Application data types (simple guide)

**Who this is for:** Anyone who needs to understand *what kind of information* the app stores and uses — product, design, backend, or new engineers.

**Where the exact field names live in code:** `src/lib/database.types.ts` (database tables) and `src/lib/groundPlacementPad.ts` (placement pad JSON). This document explains the *ideas* in everyday language.

---

## Common patterns

- **ID:** Almost everything has a unique **UUID** string (a long random-looking id), not a simple 1, 2, 3 counter.
- **When it was created:** `created_at` is a **timestamp** (date and time, usually in UTC).
- **Optional text:** Fields marked “optional” or “can be empty” may be **null** in the database — meaning “we don’t have this yet” or “not used.”
- **URLs:** Many fields are **links** (https…) to images, 3D models, or sky (HDR) files. The app loads those files over the network.
- **3D numbers:** Positions and sizes are often stored as **three numbers** `[x, y, z]` for width/height/depth in the 3D scene. Ground placement sometimes uses only **horizontal** pairs `[x, z]` because “up” is handled separately.

---

## User profile (`profiles`)

One row per person who uses the app (tied to their login account).

| Field (idea) | What it means |
|--------------|----------------|
| **Role** | Either **admin** (can manage buildings, approve holds, etc.) or **client** (buyer / viewer). |
| **Full name / company** | Shown in lists and on allocation info; can be empty. |

---

## Building (`buildings`)

One row per **property or development** (the whole tower or project).

| Field (idea) | What it means |
|--------------|----------------|
| **Name, description, location** | Basic listing info visitors see. |
| **Model URL** | Link to the **3D exterior model** of the building (e.g. GLB file). |
| **Thumbnail / hero images** | Pictures for cards and headers. |
| **Tagline, starting price, store URL, etc.** | Marketing and commerce hints. |
| **Total units** | A number used for display or planning (may not always match counted rows). |
| **World environment** | Optional link to a **shared 3D world** (ground + sky) this building sits in. |
| **Generated env URL** | Optional link to an environment file when **not** using a shared world row. |
| **Section plan** | Structured JSON: the **2D floor layout** of the building (sections and footprints) used in the editor to generate or align units. |
| **Ground placement pad** | JSON: a **rectangle on the ground** where this building is placed in 3D (center, size, display mode, optional offsets). Same *shape* of data can exist on a world for a default template. |

---

## Unit (`units`)

One row per **apartment, office, or sellable space** inside a building.

### Listing-type fields

| Field (idea) | What it means |
|--------------|----------------|
| **Building** | Which building this unit belongs to. |
| **Unit number, floor** | Label and level. |
| **Price, area, bedrooms, bathrooms** | Standard listing numbers (some can be empty). |
| **Display name, view type, amenities, perks** | Extra text for marketing or UI. |
| **Status** | **`available`** — on the market. **`pending`** — in discussion or hold. **`sold`** — no longer available. |

### “Lock” fields (optional)

Sometimes used to show that someone is actively interested; exact rules depend on product + reservations.

| Field (idea) | What it means |
|--------------|----------------|
| **Locked at / locked by** | Optional timestamp and user reference for a lock display. |

### 3D and editor fields

| Field (idea) | What it means |
|--------------|----------------|
| **Mesh ID** | Identifier linking this row to a **part of the 3D building model** (which chunk is this unit). |
| **Position, size, rotation** | Where the unit’s **box** sits in 3D space and how it’s turned. |
| **Footprint** | A **2D outline** (list of corner points) for the unit on a floor plan. |
| **Internal model URL** | Optional separate **3D file** for the **inside** of the unit (walkthrough). |
| **Hotspots** | List of **clickable points** inside the interior: each has a position and text (title, description, optional material). |

### Lifecycle flags

| Field (idea) | What it means |
|--------------|----------------|
| **Deleted at** | If set, the unit is **soft-deleted** — hidden from normal lists but not erased from history. The app treats “no date here” as “still active.” |
| **Section plan sourced** | If **true**, this unit was **created from the building section plan** flow; the app may restrict certain edits unless the plan is re-applied. |

---

## Reservation (`reservations`)

A **request or hold** tying a **user** to a **unit**.

| Field (idea) | What it means |
|--------------|----------------|
| **Unit + user** | Which space and which account. |
| **Status** | **`soft_lock`** — temporary interest / hold. **`approved`** — accepted allocation. **`rejected`** — declined. **`expired`** — hold ran out. |
| **Expires at** | Optional time when a soft lock should end. |

---

## Sky — single file (`skybox_environments`)

Legacy style: one **HDR / environment** file per row, with a **label** and **file URL**.

---

## Sky — collection (`skybox_collections` + `skybox_collection_slots`)

A **named set** of skies (e.g. “morning / golden / night”).

- **Collection:** name/label only.
- **Slot:** one row per variant: **label**, **file URL**, **sort order** (so the UI can order them).

Worlds can point at a **collection** instead of a single legacy sky row.

---

## World environment (`world_environments`)

A **reusable 3D “ground” scene**: the terrain or plaza model plus lighting/surround choices.

| Field (idea) | What it means |
|--------------|----------------|
| **Label** | Human-readable name. |
| **Ground model URL** | Link to the **3D ground** mesh file. |
| **Sky** | Either a **legacy single sky** id or a **sky collection** id (collection is preferred when both exist). |
| **Ground placement pad** | Optional default **placement rectangle** for buildings on this ground (same JSON idea as on the building). |
| **Active scatter asset** | Optional link to a **small 3D prop set** defined *for this world* (trees, clumps, etc.). |
| **Active surround catalog asset** | Optional link to a **global catalog** prop set (grass, rocks, …) reused across worlds. |
| **Surround layout mode** | How dense props are placed around the ground: **`packed`**, **`spread`**, or **`sparse`**. |

---

## World scatter asset (`world_scatter_assets`)

A **3D file** used only inside one world (e.g. a specific tree pack).

| Field (idea) | What it means |
|--------------|----------------|
| **World** | Which world it belongs to. |
| **Kind** | In the database this is text; the app expects types like **`clump`** (grouped props) or **`tree`** (tree-like scatter). |
| **Label, file URL** | Name and link to the model file. |

---

## Surround catalog asset (`surround_catalog_assets`)

A **global library** entry: label + file URL for a surround model that **any world** can reference.

---

## JSON shapes stored inside rows

These are not separate tables; they are **JSON blobs** inside `buildings`, `units`, or `world_environments` (depending on field).

### Section plan (on building)

Describes the **stacked sections** of the building for the plan editor.

- **Base width / base depth:** overall footprint size in the plan’s coordinate system.
- **Sections:** each has an **id**, **label**, and **footprint** — a closed **2D polygon** as a list of `[x, y]` points in **normalized 0–1** coordinates (not real-world meters).

### Interior hotspot (inside unit JSON)

One hotspot = one **info card** in the 3D interior view.

- **Position:** `[x, y, z]` in the interior model.
- **Title** (required), optional **description** and **material** text.

### Ground placement pad (building or world)

Describes the **gold placement rectangle** on the ground where the building sits.

- **Center:** `[x, z]` on the horizontal plane.
- **Half extents:** `[halfWidth, halfDepth]` — half the size of the rectangle along each horizontal axis (in scene units / meters).
- **Pad display mode:** **`flat`** or **`followTerrain`** — whether the pad sits flat or follows the ground shape.
- **Optional:** **building yaw** (extra rotation), **building vertical offset** (sink or lift the building), **pad vertical offset** (lift just the edit pad).

---

## API-only shape: building unit allocation (not a table)

When the 3D engine asks “**who is this unit tied to right now?**” it gets a **list of rows** (from a database function today). Each row is roughly:

- **Unit id** — which space.
- **User id** — which account.
- **Reservation status** — e.g. soft lock vs approved.
- **Display name** — a friendly string built from profile name/company for the UI.

---

## Quick reference: status words

| Area | Allowed values | Plain meaning |
|------|------------------|---------------|
| **Unit status** | `available`, `pending`, `sold` | On market / in progress / gone. |
| **Reservation status** | `soft_lock`, `approved`, `rejected`, `expired` | Hold / accepted / declined / timed out. |
| **Profile role** | `admin`, `client` | Staff vs buyer/viewer. |
| **Scatter kind** | `clump`, `tree` | Style of scatter asset. |
| **Surround layout** | `packed`, `spread`, `sparse` | How full the ring of props is. |
| **Pad display** | `flat`, `followTerrain` | How the placement pad is drawn on the ground. |

---

## Related docs

- **Replacing Supabase / backend:** `docs/BACKEND_DEVELOPER_HANDOFF.md`
