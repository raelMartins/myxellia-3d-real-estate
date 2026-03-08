/**
 * AI feature API: Gemini (project details, unit suggestions). Skybox env is from uploaded HDR only.
 * Calls Supabase Edge Functions.
 */

const getFunctionsUrl = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL is missing');
  return `${url.replace(/\/$/, '')}/functions/v1`;
};

const getAuthHeaders = () => {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key || ''}`,
  };
};

export interface ProjectData {
  name: string;
  tagline: string;
  location: string;
  price_cents: number;
  description: string;
  env_context: string;
}

/** Generate luxury real estate details from Gemini 1.5 Flash via Edge Function */
export async function generateProjectDetails(hints?: { name?: string; location?: string }): Promise<ProjectData> {
  const res = await fetch(`${getFunctionsUrl()}/generate-project-details`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(hints || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to generate project details');
  }
  return res.json();
}

export interface UnitSuggestion {
  floor: number;
  position: string;
  label: string;
}

/** Get AI-suggested units from building screenshot(s) via Gemini */
export async function suggestUnits(
  buildingId: string,
  imagesBase64: string[]
): Promise<{ building_id: string; suggestions: UnitSuggestion[] }> {
  const res = await fetch(`${getFunctionsUrl()}/suggest-units`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ building_id: buildingId, images: imagesBase64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to get unit suggestions');
  }
  return res.json();
}
