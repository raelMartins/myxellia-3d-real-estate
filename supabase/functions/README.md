# Edge Functions (AI features)

## 1. `generate-env-image` (Pollinations)

- **Purpose:** Generates a skybox image from the building’s `env_context` and saves it to Storage, then sets `buildings.generated_env_url`.
- **Secrets:** None. Pollinations is used without an API key.
- **Invoke:** Called automatically after deploy when “Environment context” is filled, or you can call it manually with `POST` body: `{ "building_id": "uuid", "env_context": "your description" }`.
- **Storage:** Uses the existing `models` bucket; images are stored at `env/{building_id}.jpg`.

## 2. `suggest-units` (Gemini)

- **Purpose:** Sends screenshots of the 3D building to Gemini Vision and returns suggested units (floor, position, label). The admin confirms which to save.
- **Secrets:** Set **`GEMINI_API_KEY`** in the Supabase Dashboard:
  - Project → Edge Functions → `suggest-units` → Secrets → Add `GEMINI_API_KEY` with your [Google AI Studio](https://aistudio.google.com/) API key (free tier, no card required).
- **Invoke:** From the 3D Engine, admin clicks “Suggest units (AI)”. The app captures the current canvas and calls this function.

## Deploy

From the project root:

```bash
npx supabase functions deploy generate-env-image
npx supabase functions deploy suggest-units
```

For `suggest-units`, set the secret after deploy:

```bash
npx supabase secrets set GEMINI_API_KEY=your_key
```

## Database

- Run the migration that adds `generated_env_url` to `buildings` (e.g. `20250305000000_add_generated_env_url.sql`).
- Ensure your `buildings` table has an `env_context` column (text); add it manually if your schema doesn’t include it yet.
