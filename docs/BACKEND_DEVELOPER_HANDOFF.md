# Backend handoff — Myxellia 3D real estate app

**Who this is for:** Engineers who will replace our current setup (Supabase) with a custom API and database.

**What this explains:** How data is stored and used today, so you can design something equivalent.

---

## 1. The simple picture

Today the **website talks straight to a cloud database** (PostgreSQL) through Supabase. Users log in with Supabase Auth. **3D model files** (buildings, interiors, ground worlds) go to **file storage**, and the database only stores **links** to those files (URLs).

When you build the new backend, you will usually:

- Put a **real API** in front of the database (the browser should not need direct DB access).
- Use your own **login system** (or a provider like Auth0) instead of Supabase Auth.
- Use **object storage** (e.g. S3, R2) for models instead of Supabase Storage.

---

## 2. What kind of database fits this product?

**We recommend a relational database — SQL — especially PostgreSQL.**

**Why SQL fits:**

- We have clear relationships: a **building** has many **units**; a **reservation** belongs to a **unit** and a **user**; **worlds** link to sky and surround assets.
- Some fields are flexible JSON (floor plans, 3D placement pads). PostgreSQL handles that well with **JSON columns** without losing the benefits of normal tables.

**Why a NoSQL-only design is usually the wrong default here:**

- You still need **rules** like “this unit belongs to this building” and “only this user can create their own reservation.” Relational databases make that straightforward.
- Reporting (counts, lists, admin screens) is simpler with SQL joins.

If you ever add a document store for something specific (logs, drafts), that can sit **next to** SQL — it does not need to replace it.

---

## 3. Main “things” we store (in plain English)

### Buildings

One row per property / development. Includes marketing text, images, price hints, and **where the 3D building model file lives** (`model_url`).

It can point to a **shared world environment** (ground + sky setup) via `world_environment_id`.

It can also store:

- **`section_plan`** — JSON describing the building’s floor layout (sections, dimensions) used in the editor.
- **`ground_placement_pad`** — JSON describing a rectangle on the ground where the building sits in the 3D world.

### Units

Apartments or spaces inside a building. Each row belongs to one `building_id`.

Important fields:

- **Listing info:** unit number, floor, price, size, bedrooms, bathrooms.
- **Status:** `available`, `pending`, or `sold`.
- **3D editor:** position, size, rotation, footprint, mesh id, optional **interior model URL**, **hotspots** (clickable points inside the model).
- **Soft delete:** if `deleted_at` is set, the unit is treated as deleted — the app almost always filters **“where deleted_at is empty.”**
- **`section_plan_sourced`:** if true, the unit came from the automated section-plan flow; editing rules in the app depend on this.

### Users and profiles

We have a **`profiles`** table tied to the login user id. It stores things like **role** (`admin` or `client`), **full name**, and **company**. The app loads this after sign-in.

*(Your new system should define how profiles are created when a user registers — today that may include Supabase triggers outside this repo.)*

### Reservations (holds / allocations)

When someone wants a unit, we create a **reservation** row:

- Links **`unit_id`** and **`user_id`**.
- **`status`:** for example `soft_lock` (temporary hold), `approved`, `rejected`, `expired`.
- Optional **`expires_at`** for time-limited holds.

The **3D engine** needs to show **who** has a hold on which unit, including **other clients’** holds, for inventory clarity. Today that uses a **database function** (see section 6) because normal table permissions hide other people’s rows.

### World environments (3D “grounds”)

Reusable scenes: ground model URL, optional sky (single HDRI or a **collection** of HDRIs), optional **scatter** props (trees, etc.), and layout settings.

### Sky and surround catalogs

- **Skybox:** either one HDRI file, or a **collection** with multiple **slots** (e.g. morning / night), each with a file URL.
- **Surround:** small 3D props around the world — either **per-world** assets or a **global catalog** reused across worlds.

---

## 4. How the frontend talks to the backend today

