// Supabase Edge Function: Use Gemini Vision to suggest units from building screenshots
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-1.5-flash';

const SYSTEM_PROMPT = `You are analyzing screenshots of a 3D building model (exterior views from different angles).
Identify potential residential units (apartments/flats). For each unit you can identify, provide:
- floor: integer (1 = ground/first floor, 2 = second, etc.)
- position: one of "left" | "center" | "right" (horizontal) and optionally "front" | "back" for depth
- label: suggested unit number like "101", "102", "201", "PH1" (floor + position hint)

Return ONLY a valid JSON array of objects with keys: floor, position, label. No markdown, no explanation.
Example: [{"floor":1,"position":"left","label":"101"},{"floor":1,"position":"right","label":"102"},{"floor":2,"position":"left","label":"201"}]`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY is not set. Add it in Supabase Dashboard > Edge Functions > suggest-units > Secrets.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { building_id, images } = await req.json();
    if (!building_id || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'building_id and images (array of base64 strings) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
      { text: SYSTEM_PROMPT + '\n\nNow analyze these building views and return the JSON array of suggested units.\n' },
    ];

    for (const img of images.slice(0, 4)) {
      const base64 = typeof img === 'string' ? img.replace(/^data:image\/\w+;base64,/, '') : img;
      if (base64) {
        parts.push({
          inlineData: { mimeType: 'image/jpeg', data: base64 },
        });
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'Gemini API failed: ' + errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No response from Gemini', raw: geminiData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let suggestions: { floor: number; position: string; label: string }[];
    try {
      const cleaned = text.replace(/```json?\s*|\s*```/g, '').trim();
      suggestions = JSON.parse(cleaned);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      suggestions = [];
    }

    return new Response(
      JSON.stringify({ building_id, suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
