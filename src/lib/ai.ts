/**
 * AI feature API: Pollinations (env image) + Gemini (unit suggestions)
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

/** Generate environment skybox image via Pollinations and store URL on building */
export async function generateEnvImage(buildingId: string, envContext: string): Promise<{ url: string }> {
  const res = await fetch(`${getFunctionsUrl()}/generate-env-image`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ building_id: buildingId, env_context: envContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to generate environment image');
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
