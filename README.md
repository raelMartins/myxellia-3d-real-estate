# Myxellia 3D Real Estate — Next.js

Next.js port of the Myxellia 3D Real Estate app (originally Vite + React). Same features, App Router, and **engine code isolated** under `src/engine/` for potential extraction as an npm package.

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Environment**
   Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Same values as the Vite project’s `VITE_SUPABASE_*`.)

3. **Supabase**
   If you use local Supabase (migrations, functions), copy the `supabase/` folder from the original `myxellia-3d-real-estate` project into this one.

## Run

```bash
npm run dev
```

Build: `npm run build`  
Start production: `npm run start`

## Structure

- **`src/engine/`** — 3D engine (canvas, building/units, store, lib). Intended for future npm package extraction.
- **`src/app/`** — Next.js App Router (layout, pages).
- **`src/components/`** — App-level UI (sidebar, modals, forms).
- **`src/lib/`** — App lib (Supabase, DB types, auth, reservations, etc.).
- **`src/pages/`** — Page components (Lobby, Engine, PropertyDetail, etc.) used by app routes.
- **`src/store/`** — Auth store (engine store lives in `src/engine/store/`).

## Routes

- `/` — Lobby
- `/detail/[buildingId]` — Property detail
- `/engine/[buildingId]` — 3D engine
- `/deploy` — Deploy project
- `/skyboxes` — Skybox management
- `/skyboxes/preview/[id]` — Skybox preview
- `/reservations` — My reservations
- `/admin/reservations` — Admin reservations