The Next.js app uses:

1. **Supabase’s JavaScript client** — mainly for **login** and some simple reads/updates.
2. **Plain HTTP requests** to Supabase’s REST API — same database, but the code builds URLs manually. This is used for uploads, some updates, and the 3D **engine** screen.

Requests typically send:

- **`apikey`** — the public “anon” key (not a secret in the browser, but tied to your project).
- **`Authorization: Bearer <user token>`** — the logged-in user’s session token, when the action must respect “who is this user?”

**Important for your replacement:** anything that relied on **Row Level Security** in Postgres today should become **explicit checks in your API** (e.g. “only admins can update this,” “users can only insert reservations with their own user id”).

---

## 5. File uploads (3D models)

Models are uploaded to a bucket named **`models`** (path examples: root filename, or `interior/{unitId}_...`).

After upload, the app stores a **public HTTPS URL** in the database (e.g. on `buildings.model_url` or `units.internal_model_url`).

**Your job:** provide upload + a stable URL the 3D viewer can load. Use signed upload URLs or server-side upload — avoid exposing long-lived admin keys in the browser.

---

## 6. Special case: “Who has this unit?” (RPC)

There is a Postgres function **`building_unit_allocations(building_id)`** that returns, for each unit in that building:

- unit id  
- user id  
- reservation status  
- a **display name** (from the profile)

It only considers **active**-style states (`approved`, `soft_lock`) and ignores deleted units.

It runs with **elevated permissions** so the UI can show allocations **across users** without opening up raw reservation rows to everyone via normal queries.

**On your new backend:** implement one **GET-style endpoint** (or equivalent) that returns the same information, with **clear permission rules** (e.g. only staff, or authenticated users viewing a building they’re allowed to see).

---

## 7. Where to find the exact shapes in code

| What | Where in this repo |
|------|---------------------|
| Table and column types (what the app expects) | `src/lib/database.types.ts` |
| SQL that added / changed tables | `supabase/migrations/*.sql` |

**Note:** Some base tables (`buildings`, `units`, etc.) may have been created before these migration files; the **TypeScript types file** is the best single reference for what the **current** frontend expects.

---

## 8. Environment variables the frontend uses today

- `NEXT_PUBLIC_SUPABASE_URL` — base URL for REST, Auth, and Storage.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public key sent as `apikey` on requests.

When you replace Supabase, the frontend will need new env vars (your API base URL, public client id if using OAuth, etc.) — that will be a separate frontend task.

---

## 9. Checklist — “parity” with what we have now

Use this as a acceptance list for the new system:

- [ ] **Buildings** — CRUD as needed; store model URL, optional world link, JSON for section plan and ground pad if used.
- [ ] **Units** — CRUD; respect **soft delete** (`deleted_at`); support all fields the types file lists (especially 3D and status).
- [ ] **Profiles** — tied to user; role admin vs client.
- [ ] **Reservations** — create/update/list with correct **user scoping**; prevent abuse (define your business rules, e.g. one active hold per unit).
- [ ] **Building unit allocations** — endpoint equivalent to today’s RPC for the 3D engine.
- [ ] **World / sky / scatter / surround** — tables or merged design matching how the app reads them today (see types + migrations).
- [ ] **File storage** — HTTPS URLs stored in DB; CORS if browsers load files cross-origin.
- [ ] **Auth** — issue tokens your API trusts; map to profile and roles.

---

## 10. Suggested tools (not mandatory)

- **Database:** PostgreSQL  
- **API:** any framework you prefer (Node, Go, Python, etc.) with **OpenAPI** docs for the frontend team  
- **ORM / migrations:** Prisma, Drizzle, SQLAlchemy, etc.  
- **Files:** S3-compatible storage + CDN  

---

## Questions?

Point backend engineers at this repo path: **`docs/BACKEND_DEVELOPER_HANDOFF.md`**, and at **`src/lib/database.types.ts`** for field-level detail.
