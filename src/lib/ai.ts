/**
 * AI feature API: Gemini (project details). Skybox env is from uploaded HDR only.
 * Calls Supabase Edge Functions.
 */

const getFunctionsUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
  return `${url.replace(/\/$/, '')}/functions/v1`;
};

const getAuthHeaders = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
